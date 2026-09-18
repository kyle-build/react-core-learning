import App, { countApi } from './App.jsx'
import createElement from './react.js'
import render from './render.js'

const root = document.querySelector('#app')

render(createElement(App, { items: ['alpha', 'beta'] }), root)

document.querySelector('#btn-inc').addEventListener('click', () => {
    countApi.inc()
})

document.querySelector('#btn-inc-twice').addEventListener('click', () => {
    countApi.incTwice()
})

document.querySelector('#btn-remove').addEventListener('click', () => {
    render(createElement(App, { items: ['alpha'] }), root)
})

document.querySelector('#btn-add').addEventListener('click', () => {
    render(createElement(App, { items: ['alpha', 'beta', 'gamma'] }), root)
})
