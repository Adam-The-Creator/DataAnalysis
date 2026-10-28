import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The release build is served by the DatabaseServer under /app (its webapp.py, PREFIX): the routes of this app (/sessions,
  // /drawings/<id>, ...) have the same names as the routes of the server's API, so the app cannot live at the root. Keep
  // both in step. The development server keeps "/" (requirements TEC-08).
  base: command === 'build' ? '/app/' : '/',
  server: {
    // The DatabaseServer only allows the origins listed in its config.py (localhost:3000 and 127.0.0.1:3000),
    // so the dev server uses port 3000 and the live mode works without any server change (requirements TEC-08).
    port: 3000,
    strictPort: true,
  },
}))
