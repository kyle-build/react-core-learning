/** @typedef {import('./types.js').ReactElement} ReactElement */

/**
 * @param {string|number} text
 * @returns {ReactElement}
 */
function createTextElement(text) {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: String(text),
            children: []
        }
    }
}

/**
 * @param {string|Function} type
 * @param {Object|null} props
 * @param {...(ReactElement|string|number)} children
 * @returns {ReactElement}
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

export { useState } from './render.js'
export default createElement
