import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  base: '/ban-chess.ts/',
  resolve: {
    alias: {
      'ban-chess.ts': resolve(__dirname, '../dist/index.js')
    }
  },
  optimizeDeps: {
    include: ['ban-chess.ts']
  }
})
