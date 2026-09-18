import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, serialize } from './dom-stub.js'
import createElement, { useState } from '../src/react.js'
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

function click(node) {
    node.dispatchEvent({ type: 'click' })
}

test('onClick 能触发 handler', () => {
    let calls = 0
    function Button() {
        return createElement('button', { onClick: () => { calls++ } }, 'inc')
    }
    const container = mount(createElement(Button, null))
    click(container.childNodes[0])
    assert.equal(calls, 1)
})

test('二次 render 后 click 走的是最新 handler，不会停在旧闭包', () => {
    function Counter() {
        const [count, setCount] = useState(0)
        return createElement(
            'button',
            { onClick: () => setCount(count + 1) },
            String(count)
        )
    }
    const container = mount(createElement(Counter, null))
    const button = container.childNodes[0]

    click(button)
    assert.equal(button.childNodes[0].nodeValue, '1')
    click(button)
    assert.equal(button.childNodes[0].nodeValue, '2')
    assert.equal(container.childNodes[0], button)
})

test('去掉 onClick 之后旧监听不再触发', () => {
    let calls = 0
    function Maybe({ enabled }) {
        const props = enabled ? { onClick: () => { calls++ } } : null
        return createElement('button', props, 'x')
    }
    const container = mount(createElement(Maybe, { enabled: true }))
    const button = container.childNodes[0]
    click(button)
    assert.equal(calls, 1)

    render(createElement(Maybe, { enabled: false }), container)
    click(button)
    assert.equal(calls, 1)
})

test('节点删除后，旧 DOM 上的监听被卸掉', () => {
    let calls = 0
    function Wrap({ show }) {
        if (!show) {
            return createElement('span', null, 'gone')
        }
        return createElement('button', { onClick: () => { calls++ } }, 'x')
    }
    const container = mount(createElement(Wrap, { show: true }))
    const button = container.childNodes[0]
    click(button)
    assert.equal(calls, 1)

    render(createElement(Wrap, { show: false }), container)
    click(button)
    assert.equal(calls, 1)
    assert.equal(serialize(container), '<div><span>gone</span></div>')
})
