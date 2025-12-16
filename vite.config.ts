import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const isProduction = mode === "production";

  return {
    base: "/",

    server: {
      host: "localhost",
      port: 8080,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    },

    plugins: [react(), isDevelopment && componentTagger()].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: 'terser',
      target: 'es2015',
      
      // Configurações simplificadas do Terser
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
      
      chunkSizeWarningLimit: 500,
    },

    preview: {
      port: 4173,
      host: true,
      open: true,
    },

    // Otimizações de dependências essenciais
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'lucide-react'
      ],
    },

    // Configurações específicas para produção
    ...(isProduction && {
      define: {
        __DEV__: false,
      },
    }),
  };
});
