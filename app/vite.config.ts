import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages sirve en /<repo>/, Vercel en /. El workflow de Pages setea
// VITE_DEPLOY_TARGET=pages para activar el base path correcto.
const base = process.env.VITE_DEPLOY_TARGET === 'pages' ? '/mapitas/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
