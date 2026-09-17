import { debugConfig, debug } from '../debug/debug.js'

/** @typedef {import('./types.js').Fiber} Fiber */

function isProperty(key) {
    return key !== 'children' && key !== 'style'
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

    const dom = fiber.type === 'TEXT_ELEMENT'
        ? document.createTextNode('')
        : document.createElement(fiber.type)

    updateDom(dom, {}, fiber.props)
    return dom
}

export default createDom
