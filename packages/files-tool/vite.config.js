import path from 'path'
import { defineConfig } from 'vite'
import PACKAGE from './package.json'
import streamSaverPlugin from './stream-saver/vite-plugin-stream-saver'

export default defineConfig(() => {
  return {
    plugins: [
      streamSaverPlugin()
    ],
    esbuild: {
      target: 'es2015',
      drop: ["console", "debugger"]
    },
    build: {
      manifest: true,
      outDir: path.resolve(__dirname, `dist`),
      lib: {
        entry: {
          index: path.resolve(__dirname, './src/index.js'),
          'vite-plugin-stream-saver': path.resolve(__dirname, './stream-saver/vite-plugin-stream-saver.js'),
        },
        name: PACKAGE.name,
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => `${entryName}.${format}.js`,
      },
      rollupOptions: {
        external: ['fs', 'path'],
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'https://xxx.com',
          changeOrigin: true,
        },
      },
    },
  }
})
