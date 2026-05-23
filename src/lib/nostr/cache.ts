import type { NostrEvent, Profile } from './types';

const DB_NAME = 'nostr-social-cache';
const DB_VERSION = 4;
const MAX_CACHED_EVENTS = 600;
const MAX_CACHED_PROFILE_EVENTS = 600;
const MAX_CACHED_HASHTAG_EVENTS = 600;

interface CachedProfileEvent {
  cacheKey: string;
  pubkey: string;
  created_at: number;
  event: NostrEvent;
}

interface CachedHashtagEvent {
  cacheKey: string;
  tag: string;
  created_at: number;
  event: NostrEvent;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion > 0 && event.oldVersion < 4 && db.objectStoreNames.contains('hashtagEvents')) {
        db.deleteObjectStore('hashtagEvents');
      }
      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('created_at', 'created_at');
        events.createIndex('pubkey', 'pubkey');
        events.createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'pubkey' });
      if (!db.objectStoreNames.contains('profileEvents')) {
        const profileEvents = db.createObjectStore('profileEvents', { keyPath: 'cacheKey' });
        profileEvents.createIndex('pubkey', 'pubkey');
        profileEvents.createIndex('pubkey_created_at', ['pubkey', 'created_at']);
      }
      if (!db.objectStoreNames.contains('hashtagEvents')) {
        createHashtagEventsStore(db);
      }
      if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'pubkey' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

async function withStore<T>(name: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result: T;
    fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    (store as IDBObjectStore & { __setResult?: (value: T) => void }).__setResult = (value: T) => {
      result = value;
    };
  });
}

export async function cacheEvents(events: NostrEvent[]) {
  if (!events.length) return;
  await withStore<void>('events', 'readwrite', (store) => {
    events.forEach((event) => store.put(event));
    pruneOldEvents(store, MAX_CACHED_EVENTS);
  }).catch(() => undefined);
  await cacheHashtagEventIndex(events);
}

export async function cacheProfileEvents(events: NostrEvent[]) {
  if (!events.length) return;
  await cacheEvents(events);
  const byPubkey = new Map<string, NostrEvent[]>();
  events.forEach((event) => byPubkey.set(event.pubkey, [...(byPubkey.get(event.pubkey) ?? []), event]));

  await withStore<void>('profileEvents', 'readwrite', (store) => {
    events.forEach((event) =>
      store.put({
        cacheKey: `${event.pubkey}:${event.id}`,
        pubkey: event.pubkey,
        created_at: event.created_at,
        event
      } satisfies CachedProfileEvent)
    );
    byPubkey.forEach((_, pubkey) => pruneOldProfileEvents(store, pubkey, MAX_CACHED_PROFILE_EVENTS));
  }).catch(() => undefined);
}

function pruneOldEvents(store: IDBObjectStore, maxEvents: number) {
  let kept = 0;
  const request = store.index('created_at').openCursor(null, 'prev');
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    kept += 1;
    if (kept > maxEvents) cursor.delete();
    cursor.continue();
  };
}

function pruneOldProfileEvents(store: IDBObjectStore, pubkey: string, maxEvents: number) {
  let kept = 0;
  const range = IDBKeyRange.bound([pubkey, 0], [pubkey, Number.MAX_SAFE_INTEGER]);
  const request = store.index('pubkey_created_at').openCursor(range, 'prev');
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    kept += 1;
    if (kept > maxEvents) cursor.delete();
    cursor.continue();
  };
}

async function cacheHashtagEventIndex(events: NostrEvent[]) {
  const entries = events.flatMap((event) => eventHashtags(event).map((tag) => ({ tag, event })));
  if (!entries.length) return;

  await withStore<void>('hashtagEvents', 'readwrite', (store) => {
    entries.forEach(({ tag, event }) =>
      store.put({
        cacheKey: `${tag}:${event.id}`,
        tag,
        created_at: event.created_at,
        event
      } satisfies CachedHashtagEvent)
    );
    pruneOldHashtagEvents(store, MAX_CACHED_HASHTAG_EVENTS);
  }).catch(() => undefined);
}

function pruneOldHashtagEvents(store: IDBObjectStore, maxEvents: number) {
  let kept = 0;
  const request = store.index('created_at').openCursor(null, 'prev');
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    kept += 1;
    if (kept > maxEvents) cursor.delete();
    cursor.continue();
  };
}

function eventHashtags(event: NostrEvent) {
  const tags = new Set<string>();
  event.tags.forEach((tag) => {
    if (tag[0] === 't' && tag[1]) tags.add(normalizeHashtag(tag[1]));
  });
  for (const match of event.content.matchAll(/(^|[\s([{"'])#([A-Za-z0-9_]{2,64})/g)) tags.add(normalizeHashtag(match[2]));
  return [...tags].filter(Boolean);
}

function normalizeHashtag(tag: string) {
  return tag.trim().replace(/^#/, '').toLowerCase();
}

export async function getCachedEvents(limit = 80) {
  return withStore<NostrEvent[]>('events', 'readonly', (store) => {
    const request = store.index('created_at').openCursor(null, 'prev');
    const events: NostrEvent[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || events.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NostrEvent[]): void }).__setResult(events);
        return;
      }
      events.push(cursor.value as NostrEvent);
      cursor.continue();
    };
  }).catch(() => []);
}

export async function getCachedProfileEvents(pubkey: string, limit = 120) {
  if (!pubkey) return [];
  return withStore<NostrEvent[]>('profileEvents', 'readonly', (store) => {
    const range = IDBKeyRange.bound([pubkey, 0], [pubkey, Number.MAX_SAFE_INTEGER]);
    const request = store.index('pubkey_created_at').openCursor(range, 'prev');
    const events: NostrEvent[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || events.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NostrEvent[]): void }).__setResult(events);
        return;
      }
      events.push((cursor.value as CachedProfileEvent).event);
      cursor.continue();
    };
  }).catch(() => []);
}

export async function getCachedHashtagEvents(tag: string, limit = 120) {
  const clean = normalizeHashtag(tag);
  if (!clean) return [];
  return withStore<NostrEvent[]>('hashtagEvents', 'readonly', (store) => {
    const request = store.index('created_at').openCursor(null, 'prev');
    const events: NostrEvent[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || events.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NostrEvent[]): void }).__setResult(events);
        return;
      }
      const cached = cursor.value as CachedHashtagEvent;
      if (cached.tag === clean) events.push(cached.event);
      cursor.continue();
    };
  }).catch(() => []);
}

function createHashtagEventsStore(db: IDBDatabase) {
  const hashtagEvents = db.createObjectStore('hashtagEvents', { keyPath: 'cacheKey' });
  hashtagEvents.createIndex('tag', 'tag');
  hashtagEvents.createIndex('created_at', 'created_at');
}

export async function cacheProfile(profile: Profile) {
  await withStore<void>('profiles', 'readwrite', (store) => store.put(profile)).catch(() => undefined);
}

export async function getCachedProfiles() {
  return withStore<Profile[]>('profiles', 'readonly', (store) => {
    const request = store.getAll();
    request.onsuccess = () => {
      (store as IDBObjectStore & { __setResult(value: Profile[]): void }).__setResult(request.result as Profile[]);
    };
  }).catch(() => []);
}

export async function resetCacheConnectionForTests() {
  const db = await dbPromise?.catch(() => undefined);
  db?.close();
  dbPromise = undefined;
}
