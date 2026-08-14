import createDom from './createDom.js'
import { debugConfig, debug, busyWait } from './debug.js'

const YIELD_MARGIN = 1
let nextUnitOfWork = null
let wipRoot = null
let isLoopScheduled = false

/**
 * @param {*} element 元素对象
 * @param {*} container 容器元素
 */
function render(element, container){
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        }
    }
    nextUnitOfWork = wipRoot
    scheduleWorkLoop()
}

/**
 * 按需把 workLoop 排进空闲队列。没有活干的时候不占用任何空闲回调
 */
function scheduleWorkLoop(){
    if(isLoopScheduled){
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
function workLoop(deadline){
    isLoopScheduled = false

    const callbackStart = performance.now()
    const initialBudget = deadline.timeRemaining()
    let iterations = 0
    let shouldYield = false

    while(nextUnitOfWork && !shouldYield){
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        iterations++
        shouldYield = deadline.timeRemaining() < YIELD_MARGIN
    }

    if(!nextUnitOfWork && wipRoot){
        commitRoot()
    }

    if(debugConfig.logWorkLoop){
        const elapsedWall = performance.now() - callbackStart
        const overBudget = elapsedWall - initialBudget
        debug(
            `[workLoop] margin=${YIELD_MARGIN}ms iterations=${iterations} `
            + `initialBudget=${initialBudget.toFixed(2)}ms elapsedWall=${elapsedWall.toFixed(2)}ms `
            + `overBudget=${overBudget.toFixed(2)}ms${overBudget > 0 ? ' <- 超支' : ''}`,
            debugConfig.logWorkLoop
        )
    }

    if(nextUnitOfWork){
        scheduleWorkLoop()
    }
}

/**
 * @description 处理一个工作单元：建好当前 fiber 的 dom，把它的子 element 转成子 fiber 链表，
 * @param {object} fiber
 * @returns {object} 下一个工作单元，没有则返回 undefined
 */
function performUnitOfWork(fiber){
    buildDom(fiber)
    busyWait(debugConfig.slowUnitMs)
    elementToLinklist(fiber)

    if(fiber.child){
        return fiber.child
    }
    let nextFiber = fiber
    while(nextFiber){
        if(nextFiber.sibling){
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
    return undefined
}

/**
 * 建 dom 节点，幂等：根 fiber 自带容器 dom，重复进入也不会重建
 */
function buildDom(fiber){
    if(!fiber.dom){
        fiber.dom = createDom(fiber)
    }
}

function elementToLinklist(fiber){
    const elements = fiber.props.children ?? []
    let prevSibling = null
    elements.forEach((element, index) => {
        const newFiber = {
            type: element.type,
            props: element.props,
            parent: fiber,
            dom: null
        }
        if(index === 0){
            fiber.child = newFiber
        }else{
            prevSibling.sibling = newFiber
        }
        prevSibling = newFiber
    })
}

/**
 * 把 wipRoot 这棵已经在内存里建完的 fiber 树，一次性同步挂到真实 DOM 上
 */
function commitRoot(){
    commitWork(wipRoot.child)
    wipRoot = null
}

/**
 * 递归把一个 fiber 挂到父节点上，再处理它的 child/sibling。
 * 这一步同步、不可中断——树已经建完了，挂载必须一次做完，
 * 保证用户任何时候看到的都是完整的一次渲染结果，不会看到中间态
 * @param {*} fiber
 */
function commitWork(fiber){
    if(!fiber){
        return
    }
    if(fiber.parent){
        fiber.parent.dom.append(fiber.dom)
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

export default render;
