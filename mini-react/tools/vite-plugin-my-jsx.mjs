import { transformJsx } from './jsx-transform.mjs'

/**
 * 自己写的 Vite 插件：拦截 .jsx 文件，用手写的 JSX 解析/转换（jsx-transform.mjs）
 * 代替 esbuild 内置的 JSX 处理。enforce: 'pre' 保证在 Vite 内置的 esbuild 转换插件
 * 之前跑，这样等 esbuild 处理到这个文件时，JSX 语法已经被转掉了，不会重复处理。
 */
export default function myJsxPlugin() {
    return {
        name: 'my-jsx-transform',
        enforce: 'pre',
        transform(code, id) {
            if (!id.endsWith('.jsx')) {
                return null
            }
            const transformed = transformJsx(code)
            return {
                code: `/* transformed by my-jsx-transform, not esbuild */\n${transformed}`,
                map: null
            }
        }
    }
}
