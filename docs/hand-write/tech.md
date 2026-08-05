# 初始化环境
yarn create vite
project-name: react-core-learning
Select a template: react
cd react-core-learning
yarn install
yarn run dev
# DOM操作
index.html 是项目的入口文件，它包含了项目的 HTML 结构和脚本引用。 
index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```
加载main.js
本质上都是操作DOM
···js
const div = document.createElement('div');
div.id = 'app';
div.style.color = 'red';
const text = document.createTextNode('Hello React!');
div.appendChild(text);
const root = document.querySelector('#app');
root.appendChild(div);
···

vite 会尝试解析这个 const App = <div>test</div> 然后调用react.createElemente()
```
const App = {
    type: 'div',
    props: {
        id: 'box',
        style: 'background-color: red;height:100px;width:100px',
        children:[
            {
                type:"TEXT_ELEMENT",
                props:{
                    nodeValue:"test",
                    children:[]
                }
            }
        ]
    }
}
// const App = <div>test</div>

export default App;

```