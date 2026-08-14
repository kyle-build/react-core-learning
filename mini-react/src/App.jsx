import createElement from './react.js'

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
