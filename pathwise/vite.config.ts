import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enable the service worker in dev too so offline works in the Docker
      // dev container (and can be exercised by E2E).
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['pathwise-mark.svg'],
      manifest: {
        name: 'Pathwise · Istanbul',
        short_name: 'Pathwise',
        description: 'Smart, social travel planning for Istanbul.',
        theme_color: '#0D0B1D',
        background_color: '#0D0B1D',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pathwise-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Precache the app shell; runtime-cache the map tiles so the map still
        // draws offline from the last-viewed area.
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so the Docker container is reachable
  },
});
