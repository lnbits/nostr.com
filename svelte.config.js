import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readdirSync } from 'node:fs';

const base = process.env.BASE_PATH ?? '';
const nipEntries = readdirSync('nips')
  .filter((file) => /^[0-9A-F]{2}\.md$/i.test(file))
  .map((file) => `/nip${file.slice(0, -3).toLowerCase()}`);

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: '200.html'
    }),
    paths: {
      base
    },
    prerender: {
      entries: ['/', '/info', '/clients', '/nostr-keys', '/pomegranate', '/relays', ...nipEntries]
    }
  }
};

export default config;
