import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, serialize } from './dom-stub.js'
import createElement, { useState, useEffect } from '../src/react.js'
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

test('effect 在 commit 之后才跑，不在 render 阶段跑', () => {
    const log = []
    function Comp() {
        useEffect(() => {
            log.push('effect')
        })
        log.push('render')
        return createElement('span', null, 'x')
    }
    mount(createElement(Comp, null))
    assert.deepEqual(log, ['render', 'effect'])
})

test('deps 是空数组时只在挂载时跑一次', () => {
    let runs = 0
    /** @type {function} */
    let setCount
    function Comp() {
        const [count, set] = useState(0)
        setCount = set
        useEffect(() => {
            runs++
        }, [])
        return createElement('span', null, String(count))
    }
    mount(createElement(Comp, null))
    assert.equal(runs, 1)
    setCount(1)
    assert.equal(runs, 1)
})

test('deps 变了才重跑，重跑前先执行上一轮 cleanup', () => {
    const log = []
    /** @type {function} */
    let setCount
    function Comp() {
        const [count, set] = useState(0)
        setCount = set
        useEffect(() => {
            log.push('effect:' + count)
            return () => {
                log.push('cleanup:' + count)
            }
        }, [count])
        return createElement('span', null, String(count))
    }
    mount(createElement(Comp, null))
    assert.deepEqual(log, ['effect:0'])
    setCount(1)
    assert.deepEqual(log, ['effect:0', 'cleanup:0', 'effect:1'])
})

test('无关 state 更新且 deps 不变时不重跑', () => {
    let effectRuns = 0
    /** @type {function} */
    let setOther
    function Comp() {
        const [count] = useState(0)
        const [other, set] = useState(0)
        setOther = set
        useEffect(() => {
            effectRuns++
        }, [count])
        return createElement('span', null, String(other))
    }
    mount(createElement(Comp, null))
    assert.equal(effectRuns, 1)
    setOther(1)
    assert.equal(effectRuns, 1)
})

test('函数组件卸载时执行 cleanup', () => {
    let cleanups = 0
    /** @type {function} */
    let setShow
    function Child() {
        useEffect(() => {
            return () => {
                cleanups++
            }
        }, [])
        return createElement('span', null, 'child')
    }
    function Parent() {
        const [show, set] = useState(true)
        setShow = set
        return show
            ? createElement(Child, null)
            : createElement('span', null, 'gone')
    }
    const container = mount(createElement(Parent, null))
    assert.equal(cleanups, 0)
    setShow(false)
    assert.equal(cleanups, 1)
    assert.equal(serialize(container), '<div><span>gone</span></div>')
})

test('useEffect 在函数组件外调用会抛错', () => {
    assert.throws(
        () => useEffect(() => {}),
        /只能在函数组件渲染时调用/
    )
})
