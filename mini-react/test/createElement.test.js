import { test } from 'node:test'
import assert from 'node:assert/strict'
import createElement from '../src/react.js'

test('无 props、纯文本 children', () => {
    const el = createElement('div', null, 'test')
    assert.deepEqual(el, {
        type: 'div',
        props: {
            children: [
                { type: 'TEXT_ELEMENT', props: { nodeValue: 'test', children: [] } }
            ]
        }
    })
})

test('嵌套 element 作为 child 时原样保留', () => {
    const child = createElement('span', null, 'inner')
    const parent = createElement('div', null, child)
    assert.equal(parent.props.children[0], child)
})

test('多子节点保持顺序，数字也会转成文本节点', () => {
    const el = createElement('ul', { id: 'list' }, 'a', 1)
    assert.equal(el.props.id, 'list')
    assert.equal(el.props.children[0].props.nodeValue, 'a')
    assert.equal(el.props.children[1].props.nodeValue, '1')
})
