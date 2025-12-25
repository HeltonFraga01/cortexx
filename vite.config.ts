import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const isProduction = mode === "production";
  const isAnalyze = process.env.ANALYZE === "true";

  return {
    base: "/",

    server: {
      host: "localhost",
      port: 8080,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: false, // Preserve original Host header for subdomain-based multi-tenancy
          secure: false,
        },
        '/health': {
          target: 'http://localhost:3001',
          changeOrigin: false, // Preserve original Host header for subdomain-based multi-tenancy
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: false, // Preserve original Host header for subdomain-based multi-tenancy
          secure: false,
          ws: true,
        }
      }
    },

    plugins: [
      react(),
      isDevelopment && componentTagger(),
      // Inject preconnect hints based on environment (Task 1.1)
      {
        name: 'inject-preconnect',
        transformIndexHtml(html) {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            try {
              const origin = new URL(supabaseUrl).origin;
              return html.replace(
                '</head>',
                `    <link rel="preconnect" href="${origin}" crossorigin />\n    <link rel="dns-prefetch" href="${origin}" />\n  </head>`
              );
            } catch {
              return html;
            }
          }
          return html;
        }
      }
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: isAnalyze ? true : false,
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
      
      // Manual chunks configuration (Task 2.3)
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React libraries
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // Data fetching and state
            'vendor-query': ['@tanstack/react-query'],
            // UI primitives (Radix)
            'vendor-ui-radix': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-accordion',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-switch',
              '@radix-ui/react-slider',
              '@radix-ui/react-toast',
            ],
            // Utilities
            'vendor-utils': ['date-fns', 'zod', 'axios', 'clsx', 'tailwind-merge'],
            // Icons
            'vendor-icons': ['lucide-react'],
            // Charts (heavy, rarely used on initial load)
            'vendor-charts': ['recharts'],
          },
        },
      },
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
