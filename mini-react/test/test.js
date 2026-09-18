// const AppNode = {
//   "type": "div",
//   "props": {
//     "style": "color: blue",
//     "children": [
//       {
//         "type": "TEXT_ELEMENT",
//         "props": {
//           "nodeValue": "1",
//           "children": []
//         }
//       }
//     ]
//   }
// }
// /**
//  * 把纯文本子节点包装成和普通元素一致的结构，方便 render 统一处理
//  * @param {string} text
//  */
// function createTextElement(text) {
//     return {
//         type: 'TEXT_ELEMENT',
//         props: {
//             nodeValue: text,
//             children: []
//         }
//     }
// }
// function createElement(type, props, ...children) {
//     return {
//         type,
//         props:{
//               ...props,
//             children: children.map(child =>
//                 typeof child === 'object' ? child : createTextElement(child)
//             )
//         }
//     }
// }



function test(){
  let map = new Map()
  map.set('a', 1)
  map.set('b', 2)
  map.set('a',map.has('a')?map.get('a')+1:1)
  map.set('c',3)
  for(let value of map.values()){
    console.log(value)
  }
}

test()