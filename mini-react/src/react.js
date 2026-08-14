/**
 * @param {string} text
 * @returns {object} 文本节点
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
 * @param {string} type
 * @param {object} props
 * @param  {...any} children
 * @returns {object} 元素节点
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

export default createElement
