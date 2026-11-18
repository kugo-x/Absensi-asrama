import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
// Mode "hp" (npm run dev:hp): HTTPS + bisa diakses dari HP di jaringan WiFi yang sama.
// Browser HP hanya mengizinkan GPS & kamera di halaman HTTPS (atau localhost).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'hp' ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: mode === 'hp' ? true : undefined,
    // Teruskan panggilan API ke backend CodeIgniter (php spark serve)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
}))
