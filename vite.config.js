import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copilotPlugin } from './server/copilotPlugin.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), copilotPlugin(process.cwd())],
  resolve: {
    alias: [
      {
        find: /^lucide-react$/,
        replacement: path.resolve(root, 'src/lib/icons.js'),
      },
    ],
  },
  optimizeDeps: {
    noDiscovery: true,
    holdUntilCrawlEnd: false,
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    preTransformRequests: false,
  },
})
