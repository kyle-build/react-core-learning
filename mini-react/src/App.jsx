import createElement from './react.js'

/**
 * 嵌套函数组件：自己没有 DOM，commit 时要跳过它找到下面的 h1。
 */
function Title({ text }) {
    return createElement('h1', null, text)
}

/**
 * 真正的函数组件。第二次 render 仍由 main.js 里的原生按钮触发。
 * 列表继续用 rest 展开，避免 JSX `{items.map}` 变成单个 array child。
 */
export function App({ title = 'hello', items = ['alpha', 'beta'] }) {
    return createElement(
        'div',
        {
            id: 'box',
            style: 'background:#c0392b;color:#fff;padding:16px;font-family:sans-serif'
        },
        createElement(Title, { text: title }),
        createElement(
            'ul',
            null,
            ...items.map(item => createElement('li', null, item))
        )
    )
}

export default App
