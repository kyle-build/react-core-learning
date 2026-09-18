# 手写 React 笔记

目标：从零实现一个 mini-react，覆盖 createElement / Fiber 循环 / render-commit / 协调 diff / 函数组件 / useState，最终对着真实 React 源码的思路走一遍。这个文档随实现进度持续更新，每个 Step 对应一次可运行的迭代。

## 初始化环境
```
yarn create vite
project-name: react-core-learning
Select a template: react
cd react-core-learning
yarn install
yarn run dev
```

## Step 0：手动构造 element 树 + 基础 DOM 渲染

index.html 是项目的入口文件，它包含了项目的 HTML 结构和脚本引用。
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```
加载 main.js，其实本质上都是操作 DOM：
```js
const div = document.createElement('div');
div.id = 'app';
div.style.color = 'red';
const text = document.createTextNode('Hello React!');
div.appendChild(text);
const root = document.querySelector('#app');
root.appendChild(div);
```

vite 会尝试解析 `const App = <div>test</div>`，然后调用 `react.createElement()` 把 JSX 编译成 element 对象。在真正实现 `createElement` 之前，先手写这个 object 来验证渲染逻辑：
https://react.dev/reference/react/createElement  这个对象的数据结构类型 
```js
const App = {
    type: 'div',
    props: {
        id: 'box',
        style: 'background-color: red;height:100px;width:100px',
        children:[
            {
                type:"TEXT_ELEMENT",
                props:{
                    nodeValue:"test",
                    children:[]
                }
            }
        ]
    }
}
// const App = <div>test</div>

export default App;
```

对应实现：
- `createDom.js`：根据 `element.type` 是否为 `TEXT_ELEMENT` 创建文本节点或普通 DOM 节点
- `render.js`：把 element 的 props 挂到 dom 上（`style` 特殊处理成 `cssText`，`children` 之外的 key 当普通属性），再递归渲染 children，最后 append 到容器

## Step 1：createElement，让 JSX 真正跑起来

**目标**：不再手写 element object，而是让 `<div>test</div>` 这种 JSX 编译后调用我们自己的 `createElement`，产出和 Step 0 手写对象完全一样的结构。

**实现（`react.js`）**：
```js
function createTextElement(text) {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: text,
            children: []
        }
    }
}

function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child)
            )
        }
    }
}

export { createTextElement }
export default createElement
```

**JSX 怎么接到自己的 createElement 上**：Vite 默认按 esbuild 的「自动运行时」编译 `.jsx`，会尝试 `import { jsx } from 'react/jsx-dev-runtime'`，因为项目里没装 react 会直接报错。需要在 `vite.config.js` 显式切回「经典转换」，让编译产物调用我们自己 import 进来的 `createElement`：
```js
import { defineConfig } from 'vite'

export default defineConfig({
    esbuild: {
        jsx: 'transform',       // 经典转换：<div/> -> createElement('div', ...)
        jsxFactory: 'createElement',
        jsxFragment: 'Fragment',
        jsxDev: false            // 关掉，否则会给每个节点注入 __self/__source 调试属性，混进 props 里
    }
})
```
每个写 JSX 的文件都要 `import createElement from './react.js'`（哪怕代码里没显式用到这个变量名，是给 JSX 编译产物用的）。

**踩坑记录**：
1. 不设置 `jsx:'transform'` 只设 `jsxFactory` 是不够的，esbuild 默认走自动运行时，照样会去找 `react/jsx-dev-runtime`。
2. `jsxDev` 不关掉的话，编译产物会给每个元素额外塞 `__self`、`__source` 两个 prop，`render.js` 里 `Object.keys(element.props)` 会把它们当成普通属性设置到 dom 上，虽然不影响显示但是干扰调试。
3. 本机 nvm 默认 node 是 18.20.4，Vite 8 要求 Node 20.19+/22.12+，起 dev server 前要 `nvm use 20`。

**验证方式**：
- `curl http://localhost:5173/src/App.jsx` 直接看 Vite 转译后的代码，确认调用的是 `createElement` 而不是 react 的运行时，且没有多余的调试属性
- 用一个最小的 `document` stub（假的 `createElement`/`createTextNode`）在 Node 里跑一遍 `createElement → render → createDom`，确认产出的树结构和 Step 0 手写的一致

### 原理答疑

**`createElement` 的入参/出参**
```js
function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === 'object' ? child : createTextElement(child)
            )
        }
    }
}
```
- 入参 `type`：标签名字符串，如 `'div'`
- 入参 `props`：JSX 标签上的属性对象；标签没写属性时编译产物会传 `null`（`...null` 展开等价于空对象，不会报错）
- 入参 `...children`：rest 参数，收集 `type`/`props` 之后所有实参，对应 JSX 标签内部的子节点（文本或嵌套 element）
- 函数体：把 `props` 展开后覆盖写入处理过的 `children` 字段；`children.map` 里判断每个 child——已经是 element 对象（`typeof === 'object'`）就原样保留，是字符串/数字这种原始值就用 `createTextElement` 包成 `{ type: 'TEXT_ELEMENT', props: { nodeValue, children: [] } }`
- 出参：一个 element 对象 `{ type, props: { ...原属性, children: [...] } }`
- 顺带一提返回值里的写法：`{ type, props: {...} }` 中单独出现的 `type` 是 ES6 对象属性简写，等价于 `type: type`——JS 会去当前作用域找同名变量（这里是形参 `type`）复用它的值；`props` 没用简写，是因为要赋的值不是形参 `props` 本身，而是"展开 `props` 再加一个处理过的 `children` 字段"之后的新对象，所以必须显式写 `props: {...}`。

