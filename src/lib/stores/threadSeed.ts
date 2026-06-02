import type { NostrEvent } from '$lib/nostr/types';

let seedEvent: NostrEvent | null = null;

export function saveThreadSeed(event: NostrEvent) {
  seedEvent = event;
}

export function readThreadSeed(id: string) {
  return seedEvent?.id === id ? seedEvent : null;
}
