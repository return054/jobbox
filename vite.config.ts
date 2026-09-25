import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// JobBox Vite 配置
// - popup.html 作为主入口（含 React）
// - dashboard.html 作为岗位库页面入口（options_page）
// - background/service-worker.ts 作为独立入口，输出 background.js 供 MV3 使用
// - base: './' 保证扩展加载时资源路径为相对路径
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./popup.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./dashboard.html', import.meta.url)),
        background: fileURLToPath(new URL('./src/background/service-worker.ts', import.meta.url)),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
