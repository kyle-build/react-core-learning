import { transformJsx } from './jsx-transform.mjs'

const whitelist = new Set(['.jsx','.tsx'])

export default function myJsxPlugin() {
    return {
        name: 'my-jsx-transform',
        enforce: 'pre',
        transform(code, id) {
            const ext = id.slice(id.lastIndexOf('.'))
            if (!whitelist.has(ext)) return null

            console.log('hdx ', id)
            const transformed = transformJsx(code)
            return {
                code: `/* transformed by my-jsx-transform, not esbuild */\n${transformed}`,
                map: null
            }
        }
    }
}
