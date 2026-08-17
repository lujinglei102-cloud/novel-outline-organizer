import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// 开发模式 base=/（本地访问 http://localhost:5173/），生产模式 base=/novel-outline-organizer/（GitHub Pages）
const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  base: isProd ? '/novel-outline-organizer/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'test/engine.test.mjs', 'test/engine.test.mts'],
  },
} as any)
