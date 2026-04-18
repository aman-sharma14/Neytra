import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      // Proxy API calls to the FastAPI backend during development
      '/scan': 'http://localhost:8000',
      '/scene': 'http://localhost:8000',
      '/face': 'http://localhost:8000',
      '/command': 'http://localhost:8000',
      '/memory': 'http://localhost:8000',
      '/enroll': 'http://localhost:8000',
      '/droidcam': {
        target: 'http://10.67.168.215:4747',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/droidcam/, '')
      }
    }
  }
})
