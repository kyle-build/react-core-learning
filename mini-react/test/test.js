/**
 * 把纯文本子节点包装成和普通元素一致的结构，方便 render 统一处理
 * @param {string} text
 */
function createTextElement(text) {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: text,
            children: []
        }
    }
}
function createElement(type, props, ...children) {
    console.log(type,props,children)
    let temp = {
        type,
        props:{
              ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child)
            )
        }
    }
    console.log(temp)
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child)
            )
        }
    }
}

createElement({
  "type": "div",
  "props": {
    "style": "color: blue",
    "children": [
      {
        "type": "TEXT_ELEMENT",
        "props": {
          "nodeValue": "1",
          "children": []
        }
      }
    ]
  }
}
)