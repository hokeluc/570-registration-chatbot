import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api/* is forwarded to the Flask backend so we avoid CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
