/**
 * 创建dom节点
 * @param {any} element 
 * @returns 
 */
function createDom(element){
    return element.type === "TEXT_ELEMENT"
        ? document.createTextNode(element.props.nodeValue)
        : document.createElement(element.type)
}
export default createDom;
