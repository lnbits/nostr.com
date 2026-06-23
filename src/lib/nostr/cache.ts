import type { DirectMessage, EventStats, NostrEvent, NotificationItem, Profile } from './types';

const DB_NAME = 'nostr-social-cache';
const DB_VERSION = 10;
const MAX_CACHED_EVENTS = 2400;
const MAX_CACHED_PROFILE_EVENTS = 1200;
const MAX_CACHED_HASHTAG_EVENTS = 1200;
const MAX_CACHED_EVENT_STATS = 3000;
const MAX_CACHED_OWN_ACTIONS = 3000;
const MAX_CACHED_DIRECT_MESSAGES_PER_OWNER = 500;
const MAX_CACHED_NOTIFICATIONS_PER_OWNER = 240;
const MAX_CACHED_DELETED_EVENTS = 3000;

export type CachedOwnActionType = 'like' | 'repost';

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

interface CachedDirectMessage {
  cacheKey: string;
  owner: string;
  created_at: number;
  message: DirectMessage;
}

interface CachedNotification {
  cacheKey: string;
  owner: string;
  created_at: number;
  notification: NotificationItem;
}

interface CachedEventStats {
  id: string;
  updated_at: number;
  stats: EventStats;
}

export interface CachedOwnAction {
  cacheKey: string;
  owner: string;
  targetId: string;
  type: CachedOwnActionType;
  updated_at: number;
  event?: NostrEvent;
}

interface CachedDeletedEvent {
  id: string;
  pubkey: string;
  deleted_at: number;
  deletionEvent?: NostrEvent;
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
      } else {
        const hashtagEvents = request.transaction?.objectStore('hashtagEvents');
        if (hashtagEvents && !hashtagEvents.indexNames.contains('tag_created_at')) {
          hashtagEvents.createIndex('tag_created_at', ['tag', 'created_at']);
        }
      }
      if (!db.objectStoreNames.contains('eventStats')) {
        const eventStats = db.createObjectStore('eventStats', { keyPath: 'id' });
        eventStats.createIndex('updated_at', 'updated_at');
      }
      if (!db.objectStoreNames.contains('ownActions')) {
        const ownActions = db.createObjectStore('ownActions', { keyPath: 'cacheKey' });
        ownActions.createIndex('owner', 'owner');
        ownActions.createIndex('updated_at', 'updated_at');
      }
      if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'pubkey' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('directMessages')) {
        const directMessages = db.createObjectStore('directMessages', { keyPath: 'cacheKey' });
        directMessages.createIndex('owner_created_at', ['owner', 'created_at']);
      }
      if (!db.objectStoreNames.contains('notifications')) {
        const notifications = db.createObjectStore('notifications', { keyPath: 'cacheKey' });
        notifications.createIndex('owner_created_at', ['owner', 'created_at']);
      }
      if (!db.objectStoreNames.contains('deletedEvents')) {
        const deletedEvents = db.createObjectStore('deletedEvents', { keyPath: 'id' });
        deletedEvents.createIndex('deleted_at', 'deleted_at');
      }
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
    let result: T | undefined;
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    (store as IDBObjectStore & { __setResult?: (value: T) => void }).__setResult = (value: T) => {
      result = value;
    };
    try {
      fn(store);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export async function cacheEvents(events: NostrEvent[]) {
  const normalized = normalizeCachedEvents(events);
  if (!normalized.length) return;
  await withStore<void>('events', 'readwrite', (store) => {
    normalized.forEach((event) => store.put(event));
    pruneOldEvents(store, MAX_CACHED_EVENTS);
  }).catch(() => undefined);
  await cacheHashtagEventIndex(normalized);
}

export async function removeCachedEventsByIds(ids: string[]) {
  const idSet = new Set(ids.map(normalizeEventId).filter(Boolean));
  if (!idSet.size) return;
  await Promise.all([
    withStore<void>('events', 'readwrite', (store) => {
      idSet.forEach((id) => store.delete(id));
    }),
    deleteCachedEventIndexEntries('profileEvents', idSet),
    deleteCachedEventIndexEntries('hashtagEvents', idSet),
    deleteCachedOwnActionsByEventIds(idSet)
  ]).catch(() => undefined);
}

export async function cacheDeletedEventIds(ids: string[], pubkey = '', deletionEvent?: NostrEvent) {
  const idSet = new Set(ids.map(normalizeEventId).filter(Boolean));
  const cleanPubkey = normalizePubkey(pubkey);
  const cleanDeletionEvent = deletionEvent ? normalizeCachedEvent(deletionEvent) || undefined : undefined;
  if (!idSet.size) return;
  await withStore<void>('deletedEvents', 'readwrite', (store) => {
    idSet.forEach((id) =>
      store.put({
        id,
        pubkey: cleanPubkey,
        deleted_at: Date.now(),
        deletionEvent: cleanDeletionEvent
      } satisfies CachedDeletedEvent)
    );
    pruneOldDeletedEvents(store, MAX_CACHED_DELETED_EVENTS);
  }).catch(() => undefined);
  await removeCachedEventsByIds([...idSet]);
}

export async function cacheDeletionRequest(event: NostrEvent, deletedIds?: string[]) {
  const cleanEvent = normalizeCachedEvent(event);
  if (!cleanEvent || cleanEvent.kind !== 5) return;
  const ids = deletedIds ?? cleanEvent.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1]);
  await cacheDeletedEventIds(ids, cleanEvent.pubkey, cleanEvent);
}

