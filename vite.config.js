import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache anche l'audio locale (campana tibetana) oltre agli asset di build.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mp3}'],
        // Alza il limite: le tracce sono remote, ma teniamo margine per gli asset locali.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Tracce audio guidate su Supabase Storage: disponibili anche offline.
            // NB: per le richieste cross-origin la RegExp deve combaciare dall'origine.
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/tracce-audio\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tracce-audio',
              // Necessario per le richieste Range (206) dei tag <audio>:
              // serve i frammenti dalla copia completa in cache.
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 120 // 120 giorni
              }
            }
          },
          {
            // Font Google usati dal CSS: utili anche senza connessione.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      manifest: {
        name: 'Percorso MBSR',
        short_name: 'MBSR',
        description: 'Gestione iscrizioni, lezioni, questionari e log di pratica per i cicli del percorso MBSR',
        theme_color: '#4B6B57',
        background_color: '#EFF1EA',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
