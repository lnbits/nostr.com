import { sveltekit } from '@sveltejs/kit/vite';
import { configDefaults, defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [...configDefaults.exclude, 'nostr-gadgets/**']
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/__nostr_build_upload': {
        target: 'https://nostr.build',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/api/v2/upload/files'
      }
    }
  }
});
