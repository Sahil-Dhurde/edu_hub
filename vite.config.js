import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        profile: resolve(__dirname, 'Profile.html'),
        dashboard: resolve(__dirname, 'User_Dashboard.html'),
        interaction: resolve(__dirname, 'Interaction.html'),
        resource: resolve(__dirname, 'Resource.html'),
        chat: resolve(__dirname, 'chat.html')
      }
    }
  }
});
