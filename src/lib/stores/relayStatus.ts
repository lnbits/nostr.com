import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';
import type { RelayState } from '$lib/nostr/types';

export type RelayConnectionStatus = 'checking' | 'online' | 'offline';

export const relayStatus = writable<Record<string, RelayConnectionStatus>>({});

export function startRelayStatusChecks(relays: Readable<RelayState[]>) {
  if (!browser) return () => {};

  let cleanupChecks: Array<() => void> = [];

  const unsubscribe = relays.subscribe((items) => {
    cleanupChecks.forEach((cleanup) => cleanup());
    cleanupChecks = [];

    const urls = items.filter((relay) => relay.enabled).map((relay) => relay.url);
    relayStatus.set(Object.fromEntries(urls.map((url) => [url, 'checking'])));

    for (const url of urls) {
      try {
        const socket = new WebSocket(url);
        let opened = false;
        const timeout = setTimeout(() => {
          if (!opened) relayStatus.update((existing) => ({ ...existing, [url]: 'offline' }));
          socket.close();
        }, 3500);

        socket.onopen = () => {
          opened = true;
          relayStatus.update((existing) => ({ ...existing, [url]: 'online' }));
          socket.close();
        };
        socket.onerror = () => {
          if (!opened) relayStatus.update((existing) => ({ ...existing, [url]: 'offline' }));
        };
        socket.onclose = () => {
          clearTimeout(timeout);
          if (!opened) relayStatus.update((existing) => ({ ...existing, [url]: 'offline' }));
        };
        cleanupChecks.push(() => {
          clearTimeout(timeout);
          socket.close();
        });
      } catch {
        relayStatus.update((existing) => ({ ...existing, [url]: 'offline' }));
      }
    }
  });

  return () => {
    unsubscribe();
    cleanupChecks.forEach((cleanup) => cleanup());
  };
}
