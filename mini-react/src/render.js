import createDom, { updateDom } from './createDom.js'
import { debugConfig, debug, busyWait } from '../debug/debug.js'

/** @typedef {import('./types.js').ReactElement} ReactElement */
/** @typedef {import('./types.js').Fiber} Fiber */

const YIELD_MARGIN = 1
const PLACEMENT = 'PLACEMENT'
const UPDATE = 'UPDATE'
const DELETION = 'DELETION'

/** @type {Fiber | null} */
let nextUnitOfWork = null
/** @type {Fiber | null} */
let wipRoot = null
/** @type {Fiber | null} */
let currentRoot = null
/** @type {Fiber[]} */
let deletions = []
let isLoopScheduled = false

/**
 * @param {ReactElement} element
 * @param {HTMLElement} container
 */
function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot
    }
    deletions = []
    nextUnitOfWork = wipRoot
    scheduleWorkLoop()
}

/**
 * 清空模块级渲染状态。引擎目前是单例，测试之间必须隔离。
 */
export function reset() {
    nextUnitOfWork = null
    wipRoot = null
    currentRoot = null
    deletions = []
    isLoopScheduled = false
}

function scheduleWorkLoop() {
    if (isLoopScheduled) {
        return
    }
    isLoopScheduled = true
    requestIdleCallback(workLoop)
}

/**
 * 每次浏览器空闲时被调用一次，尽量多做工作单元，直到快没时间了就让出主线程。
 * 整棵树建完之后进入 commit 阶段，一次性挂载
 * @param {IdleDeadline} deadline
 */
function workLoop(deadline) {
    isLoopScheduled = false

    const callbackStart = performance.now()
    const initialBudget = deadline.timeRemaining()
    let iterations = 0
    let shouldYield = false

    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        iterations++
        shouldYield = deadline.timeRemaining() < YIELD_MARGIN
    }

    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    if (debugConfig.logWorkLoop) {
        const elapsedWall = performance.now() - callbackStart
        const overBudget = elapsedWall - initialBudget
        debug(
            `[workLoop] margin=${YIELD_MARGIN}ms iterations=${iterations} `
            + `initialBudget=${initialBudget.toFixed(2)}ms elapsedWall=${elapsedWall.toFixed(2)}ms `
            + `overBudget=${overBudget.toFixed(2)}ms${overBudget > 0 ? ' <- 超支' : ''}`,
            debugConfig.logWorkLoop
        )
    }

    if (nextUnitOfWork) {
        scheduleWorkLoop()
    }
}

/**
 * @description 处理一个工作单元：函数组件调用自身拿 children；host 组件建 dom。然后把子 element 转成子 fiber 链表。
 * @param {Fiber} fiber
 * @returns {Fiber | undefined} 下一个工作单元，没有则返回 undefined
 */
function performUnitOfWork(fiber) {
    if (typeof fiber.type === 'function') {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }
    busyWait(debugConfig.slowUnitMs)

    if (fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
    return undefined
}

/**
 * 函数组件没有自己的 DOM。调用函数拿到返回的 element，再当成 children 去 reconcile。
 * @param {Fiber} fiber
 */
function updateFunctionComponent(fiber) {
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

/**
 * 建 dom 节点，幂等：根 fiber 自带容器、UPDATE 复用旧节点，都不会重建
 * @param {Fiber} fiber
 */
function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    reconcileChildren(fiber, fiber.props.children ?? [])
}

/**
 * 按 index 把新 element 和旧 fiber 配成一对，打上 effectTag。
 * 被删掉的旧 fiber 不在新树上，推进 deletions 交给 commit。
 * @param {Fiber} wipFiber
 * @param {ReactElement[]} elements
 */
function reconcileChildren(wipFiber, elements) {
    let index = 0
    /** @type {Fiber | null | undefined} */
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    /** @type {Fiber | null} */
    let prevSibling = null

    while (index < elements.length || oldFiber) {
        const element = elements[index]
        const sameType = !!(oldFiber && element && element.type === oldFiber.type)
        /** @type {Fiber | null} */
        let newFiber = null

        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: UPDATE
            }
        }

        if (element && !sameType) {
            newFiber = {
                type: element.type,
                props: element.props,
                parent: wipFiber,
                dom: null,
                alternate: null,
                effectTag: PLACEMENT
            }
        }

        if (oldFiber && !sameType) {
            oldFiber.effectTag = DELETION
            deletions.push(oldFiber)
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if (index === 0) {
            wipFiber.child = newFiber
        } else if (newFiber && prevSibling) {
            prevSibling.sibling = newFiber
        }

        if (newFiber) {
            prevSibling = newFiber
        }

        index++
    }
}

function commitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

/**
 * 按 effectTag 把一个 fiber 的 DOM 副作用落到页面上。
 * 函数组件没有 .dom：挂载/更新时跳过自己，往上找 host 祖先当父节点；
 * 删除时往下找到真正的 host 节点再 removeChild。
 * @param {Fiber | null | undefined} fiber
 */
function commitWork(fiber) {
    if (!fiber) {
        return
    }

    const domParent = findHostParentDom(fiber)

    if (fiber.effectTag === PLACEMENT && fiber.dom && domParent) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === UPDATE && fiber.dom) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag === DELETION) {
        commitDeletion(fiber, domParent)
        return
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

/**
 * 沿 parent 往上走到第一个带 .dom 的 fiber（host 或根容器）。
 * @param {Fiber} fiber
 * @returns {HTMLElement | Text | null | undefined}
 */
function findHostParentDom(fiber) {
    let parent = fiber.parent
    while (parent && !parent.dom) {
        parent = parent.parent
    }
    return parent && parent.dom
}

/**
 * 删除当前子树在页面上的 host 节点。
 * 自己有 .dom 就摘掉（子树随节点离开文档）；否则是函数组件，只走它自己的 child 链表。
 * @param {Fiber | null | undefined} fiber
 * @param {HTMLElement | Text | null | undefined} domParent
 */
function commitDeletion(fiber, domParent) {
    if (!fiber || !domParent) {
        return
    }
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
        return
    }
    // 函数组件没有 .dom：只拆它自己的子树，不能走 sibling（那是父节点的其他孩子）
    let child = fiber.child
    while (child) {
        commitDeletion(child, domParent)
        child = child.sibling
    }
}

export default render
