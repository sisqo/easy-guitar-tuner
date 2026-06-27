import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { webcrypto } from 'crypto'
import { execSync } from 'child_process'

// Node 18 doesn't expose crypto as a global — polyfill for vite-plugin-pwa/workbox
if (!globalThis.crypto) globalThis.crypto = webcrypto

// Build constants from git. CLI deploys (`vercel --prod`) upload sources without
// the .git directory, so these commands fail there — fall back to the env vars
// Vercel injects, then to a placeholder, so the build never hard-fails.
function sh(cmd, fallback) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return fallback }
}
const commitCount = sh('git rev-list --count HEAD', '0')
const commitHash  = sh('git rev-parse --short HEAD', (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7))

export default defineConfig({
  define: {
    __BUILD_COMMITS__: JSON.stringify(commitCount),
    __BUILD_HASH__: JSON.stringify(commitHash),
  },
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
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // navigazione SPA: serve sempre index.html dalla rete se possibile,
        // fallback alla cache solo se offline — evita la schermata bianca
        // quando i chunk JS cambiano dopo un aggiornamento
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
})
