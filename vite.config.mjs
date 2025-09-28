import { defineConfig } from 'vite';

export default defineConfig({
  // Base URL for deployment
  // Change this to your repository name for GitHub Pages
  // For example: '/stacsearch/' if your repo is https://github.com/username/stacsearch
  base: '/',
  
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
