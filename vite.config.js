import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Evita que o deploy quebre na nuvem por causa de avisos ou warnings estáticos do compilador
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000, // Aumenta o limite para dashboards massivos com gráficos (Recharts)
  }
})