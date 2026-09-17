import createElement from './react.js'

/**
 * 用 createElement 展开列表，避免 JSX `{items.map}` 变成单个 array child。
 * 第二次 render 由 main.js 里的原生按钮触发，不依赖事件系统 / 函数组件。
 */
export function createApp(title = 'hello', items = ['alpha', 'beta']) {
    return createElement(
        'div',
        {
            id: 'box',
            style: 'background:#c0392b;color:#fff;padding:16px;font-family:sans-serif'
        },
        createElement('h1', null, title),
        createElement(
            'ul',
            null,
            ...items.map(item => createElement('li', null, item))
        )
    )
}

export default createApp
