import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf8')) as { version: string }

// Extension build: index.html → app page (opened in a tab by the action button), background.ts → MV3 module service
// worker, content.ts → scryfall.com content script (must stay import-free so it emits as a plain script, no chunks). Entry names must be stable so manifest.json can reference them.
export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __SR_VERSION__: JSON.stringify(manifest.version) },
  // `npm run serve` = the LAN test build: dist/index.html served to the local network (no chrome.* — app page only)
  preview: { host: true, port: 4173, strictPort: true },
  server: { host: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