export async function getCachedDeletedEventIds(ids: string[] = []) {
  const idSet = new Set(ids.map(normalizeEventId).filter(Boolean));
  return withStore<Set<string>>('deletedEvents', 'readonly', (store) => {
    const deleted = new Set<string>();
    if (idSet.size) {
      let remaining = idSet.size;
      idSet.forEach((id) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) deleted.add(id);
          remaining -= 1;
          if (!remaining) (store as IDBObjectStore & { __setResult(value: Set<string>): void }).__setResult(deleted);
        };
        request.onerror = () => {
          remaining -= 1;
          if (!remaining) (store as IDBObjectStore & { __setResult(value: Set<string>): void }).__setResult(deleted);
        };
      });
      return;
    }

    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        (store as IDBObjectStore & { __setResult(value: Set<string>): void }).__setResult(deleted);
        return;
      }
      deleted.add((cursor.value as CachedDeletedEvent).id);
      cursor.continue();
    };
  }).catch(() => new Set<string>());
}

export async function cacheProfileEvents(events: NostrEvent[]) {
  const normalized = normalizeCachedEvents(events);
  if (!normalized.length) return;
  await cacheEvents(normalized);
  const touchedPubkeys = new Set(normalized.map((event) => event.pubkey));

  await withStore<void>('profileEvents', 'readwrite', (store) => {
    normalized.forEach((event) =>
      store.put({
        cacheKey: `${event.pubkey}:${event.id}`,
        pubkey: event.pubkey,
        created_at: event.created_at,
        event
      } satisfies CachedProfileEvent)
    );
    touchedPubkeys.forEach((pubkey) => pruneOldProfileEvents(store, pubkey, MAX_CACHED_PROFILE_EVENTS));
  }).catch(() => undefined);
}

export async function cacheEventStats(statsById: Record<string, EventStats>) {
  const entries = Object.entries(statsById)
    .map(([id, stats]) => [normalizeEventId(id), stats] as const)
    .filter(([id]) => id);
  if (!entries.length) return;
  const updated_at = Date.now();
  await withStore<void>('eventStats', 'readwrite', (store) => {
    entries.forEach(([id, stats]) =>
      store.put({
        id,
        updated_at,
        stats
      } satisfies CachedEventStats)
    );
    pruneOldEventStats(store, MAX_CACHED_EVENT_STATS);
  }).catch(() => undefined);
}

export async function cacheOwnAction(owner: string, targetId: string, type: CachedOwnActionType, event?: NostrEvent) {
  const cleanOwner = normalizePubkey(owner);
  const cleanTargetId = normalizeEventId(targetId);
  if (!cleanOwner || !cleanTargetId) return;
  const cleanEvent = event ? normalizeCachedEvent(event) || undefined : undefined;
  const updated_at = Date.now();
  await withStore<void>('ownActions', 'readwrite', (store) => {
    store.put({
      cacheKey: ownActionCacheKey(cleanOwner, cleanTargetId, type),
      owner: cleanOwner,
      targetId: cleanTargetId,
      type,
      updated_at,
      event: cleanEvent
    } satisfies CachedOwnAction);
    pruneOldOwnActions(store, MAX_CACHED_OWN_ACTIONS);
  }).catch(() => undefined);
  if (cleanEvent) await cacheEvents([cleanEvent]);
}

