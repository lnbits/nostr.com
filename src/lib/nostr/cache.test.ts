import { cacheEvents, cacheProfile, getCachedEvents, getCachedProfiles, resetCacheConnectionForTests } from './cache';
import type { NostrEvent } from './types';

function event(id: string, created_at: number): NostrEvent {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: `event ${id}`,
    sig: 'b'.repeat(128)
  };
}

async function deleteDb() {
  await resetCacheConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('nostr-social-cache');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('cache database delete was blocked'));
  });
  await resetCacheConnectionForTests();
}

describe('IndexedDB cache', () => {
  beforeEach(async () => {
    await deleteDb();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it('stores events and returns newest cached events first', async () => {
    await cacheEvents([event('older', 10), event('newer', 30), event('middle', 20)]);

    expect((await getCachedEvents()).map((item) => item.id)).toEqual(['newer', 'middle', 'older']);
    expect((await getCachedEvents(2)).map((item) => item.id)).toEqual(['newer', 'middle']);
  });

  it('prunes old events after the cache reaches its storage cap', async () => {
    await cacheEvents(Array.from({ length: 605 }, (_, index) => event(`event-${index}`, index)));

    const cached = await getCachedEvents(700);
    expect(cached).toHaveLength(600);
    expect(cached[0].id).toBe('event-604');
    expect(cached.at(-1)?.id).toBe('event-5');
  });

  it('upserts profiles by pubkey', async () => {
    await cacheProfile({ pubkey: 'a'.repeat(64), name: 'First' });
    await cacheProfile({ pubkey: 'a'.repeat(64), name: 'Updated' });

    expect(await getCachedProfiles()).toEqual([{ pubkey: 'a'.repeat(64), name: 'Updated' }]);
  });
});
