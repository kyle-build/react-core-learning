import createDom from './createDom.js'


/**
 * 下一个工作单元
 * @param dom 真实的节点
 * @param props
 */
let nextUnitOfWork = null

/**
 * 渲染入口：不再自己递归渲染，只是把根 fiber 放进任务队列，
 * 真正的渲染工作交给 workLoop 在浏览器空闲时间里异步完成
 * @param {*} element 元素对象
 * @param {*} container 容器元素
 */
function render(element, container){
    nextUnitOfWork = {
        dom: container,
        props: {
            children: [element]
        }
    }
}

// 临时实验：改这个值对比 1 和 0 两种阈值下是否会出现"超支"（elapsedWall > initialBudget）
const YIELD_MARGIN = 1

/**
 * 每帧浏览器空闲时被调用一次，尽量多做工作单元，直到没有空闲时间了就让出主线程
 * @param {IdleDeadline} deadline
 */
function workLoop(deadline){
    let shouldYield = false
    let iterations = 0
    let lastUnitCost = 0
    const callbackStart = performance.now()
    const initialBudget = deadline.timeRemaining()

    while(nextUnitOfWork && !shouldYield){
        const unitStart = performance.now()
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        lastUnitCost = performance.now() - unitStart
        iterations++
        shouldYield = deadline.timeRemaining() < YIELD_MARGIN
    }

    const elapsedWall = performance.now() - callbackStart
    const overBudget = elapsedWall - initialBudget
    console.log(
        `[workLoop] margin=${YIELD_MARGIN}ms iterations=${iterations} lastUnitCost=${lastUnitCost.toFixed(3)}ms `
        + `initialBudget=${initialBudget.toFixed(2)}ms elapsedWall=${elapsedWall.toFixed(2)}ms `
        + `overBudget=${overBudget.toFixed(2)}ms${overBudget > 0 ? ' <- 超支' : ''}`
    )

    requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)

/**
 * 处理一个 fiber：创建它的 dom、挂到父节点上、把它的子 element 转成子 fiber 链表，
 * 最后返回下一个要处理的 fiber（child -> sibling -> 回溯 parent 找 sibling）
 * @param {*} fiber
 */
// 临时实验：人为拉长每个 fiber 的处理耗时，让"建一个挂一个"的半棵树现象肉眼可见
function busyWait(ms){
    const start = performance.now()
    while(performance.now() - start < ms){}
}

/**
 * 重建dom节点 幂等保护
 */
function buildDom(fiber){
    if(!fiber.dom){
        fiber.dom = createDom(fiber)
    }
}

/**
 * 挂载到父级节点
 */
function mountToParent(fiber){
    if(fiber.parent){
        fiber.parent.dom.append(fiber.dom)
    }
}

/**
 * 将element转链表储起来
 */
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
 * 处理下一个工作单元
 * @param {*} fiber fiber节点
 * @returns 
 */
function performUnitOfWork(fiber){
    buildDom(fiber)
    busyWait(0.5)
    // TODO: 这里应该等整棵 fiber 树都建完再统一挂载，而不是建一个挂一个，
    // 否则渲染被打断时页面会出现一棵没建完的“半棵树”
    mountToParent(fiber)
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

export default render;