**JSX 是谁解析的，解析结果是对象吗**——分两个阶段，容易混淆：
1. **编译时**（本项目由 Vite 内置的 esbuild 完成，其他技术栈常见的还有 Babel/`tsc`/swc）：只做语法转换，把 `<div id="box">test</div>` 这种非法 JS 语法转成合法的函数调用表达式 `createElement('div', { id: 'box' }, 'test')`。这一步的产物**还是源码文本**，还没执行，esbuild 也完全不知道 `createElement` 内部怎么实现。
2. **运行时**（JS 引擎执行编译产物）：真正调用到我们写的 `createElement` 函数，这时才会返回一个 element 对象。对象的形状完全由 `react.js` 自己决定，和编译器无关。

链路：`JSX 语法 --[esbuild 编译]--> createElement(...) 调用表达式（代码） --[JS 引擎执行]--> element 对象`

**怎么验证 `createElement`**（按颗粒度递增）：
1. 最快：`node -e` 里 `import` 后直接调用一次，`console.log(JSON.stringify(...))` 肉眼比对
2. 推荐：用 Node 自带的 `node:test` + `node:assert/strict` 写几个用例（不用装依赖），覆盖真正有分支的点——`props` 为 `null`、无 `children` 时应为空数组、字符串 child 要转 `TEXT_ELEMENT`、element child 不能被误转、多子节点顺序保持：
   ```js
   import { test } from 'node:test'
   import assert from 'node:assert/strict'
   import createElement from './react.js'

   test('无 props、纯文本 children', () => {
     const el = createElement('div', null, 'test')
     assert.deepEqual(el.props.children, [
       { type: 'TEXT_ELEMENT', props: { nodeValue: 'test', children: [] } }
     ])
   })

   test('嵌套 element 作为 child 时原样保留', () => {
     const child = createElement('span', null, 'inner')
     const parent = createElement('div', null, child)
     assert.equal(parent.props.children[0], child) // 引用相等，没被 createTextElement 包裹
   })
   ```
   跑：`node --test mini-react/src/react.test.js`
3. 集成层面：接上 `render.js` + DOM stub（或者 dev server + curl），确认端到端渲染结果也对

## Step 2：Fiber 架构 + 可中断渲染循环

**目标**：把 Step 0/1 里"递归 render，一路跑到底"的方式，改造成"基于 fiber 链表的可中断小任务循环"。页面视觉效果不变，纯内部机制重构，为后面的 diff / 函数组件 / hooks 打地基。

每一块新技术都是为了解决上一块方案暴露出的具体问题，串起来看：

**问题 1：递归 render 会长时间占用主线程**
`element.props.children.forEach(child => render(child, dom))` 这种写法一旦开始就必须把整棵树跑完才能返回，树很大的时候会连续占用主线程几十上百毫秒，期间用户点击、输入全都没反应（掉帧、卡顿）。
→ 需要把"一次性递归"换成"可以随时暂停、随时恢复"的渲染方式。

**问题 2：递归调用栈本身不可中断**
即使想暂停，普通函数递归的"进度"是存在 JS 调用栈里的，调用栈只能一路往下压栈或往上退栈，没法把"现在渲染到哪个节点了"这件事保存下来跨越事件循环、下一轮再恢复。
→ 需要把树形结构从"隐式的调用栈"改造成"显式的、可以存到变量里的数据结构"——这就是 **fiber**：给每个节点补上 `child`/`sibling`/`parent` 三个指针，把树变成一个可以顺着指针走的链表。遍历到哪个节点，只要把这个节点存进一个普通变量（`nextUnitOfWork`）里，中断和恢复都只是读写这个变量，不再依赖调用栈。
```js
// performUnitOfWork 返回下一个要处理的 fiber：
// 优先 child，没有就找 sibling，都没有就顺着 parent 往上找 parent 的 sibling
if (fiber.child) return fiber.child
let nextFiber = fiber
while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling
    nextFiber = nextFiber.parent
}
return undefined
```

**问题 3：怎么知道"浏览器现在有没有空"**
就算渲染工作可以拆成一个个小单元了，还需要知道什么时候该做、什么时候该让路给用户交互。
→ 用浏览器提供的 `requestIdleCallback(callback)`：只有主线程空闲时才会调用 `callback`，并传入一个 `deadline` 对象，`deadline.timeRemaining()` 能查询这一帧还剩多少空闲时间。
```js
function workLoop(deadline){
    let shouldYield = false
    while(nextUnitOfWork && !shouldYield){
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadline.timeRemaining() < 1   // 快没时间了，让出主线程
    }
    requestIdleCallback(workLoop)   // 排队等下一次空闲
}
requestIdleCallback(workLoop)
```

