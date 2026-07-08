import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '旅程規劃 Trip Planner',
        short_name: '旅程規劃',
        description: '安排未來的旅程、回顧過去的旅行',
        lang: 'zh-Hant-TW',
        display: 'standalone',
        start_url: '/',
        background_color: '#f4f6f9',
        theme_color: '#1a6dab',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA：所有路由都回到 index.html，離線時也能開任何頁面
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
      },
    }),
  ],
});
