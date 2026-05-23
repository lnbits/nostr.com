import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getCachedEvents, getCachedProfiles } from '$lib/nostr/cache';
import { defaultCustomFeedSettings, defaultGuestNip05, defaultRelays } from '$lib/nostr/config';
import {
  createGuestSession,
  fetchDirectMessages,
  fetchContactListDetails,
  fetchFeed,
  fetchEventStats,
  fetchProfiles,
  fetchRelayInfoDocuments,
  fetchRelayListMetadata,
  limitConsecutiveAuthors,
  loginWithBunker,
  loginWithNip07,
  loginWithPrivateKey,
  publishContactList,
  publishNote,
  publishProfile,
  publishReaction,
  publishRelayListMetadata,
  publishReport,
  publishRepost,
  resolveNip05Profile,
  topLevelFeedEvents
} from '$lib/nostr/client';
import type { ContactListItem, CustomFeedSettings, DirectMessage, EventStats, FeedMode, NostrEvent, NotificationItem, Profile, RelayState, Session } from '$lib/nostr/types';

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
export const activeHashtag = writable<string>('');
export const online = writable(true);
export const notifications = writable<NotificationItem[]>([]);
export const directMessages = writable<DirectMessage[]>([]);
export const eventStats = writable<Record<string, EventStats>>({});
export const likedEvents = writable<Set<string>>(new Set());
export const loadingFeed = writable(false);
export const loadingNewerFeed = writable(false);
export const loadingMessages = writable(false);
export const loadingMoreFeed = writable(false);
export const hasMoreFeed = writable(true);
export const composerOpen = writable(false);
export const loginDialogOpen = writable(false);
export const replyTarget = writable<NostrEvent | null>(null);

let currentRelays = defaultRelays;
let currentFollows: string[] = [];
let currentSettings = defaultCustomFeedSettings;
let currentMode: FeedMode = 'global';
let currentHashtag = '';
let currentContactItems: ContactListItem[] = [];
let oldestFeedTimestamp: number | undefined;
const requestedStats = new Set<string>();

relays.subscribe((value) => (currentRelays = value));
follows.subscribe((value) => (currentFollows = value));
customFeedSettings.subscribe((value) => {
  currentSettings = value;
  if (browser) localStorage.setItem(customFeedStorageKey, JSON.stringify(value));
});
feedMode.subscribe((value) => (currentMode = value));
activeHashtag.subscribe((value) => (currentHashtag = value));

export async function bootstrap() {
  if (!browser) return;
  online.set(navigator.onLine);
  addEventListener('online', () => online.set(true));
  addEventListener('offline', () => online.set(false));

  const [cachedEvents, cachedProfiles] = await Promise.all([getCachedEvents(initialFeedLimit), getCachedProfiles()]);
  const cachedTopLevelEvents = topLevelFeedEvents(cachedEvents);
  events.set(cachedTopLevelEvents);
  oldestFeedTimestamp = getOldestTimestamp(cachedTopLevelEvents);
  profiles.set(Object.fromEntries(cachedProfiles.map((profile) => [profile.pubkey, profile])));
  await hydrateDefaultFeedContext();
  void refreshRelayInfo();
  void refreshFeed();
}

export async function refreshFeed(mode = currentMode) {
  loadingFeed.set(true);
  hasMoreFeed.set(true);
  oldestFeedTimestamp = undefined;
  requestedStats.clear();

  if ((mode === 'follow' || mode === 'custom') && !currentFollows.length) {
    events.set([]);
    loadingFeed.set(false);
    return;
  }

  try {
    const nextEvents = await fetchFeed(mode, currentRelays, currentFollows, currentSettings, { limit: initialFeedLimit, hashtag: currentHashtag });
    events.set(nextEvents);
    oldestFeedTimestamp = getOldestTimestamp(nextEvents);
    void refreshEventStats(nextEvents.map((event) => event.id));
    void hydrateMissingProfiles(nextEvents, 60);
  } finally {
    loadingFeed.set(false);
  }
}

export async function loadNewerFeed() {
  if (currentMode !== 'global') return;
  let loading = false;
  loadingNewerFeed.subscribe((value) => (loading = value))();
  if (loading) return;

  const newestTimestamp = getNewestTimestamp(getStoreSnapshot(events));
  if (!newestTimestamp) return;

  loadingNewerFeed.set(true);
  try {
    const nextEvents = await fetchFeed(currentMode, currentRelays, currentFollows, currentSettings, {
      limit: initialFeedLimit,
      since: newestTimestamp + 1,
      hashtag: currentHashtag
    });
    if (!nextEvents.length) return;
    events.update((existing) => {
      const merged = mergeEvents(nextEvents, existing);
      oldestFeedTimestamp = getOldestTimestamp(merged);
      return merged;
    });
    void refreshEventStats(nextEvents.map((event) => event.id));
    void hydrateMissingProfiles(nextEvents, 60);
  } finally {
    loadingNewerFeed.set(false);
  }
}

