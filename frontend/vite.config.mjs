// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Se estiver usando variáveis de ambiente, o Vite automaticamente lê arquivos `.env`
// com prefixo VITE_ (ex: VITE_API_URL=http://192.168.41.163:3003/api)

export default defineConfig({
  plugins: [react()],
  base: './', // caminhos relativos no build
  build: {
    outDir: 'dist', // saída do build
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined // evita dividir em múltiplos arquivos
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
    host: true, // acessível na rede local
    port: 5173, // porta do dev server
  },
  preview: {
    host: true,   // acessível na rede
    port: 3003,   // porta para rodar o build final
  }
});
