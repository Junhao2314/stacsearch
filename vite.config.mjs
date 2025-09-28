import { defineConfig } from 'vite';

export default defineConfig({
  // Base URL for deployment
  // On GitHub Pages project sites, assets must be served from "/<repo>/"
  // Use CI env to switch base automatically: local/dev -> '/', CI (GitHub Pages) -> '/<repo>/'
  base: process.env.GITHUB_ACTIONS ? '/stacsearch/' : '/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'openlayers': ['ol']
        }
      }
    }
  },
  
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // Enable better error messages
  optimizeDeps: {
    include: ['ol']
  }
});
