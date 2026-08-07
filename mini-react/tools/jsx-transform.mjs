// 手写的 JSX -> createElement(...) 转换器，不依赖 esbuild/babel 的 JSX 处理逻辑，
// 只用 @babel/parser 拿到标准 JSX 语法树（AST），转换和生成代码都是自己写的，
// 用来验证"JSX 怎么变成 createElement 调用"这条链路本身。
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import generateModule from '@babel/generator'
import * as t from '@babel/types'

const traverse = traverseModule.default ?? traverseModule
const generate = generateModule.default ?? generateModule

function jsxNameToNode(nameNode) {
    if (t.isJSXIdentifier(nameNode)) {
        // 首字母大写认为是组件（变量引用），否则是普通标签名（字符串）
        const isComponent = /^[A-Z]/.test(nameNode.name)
        return isComponent ? t.identifier(nameNode.name) : t.stringLiteral(nameNode.name)
    }
    if (t.isJSXMemberExpression(nameNode)) {
        return t.memberExpression(jsxNameToNode(nameNode.object), t.identifier(nameNode.property.name))
    }
    throw new Error('不支持的 JSX 标签名类型: ' + nameNode.type)
}

function buildProps(attributes) {
    if (attributes.length === 0) {
        return t.nullLiteral()
    }
    const properties = attributes.map(attr => {
        if (t.isJSXSpreadAttribute(attr)) {
            return t.spreadElement(attr.argument)
        }
        const key = t.isValidIdentifier(attr.name.name)
            ? t.identifier(attr.name.name)
            : t.stringLiteral(attr.name.name)
        let value
        if (attr.value === null) {
            value = t.booleanLiteral(true) // <input disabled /> -> { disabled: true }
        } else if (t.isStringLiteral(attr.value)) {
            value = t.stringLiteral(attr.value.value)
        } else if (t.isJSXExpressionContainer(attr.value)) {
            value = attr.value.expression
        }
        return t.objectProperty(key, value)
    })
    return t.objectExpression(properties)
}

function buildChildren(children) {
    const result = []
    for (const child of children) {
        if (t.isJSXText(child)) {
            const text = child.value.replace(/\s+/g, ' ').trim()
            if (text) result.push(t.stringLiteral(text))
        } else if (t.isJSXExpressionContainer(child)) {
            if (!t.isJSXEmptyExpression(child.expression)) {
                result.push(child.expression)
            }
        } else if (t.isJSXElement(child) || t.isJSXFragment(child)) {
            result.push(jsxToCallExpression(child))
        }
    }
    return result
}

function jsxToCallExpression(node) {
    if (t.isJSXFragment(node)) {
        return t.callExpression(t.identifier('createElement'), [
            t.identifier('Fragment'),
            t.nullLiteral(),
            ...buildChildren(node.children)
        ])
    }
    const opening = node.openingElement
    return t.callExpression(t.identifier('createElement'), [
        jsxNameToNode(opening.name),
        buildProps(opening.attributes),
        ...buildChildren(node.children)
    ])
}

/**
 * 把一段包含 JSX 语法的源码，转成只有 createElement(...) 调用的普通 JS 代码
 * @param {string} code
 * @returns {string}
 */
export function transformJsx(code) {
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
    console.log("[hdx] ast ",ast)
    traverse(ast, {
        JSXElement(path) {
            path.replaceWith(jsxToCallExpression(path.node))
        },
        JSXFragment(path) {
            path.replaceWith(jsxToCallExpression(path.node))
        }
    })

    return generate(ast, {}, code).code
}
