import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // relative Pfade, damit die App auch in Unterordnern (z.B. GitHub Pages) laeuft
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // OCR-Sprachdaten und Karten-Kacheln duerfen gross sein
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // OpenStreetMap-Kacheln offline cachen, sobald einmal geladen
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // Geocoding-Antworten kurz cachen
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nominatim',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 }
            }
          }
        ]
      },
      manifest: {
        name: 'Tour-Control',
        short_name: 'Tour-Control',
        description: 'Ladelisten fotografieren, Touren optimieren, Kundenwissen sammeln',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
