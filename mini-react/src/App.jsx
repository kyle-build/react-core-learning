import createElement, { useState, useEffect } from './react.js'

function Title({ text }) {
    return createElement('h1', null, text)
}

/**
 * 按钮写在组件内部，onClick 直接调 setState。
 * 删/加一项也走 useState，不再靠外部 render。
 */
export function App() {
    const [count, setCount] = useState(0)
    const [items, setItems] = useState(['alpha', 'beta'])

    useEffect(() => {
        const prev = document.title
        document.title = `count: ${count}`
        return () => {
            document.title = prev
        }
    }, [count])

    return createElement(
        'div',
        {
            id: 'box',
            style: 'background:#c0392b;color:#fff;padding:16px;font-family:sans-serif'
        },
        createElement(Title, { text: `count: ${count}` }),
        createElement('button', {
            id: 'btn-inc',
            onClick: () => setCount(c => c + 1)
        }, '+1'),
        createElement('button', {
            id: 'btn-inc-twice',
            onClick: () => {
                setCount(c => c + 1)
                setCount(c => c + 1)
            }
        }, '+2'),
        createElement('button', {
            id: 'btn-remove',
            onClick: () => setItems(list => list.slice(0, -1))
        }, '删一项'),
        createElement('button', {
            id: 'btn-add',
            onClick: () => setItems(list => list.concat('item-' + (list.length + 1)))
        }, '加一项'),
        createElement(
            'ul',
            null,
            ...items.map(item => createElement('li', null, item))
        )
    )
}

export default App
