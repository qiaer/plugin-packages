import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'

export default function streamSaverPlugin(options = {}) {
  const {
    swSrc = resolve(__dirname, './sw.js'),
    mitmSrc = resolve(__dirname, './mitm.html'),
    swDest = 'sw.js',
    mitmDest = 'mitm.html',
    outDir = 'dist',
  } = options

  let resolvedConfig

  return {
    name: 'vite-plugin-stream-saver',

    configResolved(config) {
      resolvedConfig = config
    },

    // 开发环境：提供中间件，直接返回 sw.js/mitm.html
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.indexOf(`/${swDest}`) !== -1) {
          res.setHeader('Content-Type', 'application/javascript')
          res.end(readFileSync(swSrc))
          return
        }
        if (req.url.indexOf(`/${mitmDest}`) !== -1) {
          res.setHeader('Content-Type', 'text/html')
          res.end(readFileSync(mitmSrc))
          return
        }
        next()
      })
    },

    // 构建时拷贝到 dist
    generateBundle() {
      // sw.js
      const swTarget = resolve(outDir, swDest)
      if (!existsSync(dirname(swTarget))) mkdirSync(dirname(swTarget), { recursive: true })
      copyFileSync(swSrc, swTarget)
      // mitm.html
      const mitmTarget = resolve(outDir, mitmDest)
      if (!existsSync(dirname(mitmTarget))) mkdirSync(dirname(mitmTarget), { recursive: true })
      copyFileSync(mitmSrc, mitmTarget)
    },
  }
}