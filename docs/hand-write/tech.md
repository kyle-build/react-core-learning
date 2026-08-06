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

## 后续计划

- Step 3：Render / Commit 两阶段 —— `performUnitOfWork` 只建 fiber 树（`wipRoot`），不碰真实 DOM；整棵树建完后 `commitRoot` 递归一次性挂载，解决 Step 2 遗留的"半棵树"问题
- Step 4：Reconciliation —— 保留 `currentRoot`，新树用 `alternate` 指回旧 fiber，按 `effectTag`（PLACEMENT/UPDATE/DELETION）做 diff 和局部更新
- Step 5：函数组件 —— `fiber.type` 是函数时调用它拿 children，区分 `updateFunctionComponent` / `updateHostComponent`
- Step 6：useState —— fiber 挂 `hooks` 数组，`setState` 触发新一轮 render + diff
- Step 7（可选）：事件系统（onClick 等）、简单 useEffect