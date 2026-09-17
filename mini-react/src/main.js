import { createApp } from './App.jsx'
import render from './render.js'

const root = document.querySelector('#app')

render(createApp('hello', ['alpha', 'beta']), root)

document.querySelector('#btn-update').addEventListener('click', () => {
    render(createApp('hello updated', ['alpha', 'beta']), root)
})

document.querySelector('#btn-remove').addEventListener('click', () => {
    render(createApp('hello', ['alpha']), root)
})

document.querySelector('#btn-add').addEventListener('click', () => {
    render(createApp('hello', ['alpha', 'beta', 'gamma']), root)
})
