let seq = 0

export class StubElement {
    constructor(type) {
        this.nodeType = 1
        this.type = type
        this.tagName = String(type).toUpperCase()
        this.childNodes = []
        this.style = { cssText: '' }
        this.parentNode = null
        this.__id = ++seq
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child)
        }
        this.childNodes.push(child)
        child.parentNode = this
        return child
    }

    removeChild(child) {
        const i = this.childNodes.indexOf(child)
        if (i === -1) {
            throw new Error('removeChild: node not found')
        }
        this.childNodes.splice(i, 1)
        child.parentNode = null
        return child
    }
}

export class StubText {
    constructor(value) {
        this.nodeType = 3
        this.nodeValue = value
        this.childNodes = []
        this.parentNode = null
        this.__id = ++seq
    }
}

export function installDomStub() {
    seq = 0
    globalThis.document = {
        createElement(type) {
            return new StubElement(type)
        },
        createTextNode(value) {
            return new StubText(value)
        }
    }
    globalThis.requestIdleCallback = (cb) => {
        cb({
            timeRemaining: () => 50,
            didTimeout: false
        })
    }
}

export function serialize(node) {
    if (!node) {
        return ''
    }
    if (node.nodeType === 3) {
        return node.nodeValue ?? ''
    }
    const inner = node.childNodes.map(serialize).join('')
    const id = node.id ? ` id="${node.id}"` : ''
    return `<${node.type}${id}>${inner}</${node.type}>`
}
