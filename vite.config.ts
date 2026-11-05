import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    host: "::",
    port: 3000,
    hmr: false,
    ws: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    process: {
      env: {},
      version: '',
      platform: 'browser',
      browser: true,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('agora-rtc-sdk-ng') || id.includes('agora-access-token')) {
            return 'vendor-agora';
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-recharts';
          }
          if (id.includes('framer-motion') || id.includes('motion')) {
            return 'vendor-motion';
          }
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'vendor-supabase';
          }
        },
      },
    },
  },
});
