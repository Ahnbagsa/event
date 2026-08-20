/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
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
