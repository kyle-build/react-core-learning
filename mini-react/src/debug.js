/**
 * 实验开关。这里的代码只为「把渲染过程放慢到肉眼/日志可见」而存在，
 * 渲染逻辑本身不依赖它们，平时保持全关，需要复现某个现象时再单独打开。
 */
export const debugConfig = {
    // 总开关，关掉后 debug() 的所有输出静默
    enabled: true,
    // 人为拉长每个 fiber 的处理耗时（ms）。设为 0.5 可复现 Step 2 的「半棵树」现象，
    // 以及观察 workLoop 跨多次 requestIdleCallback 的时间分片过程
    slowUnitMs: 0,
    // 打印每次 workLoop 的空闲预算、迭代次数与实际耗时，用来验证 YIELD_MARGIN 是否够用
    logWorkLoop: false,
    // 打印每个新建的 dom 节点
    logCreateDom: false
}

/**
 * 带统一前缀的日志，第二个参数用来接某个具体的开关
 * @param {string} message
 * @param {boolean} isOpen
 */
export function debug(message, isOpen = debugConfig.enabled){
    if(!isOpen){
        return
    }
    console.log(`[hdx] ${message}`)
}

/**
 * 忙等指定毫秒数，用来模拟一个耗时的工作单元
 * @param {number} ms
 */
export function busyWait(ms){
    if(!(ms > 0)){
        return
    }
    const start = performance.now()
    while(performance.now() - start < ms){}
}
