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
 * @description 处理一个工作单元：建好当前 fiber 的 dom，把它的子 element 转成子 fiber 链表，
 * @param {Fiber} fiber
 * @returns {Fiber | undefined} 下一个工作单元，没有则返回 undefined
 */
function performUnitOfWork(fiber) {
    buildDom(fiber)
    busyWait(debugConfig.slowUnitMs)
    reconcileChildren(fiber, fiber.props.children ?? [])

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
 * 建 dom 节点，幂等：根 fiber 自带容器、UPDATE 复用旧节点，都不会重建
 * @param {Fiber} fiber
 */
function buildDom(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
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
 * DELETION 只摘当前节点就返回：子树会随父节点一起离开文档，不能再按旧 tag 往下走。
 * @param {Fiber | null | undefined} fiber
 */
function commitWork(fiber) {
    if (!fiber) {
        return
    }

    if (fiber.effectTag === PLACEMENT && fiber.dom && fiber.parent) {
        fiber.parent.dom.appendChild(fiber.dom)
    } else if (fiber.effectTag === UPDATE && fiber.dom) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag === DELETION && fiber.dom && fiber.parent) {
        fiber.parent.dom.removeChild(fiber.dom)
        return
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

export default render