**实现落地**：
- `createDom.js`：把原来散在 `render.js` 里的 props 赋值逻辑（`isProperty`/`isStyle`）合并进来，`createDom(fiber)` 一步到位完成"建节点 + 设初始 props"，方便 `performUnitOfWork` 直接调用
- `render.js`：
  - `render(element, container)` 不再递归，只是把根 fiber `{ dom: container, props: { children: [element] } }` 塞进 `nextUnitOfWork`，交给 `workLoop` 异步处理
  - `performUnitOfWork(fiber)`：没有 dom 就用 `createDom` 建一个；有 `parent` 就把 dom 挂上去；遍历 `fiber.props.children`，给每个 element 建子 fiber 并串好 `child`/`sibling`/`parent`；最后返回下一个工作单元

**遗留问题（留给 Step 3）**：现在 `performUnitOfWork` 是"建一个 fiber 的 dom 就立刻 append 到父节点"，如果渲染中途被打断，用户会看到一棵没建完的"半棵树"——这在真实场景里是不可接受的。根源是"建树"和"挂载"这两件事目前混在一起做。下一步要解决的问题就是：**怎么保证用户永远只会看到"完整的一次渲染结果"，不会看到中间状态**——办法是把两阶段拆开，`performUnitOfWork` 只管在内存里把整棵 fiber 树建完（不碰真实 DOM），建完之后再一次性 `commitRoot` 挂到页面上。

这个问题不是靠推理，是真的复现过一次：造一棵 60×60（3600 个真实 JSX `<div>`，约 7000+ 个 fiber）的网格大树，再在 `performUnitOfWork` 里插一个人为的 `busyWait(0.5)`（忙等 0.5ms）把总渲染时间拉长到几秒——这样浏览器里就能亲眼看到页面从空白**一格一格地画出来**，中途任意一帧截下来都是一棵没建完的半棵树，直观对应上面说的问题。
```js
function busyWait(ms){
    const start = performance.now()
    while(performance.now() - start < ms){}
}
function performUnitOfWork(fiber){
    if(!fiber.dom){ fiber.dom = createDom(fiber) }
    busyWait(0.5)                        // 人为拉长单元耗时，让半棵树现象肉眼可见
    if(fiber.parent){ fiber.parent.dom.append(fiber.dom) }
    // ...
}
```

**验证方式**：
- Node 脚本里用 `setTimeout` 模拟 `requestIdleCallback`（保证真异步、不会同步递归炸栈），构造一棵故意做成两层嵌套 + 兄弟节点的树（`div > [span("a"), div > span("b")]`），专门验证 `child → sibling → 回溯 parent` 这条遍历路径，比对最终 DOM 树结构和内容
- dev server 正常起来，`render.js` 转译产物和页面请求都 200，无编译期报错
- 造一棵足够大的真实 JSX 树（如上），配合人为 `busyWait`，在浏览器里肉眼复现"半棵树"现象；同样这棵大树也用来实测 `shouldYield` 的让步阈值是否真的生效（见下方"为什么用 `< 1` 而不是 `<= 0`"）

### 原理答疑

**`workLoop(deadline)` 的 `deadline` 参数是谁传的**
```js
function workLoop(deadline){ ... }
requestIdleCallback(workLoop)
```
`requestIdleCallback(workLoop)` 只是把函数引用注册给浏览器，并没有立刻调用它。等主线程空闲时，浏览器会自己调用 `workLoop(idleDeadlineObj)`，把一个 `IdleDeadline` 对象作为参数传进来——这和 `addEventListener('click', handler)`、`setTimeout(cb, 1000)` 是同一种"注册回调，运行时环境负责在合适时机调用并传参"的模式。

`IdleDeadline` 对象包含：
- **`timeRemaining()`**：返回当前这次空闲窗口还剩多少毫秒可用，`workLoop` 里靠它判断要不要让出主线程
- **`didTimeout`**：布尔值，只有调用 `requestIdleCallback(cb, { timeout })` 时传了 `timeout` 选项，且浏览器迟迟没空闲、回调是被强制超时触发时才为 `true`。这里没用到

**`timeRemaining()` 最多能到 50ms，但一帧才 16.6ms（60fps），矛盾吗**
不矛盾，这是两个不同场景下的数字，不能直接比大小：
- **16.6ms** 是"浏览器每帧都有事要做"时的帧预算（有动画/rAF 循环/需要重绘的内容）。这种情况下浏览器必须按固定节奏产出帧，刨去布局绘制的必要工作，留给 idle callback 的时间通常远小于 16.6ms，甚至接近 0。刷新率越高（如 120Hz，帧预算 8.3ms），这个挤出来的空闲时间只会更紧张。
- **50ms** 是"页面这一刻没有必须产出下一帧"这件事时的独立安全上限（规范值，跟帧率无关）。没有动画、没有待渲染内容时，浏览器不受帧节奏约束，理论上可以空闲很久，但为了保证用户输入（点击/滚动）能被及时响应，规范规定单次 idle 回调最多也只给到 50ms，到点必须把主线程交还。

一句话：16.6ms 管的是"忙"的时候，50ms 管的是"闲"的时候，两者互不冲突。

