import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { webcrypto } from 'crypto'

// Node 18 doesn't expose crypto as a global — polyfill for vite-plugin-pwa/workbox
if (!globalThis.crypto) globalThis.crypto = webcrypto

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EasyGuitarTuner',
        short_name: 'EasyTuner',
        description: 'Chromatic tuner for guitar and ukulele',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})
