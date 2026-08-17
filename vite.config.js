import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isProd = process.env.NODE_ENV === 'production';

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
});
