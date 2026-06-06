import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    minify: 'esbuild',
  },
  server: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:5180',
    },
  },
});
