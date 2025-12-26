import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
// Task 2.8: Bundle analyzer for visualization
import { visualizer } from "rollup-plugin-visualizer";

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
      // Task 3: PWA configuration with Service Worker
      isProduction && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'WUZAPI Manager',
          short_name: 'WUZAPI',
          description: 'WhatsApp Business API Management Platform',
          theme_color: '#3b82f6',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Task 3.3: Cache-first for static assets
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Task 3.3: Cache-first for static assets (JS, CSS)
            {
              urlPattern: /\.(?:js|css)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            // Task 3.5: Stale-while-revalidate for images
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
              },
            },
            // Task 3.4: Network-first for API calls
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5, // 5 minutes
                },
                networkTimeoutSeconds: 10,
              },
            },
          ],
          // Precache essential files
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Skip waiting and claim clients immediately
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
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
      },
      // Task 2.8: Bundle visualizer for analysis (only when ANALYZE=true)
      isAnalyze && visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // or 'sunburst', 'network'
      }),
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
      
      // Task 2: Enhanced manual chunks configuration for optimal bundle splitting
      rollupOptions: {
        output: {
          // Task 2.1-2.7: Manual chunks for better code splitting
          manualChunks: (id) => {
            // Task 2.2: Core React libraries (vendor-react)
            if (id.includes('node_modules/react/') || 
                id.includes('node_modules/react-dom/') || 
                id.includes('node_modules/react-router-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            
            // Task 2.4: Data fetching and state (vendor-query)
            if (id.includes('node_modules/@tanstack/react-query') ||
                id.includes('node_modules/@tanstack/query-core')) {
              return 'vendor-query';
            }
            
            // Task 2.3: UI primitives - Radix (vendor-ui-radix)
            if (id.includes('node_modules/@radix-ui/')) {
              return 'vendor-ui-radix';
            }
            
            // Task 2.5: Forms (vendor-forms)
            if (id.includes('node_modules/react-hook-form/') ||
                id.includes('node_modules/@hookform/') ||
                id.includes('node_modules/zod/')) {
              return 'vendor-forms';
            }
            
            // Utilities (vendor-utils)
            if (id.includes('node_modules/date-fns/') ||
                id.includes('node_modules/axios/') ||
                id.includes('node_modules/clsx/') ||
                id.includes('node_modules/tailwind-merge/') ||
                id.includes('node_modules/class-variance-authority/')) {
              return 'vendor-utils';
            }
            
            // Icons (vendor-icons)
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            
            // Charts - heavy, rarely used on initial load (vendor-charts)
            if (id.includes('node_modules/recharts/') ||
                id.includes('node_modules/d3-') ||
                id.includes('node_modules/victory-')) {
              return 'vendor-charts';
            }
            
            // Supabase client
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            
            // Task 2.6: Admin pages and components
            if (id.includes('/src/pages/admin/') ||
                id.includes('/src/components/admin/')) {
              return 'chunk-admin';
            }
            
            // Task 2.7: User pages and components
            if (id.includes('/src/pages/user/') ||
                id.includes('/src/components/user/')) {
              return 'chunk-user';
            }
            
            // Shared components
            if (id.includes('/src/components/shared/') ||
                id.includes('/src/components/features/')) {
              return 'chunk-shared';
            }
          },
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const name = chunkInfo.name || 'chunk';
            return `assets/${name}-[hash].js`;
          },
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
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
