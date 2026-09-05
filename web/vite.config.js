import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app runs on :5173 and talks to the identity server on :4000.
// We proxy the API paths so the browser sees everything as same-origin —
// that keeps the httpOnly SSO cookie first-party and avoids cross-site issues
// in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/oauth': { target: 'http://localhost:4000', changeOrigin: true },
      '/.well-known': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
