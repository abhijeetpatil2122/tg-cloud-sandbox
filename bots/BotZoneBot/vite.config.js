import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for the Rich Message editor Mini App.
// Output goes to dist/ which vercel.json points the static build at.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 5173
  }
})