export async function loadMoreFeed(force = false) {
  let loading = false;
  let more = true;
  loadingMoreFeed.subscribe((value) => (loading = value))();
  hasMoreFeed.subscribe((value) => (more = value))();
  if (loading || (!force && !more)) return;

  loadingMoreFeed.set(true);
  try {
    const olderThan = oldestFeedTimestamp ? oldestFeedTimestamp - 1 : undefined;
    const nextEvents = await fetchFeed(currentMode, currentRelays, currentFollows, currentSettings, {
      limit: pageFeedLimit,
      until: olderThan,
      hashtag: currentHashtag
    });
    if (nextEvents.length < pageFeedLimit) hasMoreFeed.set(false);
    else hasMoreFeed.set(true);
    if (!nextEvents.length) return;
    const nextOldest = getOldestTimestamp(nextEvents);
    if (nextOldest !== undefined) oldestFeedTimestamp = oldestFeedTimestamp === undefined ? nextOldest : Math.min(oldestFeedTimestamp, nextOldest);
    events.update((existing) => mergeEvents(nextEvents, existing));
    void refreshEventStats(nextEvents.map((event) => event.id));
    void hydrateMissingProfiles(nextEvents, 40);
  } finally {
    loadingMoreFeed.set(false);
  }
}

export async function refreshEventStats(ids: string[]) {
  const nextIds = ids.filter((id) => !requestedStats.has(id));
  nextIds.forEach((id) => requestedStats.add(id));
  if (!nextIds.length) return;
  const stats = await fetchEventStats(nextIds, currentRelays).catch(() => ({}));
  eventStats.update((existing) => ({
    ...existing,
    ...stats
  }));
}

export function filterByHashtag(tag: string) {
  activeHashtag.set(tag.trim().replace(/^#/, '').toLowerCase());
  void refreshFeed(currentMode);
}

export async function refreshRelayInfo() {
  const enriched = await fetchRelayInfoDocuments(currentRelays).catch(() => currentRelays);
  relays.set(enriched);
}

export async function refreshMessages() {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) {
    directMessages.set([]);
    return;
  }

  loadingMessages.set(true);
  try {
    directMessages.set(await fetchDirectMessages(currentSession, currentRelays));
  } finally {
    loadingMessages.set(false);
  }
}

export async function signIn(mode: 'nip07' | 'private-key' | 'bunker' | 'guest', value = '') {
  const next =
    mode === 'nip07'
      ? await loginWithNip07()
      : mode === 'private-key'
        ? loginWithPrivateKey(value)
        : mode === 'bunker'
          ? await loginWithBunker(value)
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
  const tags = parent ? replyTags(parent) : [];
  const event = await publishNote(currentSession, content, currentRelays, tags);
  events.update((existing) => mergeEvents([event], existing));
  replyTarget.set(null);
}

export async function repostNote(target: NostrEvent) {
  const currentSession = requireSession('Sign in before reposting.');
  const event = await publishRepost(currentSession, target, currentRelays);
  events.update((existing) => mergeEvents([event], existing));
  eventStats.update((existing) => ({
    ...existing,
    [target.id]: {
      ...(existing[target.id] ?? emptyStats()),
      reposts: (existing[target.id]?.reposts ?? 0) + 1
    }
  }));
}

export async function reactToNote(target: NostrEvent, content = '+') {
  const currentSession = requireSession('Sign in before liking.');
  if (content !== '+' && content) {
    await publishReaction(currentSession, target, currentRelays, content);
    return;
  }

  let alreadyLiked = false;
  likedEvents.subscribe((value) => (alreadyLiked = value.has(target.id)))();

  if (alreadyLiked) {
    likedEvents.update((existing) => {
      const next = new Set(existing);
      next.delete(target.id);
      return next;
    });
    eventStats.update((existing) => {
      const previous = existing[target.id] ?? emptyStats();
      return {
        ...existing,
        [target.id]: {
          ...previous,
          likes: Math.max(0, previous.likes - 1)
        }
      };
    });
    return;
  }

  await publishReaction(currentSession, target, currentRelays, content);
  likedEvents.update((existing) => new Set(existing).add(target.id));
  eventStats.update((existing) => {
    const previous = existing[target.id] ?? emptyStats();
    return {
      ...existing,
      [target.id]: {
        ...previous,
        likes: content === '+' || !content ? previous.likes + 1 : previous.likes,
        dislikes: content === '-' ? previous.dislikes + 1 : previous.dislikes,
        emoji: content !== '+' && content !== '-' && content ? previous.emoji + 1 : previous.emoji
      }
    };
  });
}

export async function reportNote(target: NostrEvent, reportType = 'spam') {
  const currentSession = requireSession('Sign in before reporting.');
  await publishReport(currentSession, target, currentRelays, reportType);
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

export async function saveFollowList(pubkeys: string[]) {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) throw new Error('Sign in before updating your follow list.');
  const clean = [...new Set(pubkeys.filter((pubkey) => /^[0-9a-f]{64}$/i.test(pubkey)))];
  await publishContactList(currentSession, clean, currentRelays, currentContactItems, getStoreSnapshot(profiles));
  follows.set(clean);
  if (currentMode === 'follow' || currentMode === 'custom') void refreshFeed(currentMode);
}

export async function saveRelayListMetadata() {
  const currentSession = requireSession('Sign in before publishing relay settings.');
  await publishRelayListMetadata(currentSession, currentRelays);
}

export function mergeEvents(incoming: NostrEvent[], existing: NostrEvent[]) {
  const byId = new Map<string, NostrEvent>();
  [...existing, ...incoming].forEach((event) => byId.set(event.id, event));
  const merged = [...byId.values()].sort((a, b) => b.created_at - a.created_at);
  return currentMode === 'global' ? limitConsecutiveAuthors(merged, 2) : merged;
}

function getOldestTimestamp(items: NostrEvent[]) {
  if (!items.length) return undefined;
  return Math.min(...items.map((event) => event.created_at));
}

function getNewestTimestamp(items: NostrEvent[]) {
  if (!items.length) return undefined;
  return Math.max(...items.map((event) => event.created_at));
}

async function hydrateMissingProfiles(nextEvents: NostrEvent[], limit = 40) {
  const existingProfiles = getStoreSnapshot(profiles);
  const pubkeys = [...new Set(nextEvents.map((event) => event.pubkey))]
    .filter((pubkey) => !existingProfiles[pubkey])
    .slice(0, limit);
  if (!pubkeys.length) return;

  const foundProfiles = await fetchProfiles(pubkeys, currentRelays).catch(() => []);
  if (!foundProfiles.length) return;
  profiles.update((existing) => ({
    ...existing,
    ...Object.fromEntries(foundProfiles.map((profile) => [profile.pubkey, profile]))
  }));
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
  const requestedMode = requestedFeedMode();
  const relayList = await fetchRelayListMetadata(currentSession.pubkey, currentRelays).catch(() => []);
  mergeRelayHints(relayList.map((relay) => relay.url), 90);
  const contacts = await fetchContactListDetails(currentSession.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [], items: [] }));
  currentContactItems = contacts.items;
  mergeRelayHints(contacts.relayHints, 74);
  follows.set(contacts.pubkeys);
  feedMode.set(requestedMode ?? (hasCustomFeedFilters(currentSettings) ? 'custom' : 'follow'));
}

