# mini-react

从零手写的 React 实现，用来搞清楚 React 的渲染机制到底是怎么跑起来的。每个 Step 对应一次可运行、可单独测试的迭代，配套的实现笔记在 [`docs/hand-write/tech.md`](../docs/hand-write/tech.md)。

## 运行

需要 Node 20.19+ 或 22.12+（Vite 8 的要求）。

```bash
nvm use 20
yarn install
yarn dev
```

```bash
yarn test
```

## 当前进度

| Step | 内容 | 状态 |
| --- | --- | --- |
| Step 0 | 手动构造 element 树 + 基础 DOM 渲染 | 完成 |
| Step 1 | `createElement`，接管 JSX 编译产物 | 完成 |
| Step 2 | Fiber 链表 + `requestIdleCallback` 可中断渲染循环 | 完成 |
| Step 3 | render / commit 两阶段，消除「半棵树」中间态 | 完成 |
| Step 4 | Reconciliation：`alternate` + `effectTag` 增量更新 | 完成 |
| Step 5 | 函数组件 | 完成 |
| Step 6 | `useState` | 未开始 |
| Step 7 | 事件系统 | 未开始 |
| Step 8 | `useEffect` | 未开始 |

## 目录结构

```
src/
├── react.js        createElement，把 JSX 编译产物转成 element 对象
├── createDom.js    创建 DOM + updateDom（按 props 差量写属性）
├── render.js       fiber 工作循环 / render-commit / reconcile
├── types.js        ReactElement / Fiber 的 JSDoc typedef
├── App.jsx         App / Title 函数组件，给二次 render 用
└── main.js         入口；原生按钮触发 UPDATE / DELETION / PLACEMENT
debug/
└── debug.js        实验开关与日志，默认只开总开关
test/
├── createElement.test.js
├── reconcile.test.js
├── function-component.test.js
└── dom-stub.js     Node 里用的 document / requestIdleCallback stub
tools/
├── jsx-transform.mjs
└── vite-plugin-my-jsx.mjs
```

## 调试开关

`debug/debug.js` 里的 `debugConfig` 控制所有观察性代码，渲染逻辑本身不依赖它们：

| 开关 | 默认 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 总开关，关掉后 `debug()` 的所有输出静默 |
| `slowUnitMs` | `0` | 人为拉长每个 fiber 的处理耗时（ms），用来把时间分片过程放慢到肉眼可见 |
| `logWorkLoop` | `false` | 打印每次工作循环的空闲预算、迭代次数与实际耗时，验证让步阈值是否够用 |
| `logCreateDom` | `false` | 打印每个新建的 DOM 节点 |

`render.js` 里的 `YIELD_MARGIN` 决定什么时候让出主线程，语义是「剩下的时间还够不够再做一个工作单元」，所以取值应当约等于单个工作单元的典型耗时。因为 `IdleDeadline.timeRemaining()` 的返回值钳制在 0 以上，这个值设成 `0` 会让 `shouldYield` 永远为假，等于关掉时间分片。

Step 4 的页面验证：打开 dev server 后点「改标题 / 删一项 / 加一项」。按钮在 `#app` 外面，走原生 `addEventListener`，不经过 mini-react 的事件系统。
