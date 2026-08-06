import createElement from './react.js'

// 临时实验：造一棵足够大的树，逼 workLoop 跨多个 requestIdleCallback 才能渲染完，
// 这样才能实测到 shouldYield 阈值真正生效的场景
const ROWS = 60
const COLS = 60

const cells = []
for (let i = 0; i < ROWS; i++) {
    const row = []
    for (let j = 0; j < COLS; j++) {
        row.push(
            createElement(
                'div',
                { style: `display:inline-block;width:18px;height:18px;background:hsl(${(i * COLS + j) % 360},70%,60%)` },
                ''
            )
        )
    }
    cells.push(createElement('div', { style: 'display:flex' }, ...row))
}

const App = createElement('div', { id: 'big-tree' }, ...cells)

export default App;
