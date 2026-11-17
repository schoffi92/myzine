import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Absolute asset paths: pages live at nested URLs like /writing/blackout,
  // where relative './assets/…' would point to the wrong folder.
  base: '/',
})
