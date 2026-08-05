/**
 * 把纯文本子节点包装成和普通元素一致的结构，方便 render 统一处理
 * @param {string} text
 */
function createTextElement(text) {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: text,
            children: []
        }
    }
}

/**
 * JSX 编译后会调用这个函数，例如 <div id="a">test</div> 编译为
 * createElement('div', { id: 'a' }, 'test')
 * @param {string} type
 * @param {object} props
 * @param  {...any} children
 */
function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child)
            )
        }
    }
}

export { createTextElement }
export default createElement
