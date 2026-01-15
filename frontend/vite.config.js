import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for production deployment (served from root)
  base: '/',
  // Listen on all interfaces for Tailscale/CF tunnel access
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow HMR via Cloudflare tunnel
    allowedHosts: [
      'quran.hyperflash.uk',
      '.hyperflash.uk',  // Wildcard for subdomains
      'localhost',
      '.local',
    ],
    // Strict host checking - only allow listed hosts
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
