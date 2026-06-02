import type { NostrEvent } from '$lib/nostr/types';

let seedEvent: NostrEvent | null = null;
const prefetchedReplies = new Map<string, NostrEvent[]>();

export function saveThreadSeed(event: NostrEvent) {
  seedEvent = event;
}

export function readThreadSeed(id: string) {
  return seedEvent?.id === id ? seedEvent : null;
}

export function savePrefetchedThreadReplies(rootId: string, replies: NostrEvent[]) {
  if (!/^[0-9a-f]{64}$/i.test(rootId) || !replies.length) return;
  const existing = prefetchedReplies.get(rootId) ?? [];
  const byId = new Map([...existing, ...replies].map((event) => [event.id, event]));
  prefetchedReplies.set(rootId, [...byId.values()].sort((a, b) => b.created_at - a.created_at).slice(0, 24));

  if (prefetchedReplies.size > 80) {
    const [oldestKey] = prefetchedReplies.keys();
    prefetchedReplies.delete(oldestKey);
  }
}

export function readPrefetchedThreadReplies(rootId: string) {
  return prefetchedReplies.get(rootId) ?? [];
}
