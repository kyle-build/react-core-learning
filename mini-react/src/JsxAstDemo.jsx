import createElement from './react.js'

// 用来验证自己写的 JSX 转换插件（tools/vite-plugin-my-jsx.mjs）是否生效
const Demo = <div id="a"><span style="color: blue">hi</span>{1}</div>

export default Demo
