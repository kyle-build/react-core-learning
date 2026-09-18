/**
 * createElement 产物。运行时就是普通 object，这个 typedef 只给编辑器做形状约束。
 *
 * @typedef {Object} ReactElement
 * @property {string|Function} type
 * @property {ReactElementProps} props
 */

/**
 * @typedef {Object} ReactElementProps
 * @property {ReactElement[]} [children]
 * @property {string} [nodeValue]
 * @property {string} [style]
 * @property {string} [id]
 * @property {Function} [onClick]
 */

/**
 * 一次 useState 调用对应的记录，按调用顺序存在函数组件 fiber.hooks 里。
 *
 * @typedef {Object} Hook
 * @property {any} state
 * @property {any[]} queue
 */

/**
 * Fiber 工作单元。
 * 根 fiber 是容器，已经有 `dom`，因此 `type` 可选；子 fiber 在 `reconcileChildren` 里才会带上 `type`。
 * 函数组件的 `type` 是函数本身，且没有自己的 `dom`；hooks 只挂在函数组件 fiber 上。
 *
 * @typedef {Object} Fiber
 * @property {string|Function} [type]
 * @property {ReactElementProps} props
 * @property {HTMLElement|Text|null} [dom]
 * @property {Fiber|null} [parent]
 * @property {Fiber|null} [child]
 * @property {Fiber|null} [sibling]
 * @property {Fiber|null} [alternate]
 * @property {'PLACEMENT'|'UPDATE'|'DELETION'} [effectTag]
 * @property {Hook[]} [hooks]
 */

export {}
