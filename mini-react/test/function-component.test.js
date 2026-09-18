import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, serialize } from './dom-stub.js'
import createElement from '../src/react.js'
import render, { reset } from '../src/render.js'

before(() => {
    installDomStub()
})

beforeEach(() => {
    reset()
})

function mount(element) {
    const container = document.createElement('div')
    render(element, container)
    return container
}

function Title({ text }) {
    return createElement('h1', null, text)
}

function App({ title, items = [] }) {
    return createElement(
        'div',
        { id: 'box' },
        createElement(Title, { text: title }),
        createElement(
            'ul',
            null,
            ...items.map(item => createElement('li', null, item))
        )
    )
}

test('函数组件返回的 host 树能挂上，且自己不占一层 DOM', () => {
    const container = mount(createElement(App, { title: 'hello', items: ['alpha'] }))
    assert.equal(
        serialize(container),
        '<div><div id="box"><h1>hello</h1><ul><li>alpha</li></ul></div></div>'
    )
    assert.equal(container.childNodes.length, 1)
    assert.equal(container.childNodes[0].type, 'div')
})

test('嵌套函数组件同样不产生 DOM 节点', () => {
    function Outer() {
        return createElement(Title, { text: 'nested' })
    }
    const container = mount(createElement(Outer, null))
    assert.equal(serialize(container), '<div><h1>nested</h1></div>')
    assert.equal(container.childNodes[0].type, 'h1')
})

test('同函数二次 render 复用 host DOM，只改文本', () => {
    const container = mount(createElement(Title, { text: 'hello' }))
    const heading = container.childNodes[0]
    const text = heading.childNodes[0]

    render(createElement(Title, { text: 'hello updated' }), container)

    assert.equal(container.childNodes[0], heading)
    assert.equal(heading.childNodes[0], text)
    assert.equal(text.nodeValue, 'hello updated')
})

test('删掉函数组件时，能顺着它找到 host 子节点并摘掉', () => {
    function Item({ text }) {
        return createElement('li', null, text)
    }
    const container = mount(
        createElement(
            'ul',
            null,
            createElement(Item, { text: 'alpha' }),
            createElement(Item, { text: 'beta' })
        )
    )
    const list = container.childNodes[0]
    const firstItem = list.childNodes[0]

    render(
        createElement('ul', null, createElement(Item, { text: 'alpha' })),
        container
    )

    assert.equal(list.childNodes.length, 1)
    assert.equal(list.childNodes[0], firstItem)
    assert.equal(serialize(container), '<div><ul><li>alpha</li></ul></div>')
})
