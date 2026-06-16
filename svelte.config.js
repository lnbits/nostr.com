import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const base = process.env.BASE_PATH ?? '';
const nipEntries = nipCodes().map((code) => `/nip${code.toLowerCase()}`);

function nipCodes() {
  const source = readFileSync('src/lib/nips.ts', 'utf8');
  return [...source.matchAll(/^  '([0-9A-F]{2})': \{/gim)].map((match) => match[1].toUpperCase()).sort();
}

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
