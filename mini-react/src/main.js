import App from './App.jsx'
import createElement from './react.js'
import render from './render.js'

const root = document.querySelector('#app')
render(createElement(App, null), root)
