import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    modulePreload: {
      resolveDependencies(filename, deps) {
        if (filename.includes('index')) {
          return deps.filter(dep => !/jspdf|html2canvas|purify|canvg|dompurify/i.test(dep))
        }
        return deps
      },
    },
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ },
            { name: 'leaflet', test: /node_modules[\\/]leaflet/ },
          ],
        },
      },
    },
  },
})
