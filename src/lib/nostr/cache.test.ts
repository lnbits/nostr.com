import {
  cacheDirectMessages,
  cacheEvents,
  cacheProfile,
  cacheProfileEvents,
  getCachedDirectMessages,
  getCachedEvents,
  getCachedHashtagEvents,
  getCachedProfileEvents,
  getCachedProfiles,
  resetCacheConnectionForTests
} from './cache';
import type { DirectMessage, NostrEvent } from './types';

function event(id: string, created_at: number, pubkey = 'a'.repeat(64), content = `event ${id}`, tags: string[][] = []): NostrEvent {
  return {
    id,
    pubkey,
    created_at,
    kind: 1,
    tags,
    content,
    sig: 'b'.repeat(128)
  };
}

function dm(id: string, created_at: number, peer = 'b'.repeat(64)): DirectMessage {
  return {
    id,
    protocol: 'NIP-17',
    peer,
    from: peer,
    to: 'a'.repeat(64),
    created_at,
    encrypted: `encrypted ${id}`,
    content: `message ${id}`
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
    await cacheEvents(Array.from({ length: 2405 }, (_, index) => event(`event-${index}`, index)));

    const cached = await getCachedEvents(2500);
    expect(cached).toHaveLength(2400);
    expect(cached[0].id).toBe('event-2404');
    expect(cached.at(-1)?.id).toBe('event-5');
  });

  it('upserts profiles by pubkey', async () => {
    await cacheProfile({ pubkey: 'a'.repeat(64), name: 'First' });
    await cacheProfile({ pubkey: 'a'.repeat(64), name: 'Updated' });

    expect(await getCachedProfiles()).toEqual([{ pubkey: 'a'.repeat(64), name: 'Updated' }]);
  });

  it('keeps a separate ordered profile event cache', async () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    await cacheProfileEvents([event('alice-old', 10, alice), event('bob-note', 30, bob), event('alice-new', 40, alice)]);

    expect((await getCachedProfileEvents(alice)).map((item) => item.id)).toEqual(['alice-new', 'alice-old']);
    expect((await getCachedProfileEvents(bob)).map((item) => item.id)).toEqual(['bob-note']);
  });

  it('caps profile event indexes independently of the global event cache', async () => {
    const alice = 'a'.repeat(64);
    await cacheProfileEvents(Array.from({ length: 1205 }, (_, index) => event(`alice-${index}`, index, alice)));

    const cached = await getCachedProfileEvents(alice, 1300);
    expect(cached).toHaveLength(1200);
    expect(cached[0].id).toBe('alice-1204');
    expect(cached.at(-1)?.id).toBe('alice-5');
  }, 10_000);

  it('keeps a separate ordered hashtag event cache from tags and content', async () => {
    await cacheEvents([
      event('nostr-old', 10, 'a'.repeat(64), 'hello #Nostr'),
      event('music-note', 30, 'b'.repeat(64), 'tagged only', [['t', 'music']]),
      event('nostr-new', 40, 'c'.repeat(64), 'new #nostr thing')
    ]);

    expect((await getCachedHashtagEvents('nostr')).map((item) => item.id)).toEqual(['nostr-new', 'nostr-old']);
    expect((await getCachedHashtagEvents('#music')).map((item) => item.id)).toEqual(['music-note']);
  });

  it('recycles the hashtag cache across all tags instead of capping each tag independently', async () => {
    await cacheEvents(Array.from({ length: 1205 }, (_, index) => event(`tagged-${index}`, index, 'a'.repeat(64), `hello #topic${index}`)));

    expect(await getCachedHashtagEvents('topic0')).toEqual([]);
    expect((await getCachedHashtagEvents('topic1204')).map((item) => item.id)).toEqual(['tagged-1204']);
    expect((await getCachedHashtagEvents('topic5')).map((item) => item.id)).toEqual(['tagged-5']);
  });

  it('caches direct messages per account and returns newest first', async () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    await cacheDirectMessages(alice, [dm('alice-old', 10), dm('alice-new', 30)]);
    await cacheDirectMessages(bob, [dm('bob-note', 20, 'c'.repeat(64))]);

    expect((await getCachedDirectMessages(alice)).map((message) => message.id)).toEqual(['alice-new', 'alice-old']);
    expect((await getCachedDirectMessages(bob)).map((message) => message.id)).toEqual(['bob-note']);
  });
});