**空闲时间到了但当前工作单元还没做完，会被强行打断吗**
不会，也做不到——JS 单线程，代码执行到一半没法被外部强行暂停。`workLoop` 的让出时机是**在两个工作单元之间检查**，不是在工作单元内部检查：
```js
while(nextUnitOfWork && !shouldYield){
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)   // 先把当前节点完整做完
    shouldYield = deadline.timeRemaining() < 1            // 做完之后才检查时间
}
requestIdleCallback(workLoop)
```
每次 `performUnitOfWork` 只处理一个 fiber 节点，做完才检查时间够不够，不够就把 `nextUnitOfWork`（模块作用域变量，天然是断点）留着，`while` 循环退出，外层重新 `requestIdleCallback(workLoop)` 排队。下次空闲时 `workLoop` 从 `nextUnitOfWork` 指向的节点继续，不会丢工作也不会重做。这就要求单个工作单元本身必须足够轻量（只建一个节点，不递归整棵子树），否则某次 `performUnitOfWork` 太慢，一样会一次性超时。

**这一套设计到底在防什么**
防止渲染退化成 **Long Task（长任务）**——浏览器性能领域的术语，指单次连续占用主线程超过 **50ms** 的同步任务（Chrome DevTools Performance 面板、`PerformanceObserver` 的 `longtask` API 都用 50ms 做阈值）。长任务期间用户点击/输入/滚动完全没有响应，页面会有明显卡顿。老版本 React（Stack Reconciler）就是同步递归遍历整棵树，树越大任务越长，直接退化成长任务；Fiber 把"遍历整棵树"拆成一个个节点级别的小工作单元，配合 `timeRemaining()` 主动让出，把单次占用主线程的时间死死限制在长任务阈值以下。

**为什么 `shouldYield = deadline.timeRemaining() < 1` 用 `1` 而不是 `<= 0` 或更大的数**
`1` 不是精确算出来的临界值，是一个经验性的**安全余量**。关键在于判断时机：`while` 循环里是"跑完一个工作单元之后才检查剩余时间"，不是"跑之前检查"。如果卡着等 `timeRemaining()` 精确归零才让步，那么最后一次判断"还没到 0，继续吧"之后，还会再完整跑一个 `performUnitOfWork`——这个单元本身有开销，很可能直接把预算顶穿，造成真实的"超支"（本次空闲窗口实际占用的时间 > 浏览器一开始给的预算）。留 `1ms` 缓冲，就是提前一点收手，用"损失一点点空闲时间利用率"换"不超支"。

这个结论是实测出来的，不是纯推理：造一棵 60×60（约 7000+ fiber）的真实 JSX 网格大树，给 `workLoop` 加运行时埋点，记录每次 `requestIdleCallback` 回调进入时浏览器给的 `initialBudget`、循环跑了多少次 `iterations`、回调实际花掉的墙钟时间 `elapsedWall`，用 `elapsedWall - initialBudget` 算出 `overBudget`：
```js
const YIELD_MARGIN = 1   // 对比实验时改成 0，看 overBudget 是否更容易 > 0

function workLoop(deadline){
    let shouldYield = false, iterations = 0, lastUnitCost = 0
    const callbackStart = performance.now()
    const initialBudget = deadline.timeRemaining()

    while(nextUnitOfWork && !shouldYield){
        const unitStart = performance.now()
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        lastUnitCost = performance.now() - unitStart
        iterations++
        shouldYield = deadline.timeRemaining() < YIELD_MARGIN
    }

    const elapsedWall = performance.now() - callbackStart
    const overBudget = elapsedWall - initialBudget   // > 0 就是真超支了
    console.log(`margin=${YIELD_MARGIN} iterations=${iterations} lastUnitCost=${lastUnitCost.toFixed(3)}ms initialBudget=${initialBudget.toFixed(2)}ms elapsedWall=${elapsedWall.toFixed(2)}ms overBudget=${overBudget.toFixed(2)}ms`)
    requestIdleCallback(workLoop)
}
```
把 `YIELD_MARGIN` 分别设成 `1` 和 `0` 跑同一棵树、对比 `overBudget` 是否更容易变正数，就能直接看出这个安全余量是否真的有必要，而不是凭感觉猜。

（旁注：真实 React 的 Scheduler 包后来放弃了 `requestIdleCallback`——因为不同浏览器/场景下它的调度行为很不稳定，且 Safari 至今不支持——改用 `MessageChannel` 自己实现了一套时间分片调度。mini-react 这里用 `requestIdleCallback` 只是为了更直观地理解"可中断渲染"这个思路本身。）

## Step 3：Render / Commit 两阶段

**目标**：解决 Step 2 遗留的"半棵树"问题——让 `performUnitOfWork` 只在内存里建 fiber 树、完全不碰真实 DOM，整棵树建完之后再由 `commitRoot` 一次性挂载。用户要么看到上一次的完整结果，要么看到这一次的完整结果，永远不会看到中间态。

**问题 1：可中断 和 直接改 DOM 是天然冲突的**
Step 2 的 `performUnitOfWork` 里，"建 dom"和"append 到父节点"是连在一起做的。而工作循环随时可能在两个工作单元之间让出主线程——让出的那一刻，浏览器就会拿着"已经挂上去的一部分节点"去绘制。渲染越慢，这个半成品被看到的窗口越大（Step 2 里靠 `busyWait` 已经实测复现过）。
→ 只要真实 DOM 是在可中断的过程中被逐步修改的，中间态就必然会被看见。**唯一的出路是让可中断的那部分工作不产生任何可见副作用。**

