// console.log(3)
// const div = document.createElement('div')
// div.id = "app"
// div.style="background-color: red;height:100px;width:100px"



const element = {
    type: 'div',
    props: {
        id: 'app',
        style: 'background-color: red;height:100px;width:100px',
        children:[
            {
                type:"TEXT_ELEMENT",
                props:{
                    text:"test"
                }
            }
        ]
    }
}


function isProperty(key){
    return key !== "children"
}
/**
 * 渲染元素到容器
 * @param {*} element 元素对象
 * @param {*} container 容器元素
 */
function render(element,container){
    const dom = element.type === "TEXT_ELEMENT" ? document.createTextNode(element.props.text) : document.createElement(element.type)
    Object.keys(element.props).forEach(key => {
        if(isProperty(key)){
            dom[key] = element.props[key]
        }
    })  
    container.append(dom)
    // 递归渲染子元素
    element.props.children.forEach(child => {
        render(child,dom)
    })
    return dom;
}


const root = document.querySelector('#app') 
render(element,root)


