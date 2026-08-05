import createDom from './createDom.js'

function isProperty(key){
    return key !== "children"
}

function isStyle(key){
    return key === "style"
}
/**
 * 渲染元素到容器
 * @param {*} element 元素对象
 * @param {*} container 容器元素
 */
function render(element,container){
    const dom = createDom(element)
    Object.keys(element.props).forEach(key => {
        if(isProperty(key)){
            if(isStyle(key)){
                dom.style.cssText = element.props[key]
            }else{
                dom[key] = element.props[key]
            }
        }
    })  
    container.append(dom)
    // 递归渲染子元素
    element.props.children?.forEach(child => {
        render(child,dom)
    })
    return dom;
}
export default render;