**问题 2：那"挂载"这件事挪到哪里去**
挂载必须发生在"整棵树都建完"这个确定的时间点上，而且它自己不能再被中断——否则又退化成问题 1。
→ 把渲染拆成两个阶段，它们的可中断性正好相反：

```
render 阶段（可中断、无副作用）      commit 阶段（同步、不可中断、有副作用）
performUnitOfWork 逐个建 fiber   -->  整棵树建完  -->  commitRoot 递归 append
      ↑ 随时可以让出主线程                                    ↑ 一口气做完
```

commit 阶段之所以敢同步做，是因为它只剩纯粹的 DOM 操作，没有 diff、没有组件计算，耗时远小于 render 阶段。真实 React 也是这么划分的。

**问题 3：树建完了，怎么知道根在哪**
`nextUnitOfWork` 会随着遍历一路往下走，走完就变成 `undefined`，拿不到树根了。
→ 额外用一个 `wipRoot`（work in progress root）变量把本轮渲染的根 fiber 存住，它既是"当前有没有一棵待提交的树"的标志位，也是 commit 阶段的入口。

**实现（`render.js`）**：

```js
let nextUnitOfWork = null   // 渲染进度断点
let wipRoot = null          // 本轮正在内存里构建、还没挂载的根 fiber

function render(element, container){
    wipRoot = {
        dom: container,
        props: { children: [element] }
    }
    nextUnitOfWork = wipRoot
    scheduleWorkLoop()
}

function performUnitOfWork(fiber){
    buildDom(fiber)          // 只建节点，不 append
    elementToLinklist(fiber) // 建子 fiber 链表
    // ...child -> sibling -> 回溯 parent
}

function workLoop(deadline){
    while(nextUnitOfWork && !shouldYield){ /* ... */ }
    // nextUnitOfWork 为空 = 整棵树建完了，且确实有一棵待提交的树
    if(!nextUnitOfWork && wipRoot){
        commitRoot()
    }
}

function commitRoot(){
    commitWork(wipRoot.child)
    wipRoot = null           // 提交完清空，避免重复提交
}

function commitWork(fiber){
    if(!fiber) return
    if(fiber.parent){ fiber.parent.dom.append(fiber.dom) }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}
```

注意 `commitWork` 这里用的是**普通递归**，和 Step 2 极力避免的递归看起来矛盾，其实不然：Step 2 要拆掉递归是因为那个过程需要可中断，而 commit 恰恰要求不可中断，用递归反而更简单直接。

**顺带做的一处调度优化**：Step 2 里 `workLoop` 结尾无条件 `requestIdleCallback(workLoop)`，即使没有任何渲染任务也会一直空转排队。改成按需调度——`render()` 时启动，`workLoop` 结束时只有 `nextUnitOfWork` 还在才继续排队，并用 `isLoopScheduled` 防止重复注册：

```js
let isLoopScheduled = false

function scheduleWorkLoop(){
    if(isLoopScheduled) return
    isLoopScheduled = true
    requestIdleCallback(workLoop)
}

function workLoop(deadline){
    isLoopScheduled = false
    // ...
    if(nextUnitOfWork) scheduleWorkLoop()
}
```

**踩坑记录**：
1. `commitRoot` 里从 `wipRoot.child` 开始而不是 `wipRoot` 本身。根 fiber 的 `dom` 就是外部传进来的容器（已经在页面上了），它没有 `parent`，从它开始只会白走一层。
2. `commitRoot` 之后必须把 `wipRoot` 置为 `null`。否则 `workLoop` 下一次被调用时 `nextUnitOfWork` 依旧为空、`wipRoot` 依旧有值，会把同一棵树反复 append 一遍（DOM 的 `append` 对已挂载节点是移动而非复制，现象是节点顺序错乱而不是变多，更难排查）。
3. 判断条件要写成 `!nextUnitOfWork && wipRoot` 两个都判。只判 `!nextUnitOfWork` 的话，页面空闲、根本没有渲染任务时也会进 `commitRoot`，直接在 `wipRoot.child` 上报空指针。
4. 调试用的 `busyWait` / `console.log` 从这一步开始集中收进 `debug.js` 的 `debugConfig` 开关，默认全关。之前直接写死在 `performUnitOfWork` 和 `createDom` 里，每次调试都要改源码、还容易误提交。

**验证方式**：
- 在 Node 里用 DOM stub（假的 `createElement`/`createTextNode`/`append`）跑一棵 `div > [span("a"), div > span("b")]` 的树，重点断言两件事：`render()` 同步返回后容器的子节点数必须为 **0**（证明 render 阶段确实没有副作用），异步跑完后再比对最终树结构和内容。
- 用 `setTimeout` 模拟 `requestIdleCallback`，跑完后进程能自然退出——反证按需调度生效了，没有残留的无限排队。
- 浏览器里打开 `debug.js` 的 `slowUnitMs: 0.5` 再渲染 60×60 大树：页面应当空白几秒后**整块一次性出现**，而不再是 Step 2 那样一格一格画出来。这是和 Step 2 最直接的对照实验。

