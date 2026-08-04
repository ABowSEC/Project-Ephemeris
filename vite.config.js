import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // public/ also holds large three.js textures and skyboxes; precaching
      // is limited to the app shell and icons, with everything else cached
      // at runtime on first use.
      workbox: {
        // Custom worker code the generateSW template has no hook for. Right
        // now: making launch-alert notifications open the launch they are about.
        importScripts: ['/sw-notifications.js'],
        // icon-* and apple-touch only: the full-size source logos in
        // public/icons are ~1 MB each and cached at runtime instead
        globPatterns: ['**/*.{js,css,html}', 'icons/icon-*.png', 'icons/apple-touch-icon.png', '*.svg'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Launch data (direct API or our /api/launches edge proxy):
            // prefer fresh, fall back to cache when offline
            urlPattern: ({ url }) =>
              url.hostname === 'll.thespacedevs.com' ||
              (url.origin === self.location.origin && url.pathname === '/api/launches'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'launch-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map tiles, styles, glyphs and sprites (ISS tracker and world launch map)
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-styles' },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Mission images, agency logos, textures: cache on first view
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Ephemeris',
        short_name: 'Ephemeris',
        description:
          'Track rocket launches worldwide: live countdowns, a world launch map, tracked-launch alerts, and calendar export.',
        theme_color: '#06091A',
        background_color: '#06091A',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        categories: ['news', 'education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  build: {
    rollupOptions: {
      output: {
        // Split the rarely-changing UI/runtime libraries into a long-lived
        // vendor chunk so app updates don't bust their browser cache.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chakra-vendor': [
            '@chakra-ui/react',
            '@emotion/react',
            '@emotion/styled',
            'framer-motion',
          ],
        },
      },
    },
  },
})
