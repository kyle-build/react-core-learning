import { debugConfig, debug } from '../debug/debug.js'

/** @typedef {import('./types.js').Fiber} Fiber */

function isEvent(key) {
    return /^on[A-Z]/.test(key)
}

function isProperty(key) {
    return key !== 'children' && key !== 'style' && !isEvent(key)
}

function eventTypeOf(key) {
    return key.slice(2).toLowerCase()
}

/**
 * 把 nextProps 相对 prevProps 的差异写到真实 DOM 上。
 * create 时 prevProps 传空对象，等价于给新节点设初始属性。
 * @param {HTMLElement | Text} dom
 * @param {Record<string, any>} prevProps
 * @param {Record<string, any>} nextProps
 */
export function updateDom(dom, prevProps, nextProps) {
    prevProps = prevProps ?? {}
    nextProps = nextProps ?? {}

    Object.keys(prevProps).forEach(key => {
        if (!isEvent(key)) {
            return
        }
        if (key in nextProps && prevProps[key] === nextProps[key]) {
            return
        }
        if (typeof prevProps[key] === 'function' && dom.removeEventListener) {
            dom.removeEventListener(eventTypeOf(key), prevProps[key])
        }
    })

    Object.keys(nextProps).forEach(key => {
        if (!isEvent(key)) {
            return
        }
        if (prevProps[key] === nextProps[key]) {
            return
        }
        if (typeof nextProps[key] === 'function' && dom.addEventListener) {
            dom.addEventListener(eventTypeOf(key), nextProps[key])
        }
    })

    if ('style' in dom) {
        const el = /** @type {HTMLElement} */ (dom)
        if (prevProps.style !== nextProps.style) {
            el.style.cssText = nextProps.style ?? ''
        }
    }

    Object.keys(prevProps).forEach(key => {
        if (!isProperty(key)) {
            return
        }
        if (!(key in nextProps)) {
            dom[key] = ''
        }
    })

    Object.keys(nextProps).forEach(key => {
        if (!isProperty(key)) {
            return
        }
        if (prevProps[key] !== nextProps[key]) {
            dom[key] = nextProps[key]
        }
    })
}

/**
 * @param {Fiber} fiber
 * @returns {Text | HTMLElement}
 */
function createDom(fiber) {
    debug(`[createDom] ${fiber.type}`, debugConfig.logCreateDom)

    const type = /** @type {string} */ (fiber.type)
    const dom = type === 'TEXT_ELEMENT'
        ? document.createTextNode('')
        : document.createElement(type)

    updateDom(dom, {}, fiber.props)
    return dom
}

export default createDom
