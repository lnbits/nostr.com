import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getCachedEvents, getCachedProfiles } from '$lib/nostr/cache';
import { defaultCustomFeedSettings, defaultGuestNip05, defaultRelays } from '$lib/nostr/config';
import {
  createGuestSession,
  fetchContactListDetails,
  fetchFeed,
  fetchProfiles,
  loginWithBunker,
  loginWithNip07,
  loginWithPrivateKey,
  publishNote,
  publishProfile,
  resolveNip05Profile
} from '$lib/nostr/client';
import type { CustomFeedSettings, FeedMode, NostrEvent, NotificationItem, Profile, RelayState, Session } from '$lib/nostr/types';

const sessionStorageKey = 'nostr-session';
const customFeedStorageKey = 'nostr-custom-feed-settings';
const initialFeedLimit = 18;
const pageFeedLimit = 24;

const initialSession = browser ? readStoredSession() : null;
const initialCustomFeedSettings = browser ? readStoredCustomFeedSettings() : defaultCustomFeedSettings;

export const feedMode = writable<FeedMode>('global');
export const events = writable<NostrEvent[]>([]);
export const profiles = writable<Record<string, Profile>>({});
export const relays = writable<RelayState[]>(defaultRelays);
export const session = writable<Session | null>(initialSession);
export const follows = writable<string[]>([]);
export const customFeedSettings = writable<CustomFeedSettings>(initialCustomFeedSettings);
export const online = writable(true);
export const notifications = writable<NotificationItem[]>([]);
export const loadingFeed = writable(false);
export const loadingMoreFeed = writable(false);
export const hasMoreFeed = writable(true);
export const composerOpen = writable(false);
export const loginDialogOpen = writable(false);
export const replyTarget = writable<NostrEvent | null>(null);

let currentRelays = defaultRelays;
let currentFollows: string[] = [];
let currentSettings = defaultCustomFeedSettings;
let currentMode: FeedMode = 'global';
let oldestFeedTimestamp: number | undefined;

relays.subscribe((value) => (currentRelays = value));
follows.subscribe((value) => (currentFollows = value));
customFeedSettings.subscribe((value) => {
  currentSettings = value;
  if (browser) localStorage.setItem(customFeedStorageKey, JSON.stringify(value));
});
feedMode.subscribe((value) => (currentMode = value));

export async function bootstrap() {
  if (!browser) return;
  online.set(navigator.onLine);
  addEventListener('online', () => online.set(true));
  addEventListener('offline', () => online.set(false));

  const [cachedEvents, cachedProfiles] = await Promise.all([getCachedEvents(initialFeedLimit), getCachedProfiles()]);
  events.set(cachedEvents);
  oldestFeedTimestamp = getOldestTimestamp(cachedEvents);
  profiles.set(Object.fromEntries(cachedProfiles.map((profile) => [profile.pubkey, profile])));
  await hydrateDefaultFeedContext();
  void refreshFeed();
}

export async function refreshFeed(mode = currentMode) {
  loadingFeed.set(true);
  hasMoreFeed.set(true);
  oldestFeedTimestamp = undefined;
  try {
    const nextEvents = await fetchFeed(mode, currentRelays, currentFollows, currentSettings, { limit: initialFeedLimit });
    events.update((existing) => mergeEvents(nextEvents, existing));
    oldestFeedTimestamp = getOldestTimestamp(nextEvents);
    const pubkeys = [...new Set(nextEvents.map((event) => event.pubkey))].slice(0, 60);
    const foundProfiles = await fetchProfiles(pubkeys, currentRelays);
    profiles.update((existing) => ({
      ...existing,
      ...Object.fromEntries(foundProfiles.map((profile) => [profile.pubkey, profile]))
    }));
  } finally {
    loadingFeed.set(false);
  }
}

export async function loadMoreFeed() {
  let loading = false;
  let more = true;
  loadingMoreFeed.subscribe((value) => (loading = value))();
  hasMoreFeed.subscribe((value) => (more = value))();
  if (loading || !more) return;

  loadingMoreFeed.set(true);
  try {
    const olderThan = oldestFeedTimestamp ? oldestFeedTimestamp - 1 : undefined;
    const nextEvents = await fetchFeed(currentMode, currentRelays, currentFollows, currentSettings, {
      limit: pageFeedLimit,
      until: olderThan
    });
    if (nextEvents.length < pageFeedLimit) hasMoreFeed.set(false);
    if (!nextEvents.length) return;
    const nextOldest = getOldestTimestamp(nextEvents);
    if (nextOldest !== undefined) oldestFeedTimestamp = oldestFeedTimestamp === undefined ? nextOldest : Math.min(oldestFeedTimestamp, nextOldest);
    events.update((existing) => mergeEvents(nextEvents, existing));
    const pubkeys = [...new Set(nextEvents.map((event) => event.pubkey))].slice(0, 40);
    const foundProfiles = await fetchProfiles(pubkeys, currentRelays);
    profiles.update((existing) => ({
      ...existing,
      ...Object.fromEntries(foundProfiles.map((profile) => [profile.pubkey, profile]))
    }));
  } finally {
    loadingMoreFeed.set(false);
  }
}

