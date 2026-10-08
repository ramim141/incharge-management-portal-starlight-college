import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Build version: the Git commit on Vercel, the build time elsewhere. Shown in the principal's
// settings, and it gives every deploy new file names so no CDN/browser cache can serve old files.
const version = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/firestore')) {
            return 'vendor-firestore';
          }
          if (id.includes('node_modules/firebase/auth')) {
            return 'vendor-auth';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase-core';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
})
