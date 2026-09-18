import createElement, { useState } from './react.js'

/**
 * 给 main.js 的原生按钮用。事件系统还没有，setState 先从组件渲染时交出去。
 * 挂到 globalThis 上，避免 Vite HMR 造成两份模块级对象、按钮点了没反应。
 */
export const countApi = globalThis.__miniCountApi ?? (globalThis.__miniCountApi = {
    inc() {},
    incTwice() {}
})

/**
 * 嵌套函数组件：自己没有 DOM，commit 时要跳过它找到下面的 h1。
 */
function Title({ text }) {
    return createElement('h1', null, text)
}

/**
 * count 走 useState，组件自己触发更新；items 仍由外部 render 传入，用来对照 Step 5。
 */
export function App({ items = ['alpha', 'beta'] }) {
    const [count, setCount] = useState(0)
    countApi.inc = () => setCount(c => c + 1)
    countApi.incTwice = () => {
        setCount(c => c + 1)
        setCount(c => c + 1)
    }

    return createElement(
        'div',
        {
            id: 'box',
            style: 'background:#c0392b;color:#fff;padding:16px;font-family:sans-serif'
        },
        createElement(Title, { text: `count: ${count}` }),
        createElement(
            'ul',
            null,
            ...items.map(item => createElement('li', null, item))
        )
    )
}

export default App
