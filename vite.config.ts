import { defineConfig } from 'vite'

export default defineConfig({
  base: '/karaluch/',
  server: {
    port: 5173,
    host: true,
  },
  assetsInclude: ['**/*.glb', '**/*.ogg', '**/*.m4a', '**/*.wav', '**/*.mp3', '**/*.jpg'],
})
