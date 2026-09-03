import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copilotPlugin } from './server/copilotPlugin.js'

export default defineConfig({
  plugins: [react(), copilotPlugin(process.cwd())],
  optimizeDeps: {
    noDiscovery: true,
    holdUntilCrawlEnd: false,
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    exclude: ['lucide-react'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    preTransformRequests: false,
  },
})
