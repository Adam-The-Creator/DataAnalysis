import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // The DatabaseServer only allows the origins listed in its config.py (localhost:3000 and 127.0.0.1:3000),
    // so the dev server uses port 3000 and the live mode works without any server change (requirements TEC-08).
    port: 3000,
    strictPort: true,
  },
})
