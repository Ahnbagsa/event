/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '행사박사',
        short_name: '행사박사',
        description: '학교 의식행사 시나리오 작성과 진행',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F3F2FB',
        theme_color: '#6B5CF6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  // IndexedDB는 주소(오리진)에 묶인다. 포트가 5174로 밀려나면 행사도 음원도 없는
  // 빈 앱이 뜬다 — 지워진 게 아니라 다른 서랍을 여는 것이다. 포트가 이미 잡혀 있으면
  // 조용히 옮겨가지 말고 실패하게 둔다.
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
