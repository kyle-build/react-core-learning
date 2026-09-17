/**
 * createElement 产物。运行时就是普通 object，这个 typedef 只给编辑器做形状约束。
 *
 * @typedef {Object} ReactElement
 * @property {string} type
 * @property {ReactElementProps} props
 */

/**
 * @typedef {Object} ReactElementProps
 * @property {ReactElement[]} [children]
 * @property {string} [nodeValue]
 * @property {string} [style]
 * @property {string} [id]
 */

/**
 * Fiber 工作单元。
 * 根 fiber 是容器，已经有 `dom`，因此 `type` 可选；子 fiber 在 `reconcileChildren` 里才会带上 `type`。
 *
 * @typedef {Object} Fiber
 * @property {string} [type]
 * @property {ReactElementProps} props
 * @property {HTMLElement|Text|null} [dom]
 * @property {Fiber|null} [parent]
 * @property {Fiber|null} [child]
 * @property {Fiber|null} [sibling]
 * @property {Fiber|null} [alternate]
 * @property {'PLACEMENT'|'UPDATE'|'DELETION'} [effectTag]
 */

export {}