**遗留问题（留给 Step 4）**：现在每次 `render` 都是从零建一棵全新的 fiber 树、把整个容器重新挂一遍，等于全量重渲染。数据变了要更新界面时，代价是整棵树重建 + 整棵树重挂，而且旧节点上的状态（比如输入框里已经打的字）会全部丢失。根源是**我们从来没有保留过上一次渲染的结果，也就无从比较**。下一步要解决的问题是：**怎么只更新真正变化的那部分**——办法是提交完把这棵树存成 `currentRoot`，下次渲染时新 fiber 通过 `alternate` 指回对应的旧 fiber，逐个比对后打上 `effectTag`（PLACEMENT / UPDATE / DELETION），commit 阶段按 tag 分别处理。

## Step 4：Reconciliation，按 type 做增量更新

**目标**：第二次 `render()` 不再拆掉整棵 DOM。`type` 相同的节点复用原来的 `dom` 只改 props，少了的摘掉，多了的新建。这一步仍然只有 host 组件（`div` / `h1` / 文本），二次渲染由外部手动调用 `render` 触发，不引入函数组件、hooks 或事件系统。

**问题 1：提交完就把树扔了，无从比较**
Step 3 的 `commitRoot` 在挂载后立刻 `wipRoot = null`。下一轮 `render` 只能再造一棵全新的 fiber，每个节点 `dom: null`，commit 再 `appendChild` 一遍。同位置的 `<h1>` 其实还是那个 `<h1>`，却被当成新节点。
→ 提交完把这棵树存成 `currentRoot`。下一轮 `wipRoot.alternate = currentRoot`，新 fiber 才能找到「上一次的自己」。

**问题 2：可中断的 render 阶段仍然不能碰可见 DOM**
比较必须发生在 `performUnitOfWork` 里，但这一阶段随时会让出主线程。如果一边 diff 一边 `append` / `remove`，又会回到 Step 2 的半棵树。
→ render 阶段只打标记：`effectTag` 为 `PLACEMENT` / `UPDATE` / `DELETION`。真正改 DOM 仍集中在 commit。

**问题 3：被删的 fiber 不在新树上**
新 fiber 链表是按新 `element` 建的。旧树里多出来的那个 `<li>` 没有对应的新 fiber，commit 若只走 `wipRoot.child` 会漏掉删除。
→ 单独用 `deletions` 数组把旧 fiber 带到 commit，先处理删除再处理新树。

链路：`currentRoot` --[alternate]--> 新 wip fiber --[按 index 比 type]--> `effectTag` --[commit 按 tag 改 DOM]--> 新的 `currentRoot`

**实现（`render.js` / `createDom.js`）**：

`render` 起一轮新树时挂上 alternate，并清空 `deletions`：

```js
function render(element, container) {
    wipRoot = {
        dom: container,
        props: { children: [element] },
        alternate: currentRoot
    }
    deletions = []
    nextUnitOfWork = wipRoot
    scheduleWorkLoop()
}
```

`elementToLinklist` 换成 `reconcileChildren`：新旧两条链表按 index 齐头并进。`type` 相同则复用 `dom` 打 `UPDATE`；有新 element 但 type 不同打 `PLACEMENT`；有旧 fiber 但 type 不同打 `DELETION` 推进数组。

```js
if (sameType) {
    newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: UPDATE
    }
}
```

`commitRoot` 先提交 `deletions`，再提交新树，最后 `currentRoot = wipRoot`：

```js
function commitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}
```

`createDom.js` 抽出 `updateDom(dom, prevProps, nextProps)`：`createDom` 是 `updateDom(dom, {}, props)`，`UPDATE` 则拿 `fiber.alternate.props` 当 prev。`style` 继续走 `cssText`，文本走 `nodeValue`。

演示页不把按钮放进 mini-react 树里。`index.html` 里 `#app` 外面的原生按钮直接再调一次 `render(createApp(...), root)`，三个按钮分别对应 UPDATE / DELETION / PLACEMENT。动态列表用 `createElement('ul', null, ...items.map(...))` 展开，避免 JSX `{items.map}` 变成单个 array child。

**踩坑记录**：
1. **删掉的节点 commit 时找不到** → 它们不在新 fiber 树上，必须靠 `deletions` 额外带过去。只走 `commitWork(wipRoot.child)` 会留下残 DOM。
2. **DELETION 之后如果继续递归 `child` / `sibling`** → 旧子树上还留着上一轮的 `effectTag`，会对着已经离开文档的节点再 `removeChild` / `updateDom`，直接抛错。host 组件删掉当前节点即可，子树随父节点离开文档。
3. **`commitRoot` 仍把 `wipRoot` 置 `null`，但必须另存 `currentRoot`** → 只清 `wipRoot` 的话下一轮又回到「无从比较」。
4. **模块级 `currentRoot` 是单例** → 两个测试共用一次 `import` 会串树。`reset()` 只为测试隔离存在，生产路径用不到。
5. **JSX `{items.map(i => <li>{i}</li>)}` 会变成一个 array 类型的 child** → `createElement` 还不拍平数组。演示和测试都用 rest 参数展开，这个问题留给以后专门做 `flatten`。