export async function signIn(mode: 'nip07' | 'private-key' | 'bunker' | 'guest', value = '') {
  const next =
    mode === 'nip07'
      ? await loginWithNip07()
      : mode === 'private-key'
        ? loginWithPrivateKey(value)
        : mode === 'bunker'
          ? loginWithBunker(value)
          : createGuestSession();
  session.set(next);
  persistSession(next);
  await hydrateSignedInFeedContext(next);
  void refreshFeed();
}

export async function signOut() {
  session.set(null);
  if (browser) localStorage.removeItem(sessionStorageKey);
  await hydrateGuestFeedContext();
  void refreshFeed();
}

export async function postNote(content: string, parent?: NostrEvent) {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) throw new Error('Sign in before posting.');
  const tags = parent ? [['e', parent.id], ['p', parent.pubkey]] : [];
  const event = await publishNote(currentSession, content, currentRelays, tags);
  events.update((existing) => mergeEvents([event], existing));
  replyTarget.set(null);
}

export async function saveProfile(nextProfile: Profile) {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) throw new Error('Sign in before updating your profile.');
  const { profile } = await publishProfile(currentSession, nextProfile, currentRelays);
  profiles.update((existing) => ({
    ...existing,
    [profile.pubkey]: profile
  }));
}

export function mergeEvents(incoming: NostrEvent[], existing: NostrEvent[]) {
  const byId = new Map<string, NostrEvent>();
  [...existing, ...incoming].forEach((event) => byId.set(event.id, event));
  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}

function getOldestTimestamp(items: NostrEvent[]) {
  if (!items.length) return undefined;
  return Math.min(...items.map((event) => event.created_at));
}

export function startReply(event: NostrEvent) {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) {
    loginDialogOpen.set(true);
    return;
  }
  replyTarget.set(event);
  composerOpen.set(true);
}

export function startCompose() {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) {
    loginDialogOpen.set(true);
    return;
  }
  replyTarget.set(null);
  composerOpen.set(true);
}

function hydrateSession() {
  const saved = readStoredSession();
  if (saved) session.set(saved);
}

function persistSession(next: Session) {
  if (!browser) return;
  localStorage.setItem(sessionStorageKey, JSON.stringify(next));
}

function readStoredSession() {
  const raw = localStorage.getItem(sessionStorageKey);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Session;
    return saved?.pubkey && saved?.mode ? saved : null;
  } catch {
    localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function readStoredCustomFeedSettings() {
  const raw = localStorage.getItem(customFeedStorageKey);
  if (!raw) return defaultCustomFeedSettings;
  try {
    const saved = JSON.parse(raw) as Partial<CustomFeedSettings>;
    return {
      ...defaultCustomFeedSettings,
      ...saved,
      friendsOfFriends: typeof saved.friendsOfFriends === 'boolean' ? saved.friendsOfFriends : defaultCustomFeedSettings.friendsOfFriends,
      keywords: Array.isArray(saved.keywords) ? saved.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : []
    };
  } catch {
    localStorage.removeItem(customFeedStorageKey);
    return defaultCustomFeedSettings;
  }
}

async function hydrateDefaultFeedContext() {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (currentSession) {
    await hydrateSignedInFeedContext(currentSession);
  } else {
    await hydrateGuestFeedContext();
  }
}

async function hydrateSignedInFeedContext(currentSession: Session) {
  const contacts = await fetchContactListDetails(currentSession.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [] }));
  mergeRelayHints(contacts.relayHints, 74);
  follows.set(contacts.pubkeys);
  feedMode.set(hasCustomFeedFilters(currentSettings) ? 'custom' : 'follow');
}

async function hydrateGuestFeedContext() {
  const profile = await resolveNip05Profile(defaultGuestNip05).catch(() => null);
  if (!profile) {
    feedMode.set('global');
    return;
  }

  mergeRelayHints(profile.relayHints, 96);
  const contacts = await fetchContactListDetails(profile.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [] }));
  mergeRelayHints(contacts.relayHints, 74);
  follows.set(contacts.pubkeys.length ? contacts.pubkeys : [profile.pubkey]);
  feedMode.set('follow');
}

function hasCustomFeedFilters(settings: CustomFeedSettings) {
  return settings.friendsOfFriends || settings.keywords.some((keyword) => keyword.trim());
}

function mergeRelayHints(urls: string[], startingScore = 76) {
  const clean = [...new Set(urls.filter((url) => /^wss:\/\/[^ ]+\.[^ ]+/.test(url)))].slice(0, 12);
  if (!clean.length) return;

  relays.update((existing) => {
    const known = new Set(existing.map((relay) => relay.url));
    const additions = clean
      .filter((url) => !known.has(url))
      .map((url, index) => ({
        url,
        enabled: true,
        read: true,
        write: false,
        score: Math.max(55, startingScore - index)
      }));

    return additions.length ? [...existing, ...additions] : existing;
  });
}
