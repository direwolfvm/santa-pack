import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** @param {string} name */
const page = (name) => fileURLToPath(new URL(`./app/${name}.html`, import.meta.url));

// The Firebase-era frontend. `npm run build` writes dist/, which the server
// serves when BACKEND=firebase. `npm run dev:web` serves it with hot reload and
// proxies /api to the Express server on :8080.
export default defineConfig({
  root: 'app',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: Object.fromEntries(
        ['index', 'login', 'verify', 'family', 'round', 'profile', 'admin'].map((name) => [name, page(name)]),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