**验证方式**：
1. 最快：`cd mini-react && node --test test/createElement.test.js test/reconcile.test.js`。`reconcile.test.js` 里三个独立用例分别钉死 UPDATE（DOM 引用不变、文本变）、DELETION（少一个 `li`）、PLACEMENT（尾部多一个 `li`），外加 type 变化时旧节点被替换。
2. 测试用同步 `requestIdleCallback` polyfill（`timeRemaining` 恒为 50）+ DOM stub，不依赖浏览器。每个用例 `beforeEach(reset)`，容器是新的 stub 节点。
3. 浏览器：`yarn dev` 后点三个按钮。改标题时红盒子不应闪一下重建；删/加 `li` 时其余项保持原位。

### 原理答疑

**`alternate` 是什么**
同一位置上「正在建的这棵树」和「屏幕上那棵树」的配对指针。新 fiber 通过它读到旧 `dom`、旧 `props`。commit 结束后 `currentRoot` 指向刚才的 wip 树，原来的 current 被丢掉，等下一轮再反过来当 alternate。这就是双缓存的最小版。

**为什么现在按 index 配对，不按 key**
这一步只证明「能 diff」。`oldFiber` 和 `elements[index]` 对齐，类型相同就当成同一个节点。所以 `[A, B]` 变成 `[B]` 时，index 0 会拿旧 A 去对新年 B——若两者都是 `li`，会被误判成 UPDATE，旧 A 的 DOM 改成 B 的文本，旧 B 再 DELETION。这正是 key 要解决的问题，放到阶段二单独做，避免和「第一次能增量更新」混在一个 Step 里。

**遗留问题（留给 Step 5）**：现在 `fiber.type` 只能是字符串（标签名或 `TEXT_ELEMENT`）。还不能写函数组件，也就没有组件自己的「实例」去接 `useState`。下一步要在 `performUnitOfWork` 里识别函数 type、调用它拿到 children；函数组件 fiber **没有自己的 dom**，commit 的 append / 删除都要向上找到最近的 host 祖先。

## Step 5：函数组件

**目标**：`fiber.type` 可以是函数。组件自己不占一层 DOM，返回的 host 树照样能挂上、更新、删掉。这一步仍然靠外部手动 `render` 触发更新，不引入 hooks。

**问题 1：host 组件和函数组件的「孩子从哪来」根本不是一回事**
`div` 的 children 写在 `props.children` 里；`function App(props) { return <div/> }` 的 children 是函数的**返回值**。如果继续无脑 `createDom(fiber)`，`document.createElement(App)` 会把函数当成标签名，直接坏掉。
→ `performUnitOfWork` 按 `typeof fiber.type === 'function'` 拆成两条路径。

```
host：createDom + reconcile(props.children)
函数：children = [fiber.type(fiber.props)] + reconcile(children)
```

函数每次作为工作单元被处理时都会重新调用一遍，返回值再交给 Step 4 的 `reconcileChildren` 去打 tag。`sameType` 比的是函数引用：同一个 `App` 就是 UPDATE，换了另一个函数就是拆掉重建。

**问题 2：函数组件没有 .dom，commit 不能再写 `fiber.parent.dom`**
```
#app（根，有 dom）
  └─ App（函数，dom = null）
       └─ div#box（host，有 dom）   ← 真正要 append 的节点
            └─ Title（函数，dom = null）
                 └─ h1（host）
```
`div#box` 的 parent 是 App，App 没有 `.dom`。继续 `fiber.parent.dom.appendChild` 会报错。
→ 挂载/更新时沿 `parent` 往上走到第一个带 `.dom` 的 fiber（host 或根容器），把它当 DOM 父节点。函数组件自己的 PLACEMENT / UPDATE 是空操作，只递归 child / sibling。

**问题 3：删掉的是函数组件时，页面上要摘的是它底下的 host 节点**
`Item` 被 DELETION 时，`Item.dom` 是 `null`，`removeChild` 没东西可摘，`<li>` 会留在文档里。
→ `commitDeletion` 自己有 `.dom` 就摘掉（子树随节点离开）；否则只走**它自己的 child 链表**，不能走 `sibling`——那是父节点的其他孩子，不在这次删除范围内。

链路：`function type --[调用]--> 返回的 element --[reconcile]--> 子 fiber --[commit 跳过空 .dom]--> 挂到最近的 host 祖先`

**实现（`render.js`）**：

```js
function performUnitOfWork(fiber) {
    if (typeof fiber.type === 'function') {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }
    // child -> sibling -> 回溯 parent，和 Step 2 一样
}

function updateFunctionComponent(fiber) {
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    reconcileChildren(fiber, fiber.props.children ?? [])
}
```

commit 阶段找 host 父节点、删除时向下找 host 子节点：

```js
function findHostParentDom(fiber) {
    let parent = fiber.parent
    while (parent && !parent.dom) {
        parent = parent.parent
    }
    return parent && parent.dom
}

function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
        return
    }
    let child = fiber.child
    while (child) {
        commitDeletion(child, domParent)
        child = child.sibling
    }
}
```

