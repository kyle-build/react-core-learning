import { defineConfig } from 'vite'

export default defineConfig({
    esbuild: {
        // 使用经典 JSX 转换，编译后调用我们自己的 createElement，而不是 React.createElement
        jsx: 'transform',
        jsxFactory: 'createElement',
        jsxFragment: 'Fragment',
        jsxDev: false
    }
})
