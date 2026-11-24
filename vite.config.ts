import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./client', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/client', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: { outDir, emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
