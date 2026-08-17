import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
// 开发模式 base=/（本地访问 http://localhost:5173/），生产模式 base=/novel-outline-organizer/（GitHub Pages）
var isProd = process.env.NODE_ENV === 'production';
export default defineConfig({
    base: isProd ? '/novel-outline-organizer/' : '/',
    plugins: [
        react(),
        VitePWA({
            // PWA 注册策略：开发环境禁用（autoUpdate 在生产环境会自动更新缓存）
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            devOptions: {
                enabled: false,
            },
            manifest: {
                name: '小说大纲梳理器',
                short_name: '大纲梳理',
                description: '把零散的灵感卡片整成可导出的章节大纲文档（女频网文专用）',
                theme_color: '#a78bfa',
                background_color: '#1a1a2e',
                display: 'standalone',
                orientation: 'portrait',
                scope: isProd ? '/novel-outline-organizer/' : '/',
                start_url: isProd ? '/novel-outline-organizer/' : '/',
                lang: 'zh-CN',
                icons: [
                    {
                        src: 'pwa-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                // 预缓存所有静态资源（包括 ECharts/jieba-wasm 等大体积 chunk）
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
                // 单文件最大 8MB（jieba-wasm 可能较大）
                maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
                // 预缓存时跳过 source map
                globIgnores: ['**/*.map'],
                runtimeCaching: [
                    {
                        // 字体走 stale-while-revalidate（离线用上次缓存，在线时后台更新）
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
                        },
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
                            },
                        },
                    },
                ],
            },
        }),
    ],
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
