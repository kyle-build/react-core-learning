import { defineConfig } from 'vite'
import myJsxPlugin from './tools/vite-plugin-my-jsx.mjs'

export default defineConfig({
    plugins: [myJsxPlugin()],
    esbuild: {
        // .jsx 文件现在由 myJsxPlugin 提前转换掉了，这里留着只是给万一漏网的 JSX 语法兜底
        jsx: 'transform',
        jsxFactory: 'createElement',
        jsxFragment: 'Fragment',
        jsxDev: false
    }
})
