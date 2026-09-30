import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose only deployment metadata; no server secrets or arbitrary env object.
  define: {
    'import.meta.env.VITE_MONITORING_ENVIRONMENT': JSON.stringify(process.env.VERCEL_ENV || 'development'),
    'import.meta.env.VITE_MONITORING_RELEASE': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || ''),
  },
})
