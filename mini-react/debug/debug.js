
export const debugConfig = {
    enabled: true,
    slowUnitMs: 0,
    logWorkLoop: false,
    logCreateDom: false
}


export function debug(message, isOpen = debugConfig.enabled){
    if(!isOpen){
        return
    }
    console.log(`[hdx] ${message}`)
}

export function busyWait(ms){
    if(!(ms > 0)){
        return
    }
    const start = performance.now()
    while(performance.now() - start < ms){}
}