export async function removeCachedOwnAction(owner: string, targetId: string, type: CachedOwnActionType) {
  const cleanOwner = normalizePubkey(owner);
  const cleanTargetId = normalizeEventId(targetId);
  if (!cleanOwner || !cleanTargetId) return;
  await withStore<void>('ownActions', 'readwrite', (store) => {
    store.delete(ownActionCacheKey(cleanOwner, cleanTargetId, type));
  }).catch(() => undefined);
}

export async function getCachedOwnActions(owner: string, targetIds: string[] = []) {
  const cleanOwner = normalizePubkey(owner);
  if (!cleanOwner) return [];
  const targetSet = new Set(targetIds.map(normalizeEventId).filter(Boolean));
  return withStore<CachedOwnAction[]>('ownActions', 'readonly', (store) => {
    const request = store.index('owner').openCursor(IDBKeyRange.only(cleanOwner));
    const actions: CachedOwnAction[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        (store as IDBObjectStore & { __setResult(value: CachedOwnAction[]): void }).__setResult(actions);
        return;
      }
      const action = cursor.value as CachedOwnAction;
      if (!targetSet.size || targetSet.has(action.targetId)) actions.push(action);
      cursor.continue();
    };
  }).catch(() => []);
}

export async function getCachedEventStats(ids: string[]) {
  const uniqueIds = [...new Set(ids.map(normalizeEventId).filter(Boolean))];
  if (!uniqueIds.length) return {};
  return withStore<Record<string, EventStats>>('eventStats', 'readonly', (store) => {
    const stats: Record<string, EventStats> = {};
    let remaining = uniqueIds.length;
    const finish = () => {
      remaining -= 1;
      if (remaining <= 0) (store as IDBObjectStore & { __setResult(value: Record<string, EventStats>): void }).__setResult(stats);
    };

    uniqueIds.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const cached = request.result as CachedEventStats | undefined;
        if (cached?.stats) stats[id] = cached.stats;
        finish();
      };
      request.onerror = () => finish();
    });
  }).catch(() => ({}));
}

function pruneOldEvents(store: IDBObjectStore, maxEvents: number) {
  pruneOverflow(store.index('created_at'), maxEvents);
}

function pruneOldEventStats(store: IDBObjectStore, maxStats: number) {
  pruneOverflow(store.index('updated_at'), maxStats);
}

function pruneOldOwnActions(store: IDBObjectStore, maxActions: number) {
  pruneOverflow(store.index('updated_at'), maxActions);
}

function pruneOldDeletedEvents(store: IDBObjectStore, maxEvents: number) {
  pruneOverflow(store.index('deleted_at'), maxEvents);
}

function pruneOldProfileEvents(store: IDBObjectStore, pubkey: string, maxEvents: number) {
  const range = IDBKeyRange.bound([pubkey, 0], [pubkey, Number.MAX_SAFE_INTEGER]);
  pruneOverflow(store.index('pubkey_created_at'), maxEvents, range);
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
  pruneOverflow(store.index('created_at'), maxEvents);
}

function pruneOverflow(index: IDBIndex, maxItems: number, query?: IDBValidKey | IDBKeyRange) {
  const countRequest = index.count(query);
  countRequest.onsuccess = () => {
    let remainingDeletes = Math.max(0, countRequest.result - maxItems);
    if (!remainingDeletes) return;

    const cursorRequest = index.openCursor(query, 'next');
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || remainingDeletes <= 0) return;
      cursor.delete();
      remainingDeletes -= 1;
      cursor.continue();
    };
  };
}

async function deleteCachedEventIndexEntries(storeName: 'profileEvents' | 'hashtagEvents', idSet: Set<string>) {
  await withStore<void>(storeName, 'readwrite', (store) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const cached = cursor.value as CachedProfileEvent | CachedHashtagEvent;
      if (idSet.has(cached.event.id)) cursor.delete();
      cursor.continue();
    };
  });
}

async function deleteCachedOwnActionsByEventIds(idSet: Set<string>) {
  await withStore<void>('ownActions', 'readwrite', (store) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const cached = cursor.value as CachedOwnAction;
      if (cached.event?.id && idSet.has(cached.event.id)) cursor.delete();
      cursor.continue();
    };
  });
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
  const events = await withStore<NostrEvent[]>('events', 'readonly', (store) => {
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
  return filterCachedDeletedEvents(events, limit);
}

export async function getCachedThreadEvents(rootId: string, limit = 160, scanLimit = MAX_CACHED_EVENTS) {
  const cleanRootId = normalizeEventId(rootId);
  if (!cleanRootId) return [];
  const events = await withStore<NostrEvent[]>('events', 'readonly', (store) => {
    const request = store.index('created_at').openCursor(null, 'prev');
    const candidates: NostrEvent[] = [];
    const includedIds = new Set([cleanRootId]);
    let scanned = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || scanned >= scanLimit || candidates.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NostrEvent[]): void }).__setResult(candidates);
        return;
      }

      scanned += 1;
      const event = cursor.value as NostrEvent;
      const referencedIds = event.tags.map((tag) => (tag[0] === 'e' && tag[1] ? normalizeEventId(tag[1]) : '')).filter(Boolean);
      if (event.id === cleanRootId || referencedIds.some((id) => includedIds.has(id))) {
        candidates.push(event);
        includedIds.add(event.id);
      }
      cursor.continue();
    };
  }).catch(() => []);
  return filterCachedDeletedEvents(events, limit);
}

