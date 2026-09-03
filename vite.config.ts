import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { proxy: {
    '/api': process.env.VITE_BACKEND_URL ?? 'http://localhost:8000',
    '/uploads': process.env.VITE_BACKEND_URL ?? 'http://localhost:8000',
  } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.tsx'] },
})
