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

test('首次渲染使用 initial state', () => {
    function Counter() {
        const [count] = useState(0)
        return createElement('span', null, String(count))
    }
    const container = mount(createElement(Counter, null))
    assert.equal(serialize(container), '<div><span>0</span></div>')
})

test('setState 之后 state 还在，不会回到 initial', () => {
    /** @type {function} */
    let setCount
    function Counter() {
        const [count, set] = useState(0)
        setCount = set
        return createElement('span', null, String(count))
    }
    const container = mount(createElement(Counter, null))
    const span = container.childNodes[0]
    const text = span.childNodes[0]

    setCount(1)
    assert.equal(text.nodeValue, '1')
    assert.equal(container.childNodes[0], span)
    assert.equal(span.childNodes[0], text)

    setCount(2)
    assert.equal(text.nodeValue, '2')
    assert.equal(container.childNodes[0], span)
})

test('updater 函数拿到的是上一次的 state', () => {
    /** @type {function} */
    let setCount
    function Counter() {
        const [count, set] = useState(10)
        setCount = set
        return createElement('span', null, String(count))
    }
    const container = mount(createElement(Counter, null))

    setCount(n => n + 1)
    setCount(n => n + 1)
    assert.equal(serialize(container), '<div><span>12</span></div>')
})

test('同一组件里两个 useState 按调用顺序各记一份', () => {
    /** @type {function} */
    let setA
    /** @type {function} */
    let setB
    function Pair() {
        const [a, sa] = useState('A')
        const [b, sb] = useState('B')
        setA = sa
        setB = sb
        return createElement('span', null, a + b)
    }
    const container = mount(createElement(Pair, null))
    assert.equal(serialize(container), '<div><span>AB</span></div>')

    setA('X')
    assert.equal(serialize(container), '<div><span>XB</span></div>')
    setB('Y')
    assert.equal(serialize(container), '<div><span>XY</span></div>')
})

test('条件调用 hook 会读到另一条 hook 的 state', () => {
    /** @type {function} */
    let setTick
    let useSecond = true
    function Flip() {
        const [tick, set] = useState(0)
        setTick = set
        if (useSecond) {
            const [label] = useState('keep')
            return createElement('span', null, `${tick}:${label}`)
        }
        const [label] = useState('fresh')
        return createElement('span', null, `${tick}:${label}`)
    }
    const container = mount(createElement(Flip, null))
    assert.equal(serialize(container), '<div><span>0:keep</span></div>')

    useSecond = false
    setTick(1)
    assert.equal(serialize(container), '<div><span>1:keep</span></div>')
})

test('useState 在函数组件外调用会抛错', () => {
    assert.throws(
        () => useState(0),
        /只能在函数组件渲染时调用/
    )
})