export async function getCachedProfileEvents(pubkey: string, limit = 120) {
  const cleanPubkey = normalizePubkey(pubkey);
  if (!cleanPubkey) return [];
  const events = await withStore<NostrEvent[]>('profileEvents', 'readonly', (store) => {
    const range = IDBKeyRange.bound([cleanPubkey, 0], [cleanPubkey, Number.MAX_SAFE_INTEGER]);
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
  return filterCachedDeletedEvents(events, limit);
}

export async function getCachedHashtagEvents(tag: string, limit = 120) {
  const clean = normalizeHashtag(tag);
  if (!clean) return [];
  const events = await withStore<NostrEvent[]>('hashtagEvents', 'readonly', (store) => {
    const range = IDBKeyRange.bound([clean, 0], [clean, Number.MAX_SAFE_INTEGER]);
    const request = store.index('tag_created_at').openCursor(range, 'prev');
    const events: NostrEvent[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || events.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NostrEvent[]): void }).__setResult(events);
        return;
      }
      const cached = cursor.value as CachedHashtagEvent;
      events.push(cached.event);
      cursor.continue();
    };
  }).catch(() => []);
  return filterCachedDeletedEvents(events, limit);
}

async function filterCachedDeletedEvents(events: NostrEvent[], limit: number) {
  if (!events.length) return [];
  const deleted = await getCachedDeletedEventIds(events.map((event) => event.id));
  return deleted.size ? events.filter((event) => !deleted.has(event.id)).slice(0, limit) : events.slice(0, limit);
}

function createHashtagEventsStore(db: IDBDatabase) {
  const hashtagEvents = db.createObjectStore('hashtagEvents', { keyPath: 'cacheKey' });
  hashtagEvents.createIndex('tag', 'tag');
  hashtagEvents.createIndex('created_at', 'created_at');
  hashtagEvents.createIndex('tag_created_at', ['tag', 'created_at']);
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

export async function cacheDirectMessages(ownerPubkey: string, messages: DirectMessage[]) {
  const owner = normalizePubkey(ownerPubkey);
  if (!owner || !messages.length) return;
  await withStore<void>('directMessages', 'readwrite', (store) => {
    messages.forEach((message) => {
      const normalized = normalizeDirectMessage(message);
      if (!normalized) return;
      store.put({
        cacheKey: `${owner}:${normalized.id}`,
        owner,
        created_at: normalized.created_at,
        message: normalized
      } satisfies CachedDirectMessage);
    });
    pruneOldDirectMessages(store, owner, MAX_CACHED_DIRECT_MESSAGES_PER_OWNER);
  }).catch(() => undefined);
}

export async function getCachedDirectMessages(ownerPubkey: string, limit = 400) {
  const owner = normalizePubkey(ownerPubkey);
  if (!owner) return [];
  return withStore<DirectMessage[]>('directMessages', 'readonly', (store) => {
    const range = IDBKeyRange.bound([owner, 0], [owner, Number.MAX_SAFE_INTEGER]);
    const request = store.index('owner_created_at').openCursor(range, 'prev');
    const messages: DirectMessage[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || messages.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: DirectMessage[]): void }).__setResult(messages);
        return;
      }
      messages.push((cursor.value as CachedDirectMessage).message);
      cursor.continue();
    };
  }).catch(() => []);
}

export async function cacheNotifications(ownerPubkey: string, notifications: NotificationItem[]) {
  const owner = normalizePubkey(ownerPubkey);
  if (!owner || !notifications.length) return;
  await withStore<void>('notifications', 'readwrite', (store) => {
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (!normalized) return;
      store.put({
        cacheKey: `${owner}:${normalized.id}`,
        owner,
        created_at: normalized.event.created_at,
        notification: normalized
      } satisfies CachedNotification);
    });
    pruneOldNotifications(store, owner, MAX_CACHED_NOTIFICATIONS_PER_OWNER);
  }).catch(() => undefined);
}

