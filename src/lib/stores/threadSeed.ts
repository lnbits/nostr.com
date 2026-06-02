import type { NostrEvent } from '$lib/nostr/types';

const seedEvents = new Map<string, NostrEvent>();
const prefetchedReplies = new Map<string, NostrEvent[]>();
const hydratedThreads = new Map<string, { events: NostrEvent[]; hasOlderReplies: boolean; savedAt: number }>();
const hydratedThreadStorageKey = 'nostr-hydrated-threads';
const hydratedThreadTtlMs = 10 * 60 * 1000;
const maxHydratedThreads = 40;
let hydratedThreadsRestored = false;

export function saveThreadSeed(event: NostrEvent) {
  seedEvents.set(event.id, event);

  while (seedEvents.size > 120) {
    const [oldestKey] = seedEvents.keys();
    seedEvents.delete(oldestKey);
  }
}

export function readThreadSeed(id: string) {
  return seedEvents.get(id) ?? null;
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

export function saveHydratedThread(rootId: string, events: NostrEvent[], hasOlderReplies: boolean) {
  restoreHydratedThreadsFromStorage();
  if (!/^[0-9a-f]{64}$/i.test(rootId) || !events.length) return;
  const existing = hydratedThreads.get(rootId);
  const byId = new Map([...(existing?.events ?? []), ...events].map((event) => [event.id, event]));
  const root = byId.get(rootId);
  const replyLimit = root ? 179 : 180;
  const limitedEvents = [...byId.values()]
    .filter((event) => event.id !== rootId)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, replyLimit);
  hydratedThreads.set(rootId, {
    events: [...(root ? [root] : []), ...limitedEvents].sort((a, b) => b.created_at - a.created_at),
    hasOlderReplies: hasOlderReplies || Boolean(existing?.hasOlderReplies),
    savedAt: Date.now()
  });

  while (hydratedThreads.size > maxHydratedThreads) {
    const [oldestKey] = hydratedThreads.keys();
    hydratedThreads.delete(oldestKey);
  }
  persistHydratedThreads();
}

export function readHydratedThread(rootId: string) {
  restoreHydratedThreadsFromStorage();
  const cached = hydratedThreads.get(rootId);
  if (!cached) return null;
  if (Date.now() - cached.savedAt > hydratedThreadTtlMs) {
    hydratedThreads.delete(rootId);
    persistHydratedThreads();
    return null;
  }
  return cached;
}

function persistHydratedThreads() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(hydratedThreadStorageKey, JSON.stringify([...hydratedThreads.entries()]));
  } catch {
    // In-memory cache still works when storage is unavailable or full.
  }
}

function restoreHydratedThreadsFromStorage() {
  if (hydratedThreadsRestored || typeof sessionStorage === 'undefined') return;
  hydratedThreadsRestored = true;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(hydratedThreadStorageKey) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const item of parsed) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [rootId, cached] = item as [unknown, unknown];
      if (typeof rootId !== 'string' || !/^[0-9a-f]{64}$/i.test(rootId) || !isHydratedThreadCache(cached)) continue;
      if (now - cached.savedAt > hydratedThreadTtlMs) continue;
      hydratedThreads.set(rootId, cached);
    }
    persistHydratedThreads();
  } catch {
    sessionStorage.removeItem(hydratedThreadStorageKey);
  }
}

function isHydratedThreadCache(value: unknown): value is { events: NostrEvent[]; hasOlderReplies: boolean; savedAt: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as { events?: unknown; hasOlderReplies?: unknown; savedAt?: unknown };
  return Array.isArray(record.events) && typeof record.hasOlderReplies === 'boolean' && typeof record.savedAt === 'number';
}
