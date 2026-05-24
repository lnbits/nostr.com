import { writable } from 'svelte/store';
import type { RelayState } from '$lib/nostr/types';

export type RelayConnectionStatus = 'checking' | 'online' | 'offline';

export const relayStatus = writable<Record<string, RelayConnectionStatus>>({});

export function syncRelayStatus(relays: RelayState[]) {
  const enabledUrls = relays.filter((relay) => relay.enabled).map((relay) => relay.url);
  relayStatus.update((existing) =>
    Object.fromEntries(enabledUrls.map((url) => [url, existing[url] === 'online' ? 'online' : 'checking']))
  );
}

export function markRelaysOnline(urls: string[]) {
  if (!urls.length) return;
  relayStatus.update((existing) => {
    const next = { ...existing };
    urls.forEach((url) => {
      next[url] = 'online';
    });
    return next;
  });
}

export function markRelaysOffline(urls: string[]) {
  if (!urls.length) return;
  relayStatus.update((existing) => {
    const next = { ...existing };
    urls.forEach((url) => {
      if (next[url] !== 'online') next[url] = 'offline';
    });
    return next;
  });
}
