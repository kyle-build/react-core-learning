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

test('首次 render 整棵挂上（PLACEMENT）', () => {
    const container = mount(
        createElement('div', { id: 'box' }, createElement('h1', null, 'hello'))
    )
    assert.equal(
        serialize(container),
        '<div><div id="box"><h1>hello</h1></div></div>'
    )
})

test('同 type 二次 render 复用 DOM，只改文本（UPDATE）', () => {
    const container = mount(createElement('h1', null, 'hello'))
    const heading = container.childNodes[0]
    const text = heading.childNodes[0]

    render(createElement('h1', null, 'hello updated'), container)

    assert.equal(container.childNodes[0], heading)
    assert.equal(heading.childNodes[0], text)
    assert.equal(text.nodeValue, 'hello updated')
    assert.equal(serialize(container), '<div><h1>hello updated</h1></div>')
})

test('少一个子节点时摘掉多余 DOM（DELETION）', () => {
    const container = mount(
        createElement(
            'ul',
            null,
            createElement('li', null, 'alpha'),
            createElement('li', null, 'beta')
        )
    )
    const list = container.childNodes[0]
    const firstItem = list.childNodes[0]

    render(
        createElement('ul', null, createElement('li', null, 'alpha')),
        container
    )

    assert.equal(list.childNodes.length, 1)
    assert.equal(list.childNodes[0], firstItem)
    assert.equal(serialize(container), '<div><ul><li>alpha</li></ul></div>')
})

test('多一个子节点时只新建尾部（PLACEMENT）', () => {
    const container = mount(
        createElement('ul', null, createElement('li', null, 'alpha'))
    )
    const list = container.childNodes[0]
    const firstItem = list.childNodes[0]

    render(
        createElement(
            'ul',
            null,
            createElement('li', null, 'alpha'),
            createElement('li', null, 'gamma')
        ),
        container
    )

    assert.equal(list.childNodes.length, 2)
    assert.equal(list.childNodes[0], firstItem)
    assert.equal(serialize(container), '<div><ul><li>alpha</li><li>gamma</li></ul></div>')
})

test('type 不同时丢掉旧节点再建新节点', () => {
    const container = mount(createElement('div', { id: 'box' }, 'x'))
    const oldNode = container.childNodes[0]

    render(createElement('span', { id: 'box' }, 'x'), container)

    assert.notEqual(container.childNodes[0], oldNode)
    assert.equal(container.childNodes[0].type, 'span')
    assert.equal(serialize(container), '<div><span id="box">x</span></div>')
})