export async function getCachedNotifications(ownerPubkey: string, limit = 160) {
  const owner = normalizePubkey(ownerPubkey);
  if (!owner) return [];
  return withStore<NotificationItem[]>('notifications', 'readonly', (store) => {
    const range = IDBKeyRange.bound([owner, 0], [owner, Number.MAX_SAFE_INTEGER]);
    const request = store.index('owner_created_at').openCursor(range, 'prev');
    const notifications: NotificationItem[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || notifications.length >= limit) {
        (store as IDBObjectStore & { __setResult(value: NotificationItem[]): void }).__setResult(notifications);
        return;
      }
      notifications.push((cursor.value as CachedNotification).notification);
      cursor.continue();
    };
  }).catch(() => []);
}

function pruneOldDirectMessages(store: IDBObjectStore, owner: string, maxMessages: number) {
  const range = IDBKeyRange.bound([owner, 0], [owner, Number.MAX_SAFE_INTEGER]);
  pruneOverflow(store.index('owner_created_at'), maxMessages, range);
}

function pruneOldNotifications(store: IDBObjectStore, owner: string, maxItems: number) {
  const range = IDBKeyRange.bound([owner, 0], [owner, Number.MAX_SAFE_INTEGER]);
  pruneOverflow(store.index('owner_created_at'), maxItems, range);
}

function normalizeDirectMessage(message: DirectMessage) {
  const peer = normalizePubkey(message.peer);
  const from = normalizePubkey(message.from);
  const to = message.to
    .split(',')
    .map(normalizePubkey)
    .filter(Boolean)
    .join(',');
  if (!message.id || !peer || !from) return null;
  return { ...message, peer, from, to };
}

function normalizeNotification(notification: NotificationItem) {
  const actor = normalizePubkey(notification.actor || notification.event.pubkey);
  const event = normalizeCachedEvent(notification.event);
  const targetEvent = notification.targetEvent ? normalizeCachedEvent(notification.targetEvent) || undefined : undefined;
  const targetId = notification.targetId ? normalizeEventId(notification.targetId) : notification.targetId;
  if (!notification.id || !actor || !event) return null;
  return { ...notification, actor, event, targetEvent, targetId };
}

function normalizeCachedEvents(events: NostrEvent[]) {
  const byId = new Map<string, NostrEvent>();
  events.forEach((event) => {
    const normalized = normalizeCachedEvent(event);
    if (normalized) byId.set(normalized.id, normalized);
  });
  return [...byId.values()];
}

function normalizeCachedEvent(event: NostrEvent | undefined | null): NostrEvent | null {
  if (!event) return null;
  const id = normalizeEventId(event.id);
  const pubkey = normalizePubkey(event.pubkey);
  if (!id || !pubkey || !Number.isFinite(event.created_at) || !Number.isFinite(event.kind)) return null;
  return {
    ...event,
    id,
    pubkey,
    created_at: Math.trunc(event.created_at),
    kind: Math.trunc(event.kind),
    tags: Array.isArray(event.tags)
      ? event.tags.map((tag) => (Array.isArray(tag) ? tag.filter((item): item is string => typeof item === 'string') : [])).filter((tag) => tag.length)
      : [],
    content: typeof event.content === 'string' ? event.content : ''
  };
}

function normalizePubkey(value: string) {
  const clean = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(clean) ? clean : '';
}

function normalizeEventId(value: string) {
  const clean = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(clean) ? clean : '';
}

function ownActionCacheKey(owner: string, targetId: string, type: CachedOwnActionType) {
  return `${owner}:${targetId}:${type}`;
}

export async function clearEventCache() {
  await Promise.all([
    withStore<void>('events', 'readwrite', (store) => store.clear()),
    withStore<void>('profileEvents', 'readwrite', (store) => store.clear()),
    withStore<void>('hashtagEvents', 'readwrite', (store) => store.clear()),
    withStore<void>('eventStats', 'readwrite', (store) => store.clear()),
    withStore<void>('ownActions', 'readwrite', (store) => store.clear()),
    withStore<void>('notifications', 'readwrite', (store) => store.clear())
  ]).catch(() => undefined);
}

export async function resetCacheConnectionForTests() {
  const db = await dbPromise?.catch(() => undefined);
  db?.close();
  dbPromise = undefined;
}