async function hydrateGuestFeedContext() {
  const requestedMode = requestedFeedMode();
  const profile = await resolveNip05Profile(defaultGuestNip05).catch(() => null);
  if (!profile) {
    feedMode.set('global');
    return;
  }

  mergeRelayHints(profile.relayHints, 96);
  const relayList = await fetchRelayListMetadata(profile.pubkey, currentRelays).catch(() => []);
  mergeRelayHints(relayList.map((relay) => relay.url), 90);
  const contacts = await fetchContactListDetails(profile.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [], items: [] }));
  currentContactItems = contacts.items;
  mergeRelayHints(contacts.relayHints, 74);
  follows.set([]);
  feedMode.set(requestedMode === 'global' ? requestedMode : 'global');
}

function requestedFeedMode(): FeedMode | null {
  if (!browser) return null;
  const mode = new URL(location.href).searchParams.get('feed');
  return mode === 'follow' || mode === 'global' || mode === 'custom' ? mode : null;
}

function replyTags(parent: NostrEvent) {
  const parentRoot = parent.tags.find((tag) => tag[0] === 'e' && tag[3] === 'root');
  const rootId = parentRoot?.[1] ?? parent.id;
  const pTags = new Set([parent.pubkey, ...parent.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1])]);
  const tags = rootId === parent.id ? [['e', parent.id, '', 'root', parent.pubkey]] : [['e', rootId, '', 'root'], ['e', parent.id, '', 'reply', parent.pubkey]];
  return [...tags, ...[...pTags].map((pubkey) => ['p', pubkey])];
}

function requireSession(message: string) {
  const currentSession = getStoreSnapshot(session);
  if (!currentSession) {
    loginDialogOpen.set(true);
    throw new Error(message);
  }
  return currentSession;
}

function getStoreSnapshot<T>(store: { subscribe(run: (value: T) => void): () => void }) {
  let value!: T;
  store.subscribe((next) => (value = next))();
  return value;
}

function emptyStats(): EventStats {
  return { replies: 0, reposts: 0, likes: 0, dislikes: 0, emoji: 0, zaps: 0 };
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