演示页把 `createApp(...)` 换成真正的函数组件：`render(createElement(App, { title, items }), root)`。`App` 里面再嵌一个 `Title`，用来确认「函数套函数」也不会多出一层 DOM。按钮仍然在 `#app` 外面，用原生监听触发第二次 render。

**踩坑记录**：
1. **函数返回值必须包成数组再交给 `reconcileChildren`** → `reconcileChildren` 按 `elements.length` 和 index 遍历。直接把返回的 element 对象传进去，`.length` 是 `undefined`，循环根本不会跑，页面空白。
2. **`commitDeletion` 不能递归删除 fiber 的 sibling** → 被删的是 `Item(beta)` 时，它的 sibling 是还要留着的 `Item(alpha)`。走 sibling 会把不该删的节点一起摘掉。只遍历被删节点自己的 child 链表。
3. **`fiber.parent.dom` 在函数组件出现后不再安全** → parent 可能是函数组件。PLACEMENT / DELETION 都改成 `findHostParentDom`。
4. **`sameType` 比的是函数引用** → 每次 render 都写 `function Title(){}` 会得到新的函数对象，全部被当成 PLACEMENT + DELETION，DOM 无法复用。组件定义必须稳定（模块顶层，或测试里提到外面）。

**验证方式**：
1. 最快：`cd mini-react && yarn test`。`function-component.test.js` 钉死四件事：函数返回的 host 树能挂上且 `container` 下没有多余包装节点；`Outer → Title → h1` 嵌套后 DOM 仍是一层 `h1`；同函数二次 render 复用 `h1`/文本节点只改 `nodeValue`；`ul` 里两个 `Item` 函数组件删掉一个时，对应 `li` 被摘掉、剩下的 DOM 引用不变。
2. 原有 `reconcile.test.js` 仍然全是 host 组件，用来确认拆分 `updateHostComponent` 没有把 Step 4 弄坏。
3. 浏览器：`yarn dev` 后页面结构和 Step 4 一样。改标题时红盒子不重建；删/加 `li` 其余项保持原位。DOM 里看不到 App / Title 对应的节点。

### 原理答疑

**函数组件的 fiber 为什么没有 .dom**
它不是浏览器认识的标签，只是「根据 props 算出下一棵 element 树」的函数。真正进文档的是它 return 出来的 host 节点。fiber 仍然在链表里占一个位置（有 parent / child / sibling / alternate），这样 reconcile 才能按组件粒度配对，只是 commit 时看见 `.dom == null` 就跳过。

**那 hooks 以后挂在哪**
挂在这个「没有 dom 的 fiber」上，而不是挂在函数闭包里。函数每次 `updateFunctionComponent` 都会重新执行，闭包里的局部变量留不住；fiber 对象在 UPDATE 时通过 `alternate` 活过一轮。这是 Step 6 的入口。

**遗留问题（留给 Step 6）**：函数组件能渲染了，但还没有自己的状态。现在要变界面只能从外面再调一次 `render(createElement(App, newProps), root)`。下一步要在函数组件 fiber 上挂 `hooks` 数组，靠 `hookIndex` 定位；`setState` 以 `currentRoot` 为 alternate 起一轮新 render，这样组件内部就能自己触发更新。

## 后续计划

每个未做的 Step 仍然保持「一块能力、一套能单独跑的测试」，不把两件只能分开验证的事捆在一起。

### 阶段一：补齐渲染闭环（Step 6 - 8）

- ~~**Step 5：函数组件**~~（已完成）
- **Step 6：useState** —— fiber 上挂 `hooks` 数组，靠 `hookIndex` 定位；`setState` 以 `currentRoot` 为 alternate 起一轮新 render。单独测试：连续两次 `setState` 能留下 state；条件调用 hook 会错位（用来解释规则）。
- **Step 7：事件系统** —— `on` 开头的 prop 走 `addEventListener`，UPDATE 时先卸旧监听再绑新的。单独测试：click 能调到最新 handler，节点删除后监听不泄漏。
- **Step 8：useEffect** —— commit 后执行，依赖数组比对，有 cleanup。单独测试：依赖不变不重跑；节点删除时 cleanup 会执行。

走完这三步的验收标准：能跑通一个真实的 TodoList（输入、添加、删除、勾选），且输入框内容在重渲染后不丢失。

### 阶段二：工程化细节

- key 的 diff 策略（Step 4 按 index 配对，做完正好能讲清楚 key 为什么重要）
- `createElement` 拍平 array child（现在 JSX `map` 会踩这个坑）
- `useMemo` / `useRef` / `useContext`
- 批处理：多次 `setState` 合并成一次 render

### 阶段三：对照真实 React 源码

不再手写，把 mini-react 当参照系去读 React 18：Lane 优先级模型、`scheduler` 包为什么弃用 `requestIdleCallback` 改用 `MessageChannel`、Fiber 双缓存、`beginWork` / `completeWork` 的分工。产出为文档。

### 贯穿全程

- 每个 Step 完成后立刻补本文档对应章节，不要让文档落后于代码
- 自动化测试用 Node 自带的 `node --test`，不额外装框架；每个新 Step 至少带一组能单独跑、不依赖浏览器的用例