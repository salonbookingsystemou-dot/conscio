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
        // Su iPhone l’icona in home apre una navigazione gestita dal service worker.
        // La route di Workbox, se il fetch fallisce, rifiuta respondWith e Safari
        // mostra «Load failed». La gestiamo noi e non lasciamo mai la promise in errore.
        importScripts: ['sw-navigazione.js'],
        navigateFallback: null,
        // Precache anche l'audio locale (campana tibetana) oltre agli asset di build.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mp3}'],
        // Alza il limite: le tracce sono remote, ma teniamo margine per gli asset locali.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Tracce audio guidate su Supabase Storage: disponibili anche offline.
            // Le richieste con `copia=1` sono gli scaricamenti per l'ascolto senza rete
            // (lib/cacheTracce.js): vanno dirette in rete, così «Annulla» le ferma davvero,
            // e la copia in cache la scrive la pagina a file completo.
            urlPattern: ({ url }) =>
              /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/tracce-audio\//i.test(url.href) &&
              !url.searchParams.has('copia'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tracce-audio-v2',
              // Necessario per le richieste Range (206) dei tag <audio>:
              // serve i frammenti dalla copia completa in cache.
              rangeRequests: true,
              // SOLO 200: le richieste no-cors dell'<audio> danno risposte opaque
              // (status 0) che il RangeRequestsPlugin non può affettare e che
              // romperebbero la riproduzione. La copia completa la scrive
              // cacheTracce.js (fetch CORS → 200).
              cacheableResponse: { statuses: [200] },
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
        name: 'Conscio',
        short_name: 'Conscio',
        description: 'Il percorso MBSR: pratica guidata, questionari e diario della giornata',
        theme_color: '#3F5443',
        background_color: '#F5F1E7',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
