function isProperty(key){
    return key !== "children"
}

function isStyle(key){
    return key === "style"
}

/**
 * 根据 fiber 创建对应的 dom 节点，并把 props（children 除外）设置上去
 * @param {any} fiber
 * @returns
 */
function createDom(fiber){
    console.log(fiber)
    const dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode(fiber.props.nodeValue)
        : document.createElement(fiber.type)

    Object.keys(fiber.props).forEach(key => {
        if(isProperty(key)){
            if(isStyle(key)){
                dom.style.cssText = fiber.props[key]
            }else{
                dom[key] = fiber.props[key]
            }
        }
    })

    return dom
}
export default createDom;
