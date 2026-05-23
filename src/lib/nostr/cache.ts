import type { NostrEvent, Profile } from './types';

const DB_NAME = 'nostr-social-cache';
const DB_VERSION = 1;
const MAX_CACHED_EVENTS = 600;

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
