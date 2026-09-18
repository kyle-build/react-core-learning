import App from './App.jsx'
import createElement from './react.js'
import render from './render.js'

const root = document.querySelector('#app')

render(createElement(App, { title: 'hello', items: ['alpha', 'beta'] }), root)

document.querySelector('#btn-update').addEventListener('click', () => {
    render(createElement(App, { title: 'hello updated', items: ['alpha', 'beta'] }), root)
})

document.querySelector('#btn-remove').addEventListener('click', () => {
    render(createElement(App, { title: 'hello', items: ['alpha'] }), root)
})

document.querySelector('#btn-add').addEventListener('click', () => {
    render(createElement(App, { title: 'hello', items: ['alpha', 'beta', 'gamma'] }), root)
})
