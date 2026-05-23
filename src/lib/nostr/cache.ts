import type { NostrEvent, Profile } from './types';

const DB_NAME = 'nostr-social-cache';
const DB_VERSION = 2;
const MAX_CACHED_EVENTS = 600;
const MAX_CACHED_PROFILE_EVENTS = 600;

interface CachedProfileEvent {
  cacheKey: string;
  pubkey: string;
  created_at: number;
  event: NostrEvent;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
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
