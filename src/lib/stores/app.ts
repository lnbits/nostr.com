import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getCachedEvents, getCachedHashtagEvents, getCachedProfiles } from '$lib/nostr/cache';
import { defaultCustomFeedSettings, defaultGuestNip05, defaultRelays, keywordsForInterests } from '$lib/nostr/config';
import {
  createGuestSession,
  fetchDirectMessages,
  fetchContactListDetails,
  fetchFeed,
  fetchEventStats,
  fetchProfiles,
  fetchRelayInfoDocuments,
  fetchRelayListMetadata,
  filterSpam,
  limitCryptoTopicDensity,
  limitConsecutiveAuthors,
  loginWithBunker,
  loginWithNip07,
  loginWithPrivateKey,
  normalizeRelayUrl,
  publishContactList,
  publishNote,
  publishProfile,
  publishReaction,
  publishRelayListMetadata,
  publishReport,
  publishRepost,
  publishNip17DirectMessage,
  resolveNip05Profile,
  resolvePubkeyIdentifier,
  subscribeFeed,
  topLevelFeedEvents
} from '$lib/nostr/client';
import type { ContactListItem, CustomFeedSettings, DirectMessage, EventStats, FeedMode, NostrEvent, NotificationItem, Profile, RelayState, Session } from '$lib/nostr/types';

const sessionStorageKey = 'nostr-session';
const customFeedStorageKey = 'nostr-custom-feed-settings';
const initialFeedLimit = 18;
const pageFeedLimit = 24;
const cachedFeedBufferLimit = initialFeedLimit + pageFeedLimit * 3;
const maxFeedEvents = 240;

const initialSession = browser ? readStoredSession() : null;
const initialCustomFeedSettings = browser ? readStoredCustomFeedSettings() : defaultCustomFeedSettings;

export const feedMode = writable<FeedMode>('global');
export const events = writable<NostrEvent[]>([]);
export const pendingNewerEvents = writable<NostrEvent[]>([]);
export const profiles = writable<Record<string, Profile>>({});
export const relays = writable<RelayState[]>(defaultRelays);
export const session = writable<Session | null>(initialSession);
export const follows = writable<string[]>([]);
export const customFeedSettings = writable<CustomFeedSettings>(initialCustomFeedSettings);
export const activeHashtag = writable<string>('');
export const online = writable(true);
export const notifications = writable<NotificationItem[]>([]);
export const directMessages = writable<DirectMessage[]>([]);
export const activeMessagePeer = writable<string>('');
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
let currentSessionValue: Session | null = initialSession;
let currentContactItems: ContactListItem[] = [];
let oldestFeedTimestamp: number | undefined;
let liveFeedSub: { close: (reason?: string) => void } | undefined;
let liveFeedToken = 0;
let cachedOlderEvents: NostrEvent[] = [];
const requestedStats = new Set<string>();

relays.subscribe((value) => (currentRelays = value));
follows.subscribe((value) => (currentFollows = value));
customFeedSettings.subscribe((value) => {
  currentSettings = value;
  if (browser) localStorage.setItem(customFeedStorageKey, JSON.stringify(value));
});
feedMode.subscribe((value) => (currentMode = value));
activeHashtag.subscribe((value) => (currentHashtag = value));
session.subscribe((value) => (currentSessionValue = value));

export async function bootstrap() {
  if (!browser) return;
  online.set(navigator.onLine);
  addEventListener('online', () => online.set(true));
  addEventListener('offline', () => online.set(false));

  const [cachedEvents, cachedProfiles] = await Promise.all([getCachedEvents(cachedFeedBufferLimit), getCachedProfiles()]);
  const cachedTopLevelEvents = cachedEventsForMode(currentMode, topLevelFeedEvents(filterSpam(cachedEvents)), cachedFeedBufferLimit);
  const visibleEvents = cachedTopLevelEvents.slice(0, initialFeedLimit);
  cachedOlderEvents = cachedTopLevelEvents.slice(initialFeedLimit);
  events.set(visibleEvents);
  oldestFeedTimestamp = getOldestTimestamp(visibleEvents);
  profiles.set(Object.fromEntries(cachedProfiles.map((profile) => [profile.pubkey, profile])));
  await hydrateDefaultFeedContext();
  void refreshRelayInfo();
  void refreshFeed();
}

export async function refreshFeed(mode = currentMode) {
  const fetchMode = currentHashtag ? 'global' : mode;
  loadingFeed.set(true);
  hasMoreFeed.set(true);
  oldestFeedTimestamp = undefined;
  requestedStats.clear();
  pendingNewerEvents.set([]);

  if ((fetchMode === 'follow' || fetchMode === 'custom') && !currentFollows.length) {
    events.set([]);
    cachedOlderEvents = [];
    stopLiveFeed();
    loadingFeed.set(false);
    return;
  }

  try {
    const nextEvents = await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), { limit: initialFeedLimit, hashtag: currentHashtag });
    if (nextEvents.length) {
      events.set(nextEvents);
      oldestFeedTimestamp = getOldestTimestamp(nextEvents);
      void refreshEventStats(nextEvents.map((event) => event.id));
      void hydrateMissingProfiles(nextEvents, 60);
      void primeCachedFeedBuffers(fetchMode, nextEvents);
    }
    void restartLiveFeed(fetchMode, getNewestTimestamp(nextEvents));
  } finally {
    loadingFeed.set(false);
  }
}

async function hydrateCachedFeed(mode = currentMode) {
  const cachedEvents = await getCachedFeedCandidates(mode, cachedFeedBufferLimit);
  const clean = cachedEventsForMode(mode, cachedEvents, cachedFeedBufferLimit);
  if (!clean.length) return;
  const visibleEvents = clean.slice(0, initialFeedLimit);
  cachedOlderEvents = clean.slice(initialFeedLimit);
  events.set(visibleEvents);
  oldestFeedTimestamp = getOldestTimestamp(visibleEvents);
  primeCachedNewerFeed(visibleEvents);
  void refreshEventStats(visibleEvents.map((event) => event.id));
  void hydrateMissingProfiles(visibleEvents, 40);
}

function cachedEventsForMode(mode: FeedMode, items: NostrEvent[], limit = initialFeedLimit) {
  if (mode === 'follow') return items.filter((event) => currentFollows.includes(event.pubkey)).slice(0, limit);
  if (mode === 'custom' && currentFollows.length) {
    const feedHashtags = feedKeywordHashtags(currentSettings);
    return items
      .filter((event) => currentFollows.includes(event.pubkey) || feedHashtags.some((tag) => eventHasHashtag(event, tag)))
      .slice(0, limit);
  }
  return items.slice(0, limit);
}

async function getCachedFeedCandidates(mode: FeedMode, limit = cachedFeedBufferLimit) {
  const cachedEvents = currentHashtag ? await getCachedHashtagEvents(currentHashtag, limit) : await getCachedEvents(limit);
  return topLevelFeedEvents(filterSpam(cachedEventsForMode(mode, topLevelFeedEvents(filterSpam(cachedEvents)), limit)));
}

async function primeCachedFeedBuffers(mode: FeedMode, visibleEvents: NostrEvent[]) {
  const cachedEvents = cachedEventsForMode(mode, await getCachedFeedCandidates(mode, cachedFeedBufferLimit), cachedFeedBufferLimit);
  if (!cachedEvents.length) return;

  const visibleIds = new Set(visibleEvents.map((event) => event.id));
  const newestTimestamp = getNewestTimestamp(visibleEvents);
  const oldestTimestamp = getOldestTimestamp(visibleEvents);

  cachedOlderEvents = cachedEvents
    .filter((event) => !visibleIds.has(event.id) && (oldestTimestamp === undefined || event.created_at < oldestTimestamp))
    .slice(0, cachedFeedBufferLimit - initialFeedLimit);

  if (newestTimestamp === undefined) return;
  const cachedNewerEvents = cachedEvents
    .filter((event) => !visibleIds.has(event.id) && event.created_at > newestTimestamp)
    .slice(0, pageFeedLimit);
  if (!cachedNewerEvents.length) return;
  pendingNewerEvents.update((existing) => mergeEvents(cachedNewerEvents, existing));
}

function primeCachedNewerFeed(visibleEvents: NostrEvent[]) {
  const newestTimestamp = getNewestTimestamp(visibleEvents);
  if (newestTimestamp === undefined) return;
  const visibleIds = new Set(visibleEvents.map((event) => event.id));
  const cachedNewerEvents = cachedOlderEvents.filter((event) => !visibleIds.has(event.id) && event.created_at > newestTimestamp);
  if (!cachedNewerEvents.length) return;
  pendingNewerEvents.update((existing) => mergeEvents(cachedNewerEvents, existing));
  cachedOlderEvents = cachedOlderEvents.filter((event) => !cachedNewerEvents.some((newer) => newer.id === event.id));
}

export async function loadNewerFeed() {
  const fetchMode = currentHashtag ? 'global' : currentMode;
  let loading = false;
  loadingNewerFeed.subscribe((value) => (loading = value))();
  if (loading) return;

  const newestTimestamp = getNewestTimestamp(feedEventsForActiveHashtag([...getStoreSnapshot(events), ...getStoreSnapshot(pendingNewerEvents)]));
  if (!newestTimestamp) return;

  loadingNewerFeed.set(true);
  try {
    const nextEvents = await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), {
      limit: initialFeedLimit,
      since: newestTimestamp + 1,
      hashtag: currentHashtag
    });
    if (!nextEvents.length) return [];
    pendingNewerEvents.update((existing) => mergeEvents(nextEvents, existing));
    void refreshEventStats(nextEvents.map((event) => event.id));
    void hydrateMissingProfiles(nextEvents, 60);
    return nextEvents;
  } finally {
    loadingNewerFeed.set(false);
  }
}

export function revealNewerFeed() {
  const pending = getStoreSnapshot(pendingNewerEvents);
  if (!pending.length) return;
  pendingNewerEvents.set([]);
  events.update((existing) => {
    const merged = mergeEvents(pending, existing);
    oldestFeedTimestamp = getOldestTimestamp(feedEventsForActiveHashtag(merged));
    return merged;
  });
}

function stopLiveFeed() {
  liveFeedToken += 1;
  liveFeedSub?.close('restarting main feed subscription');
  liveFeedSub = undefined;
}

async function restartLiveFeed(mode = currentMode, newestTimestamp?: number) {
  const token = liveFeedToken + 1;
  stopLiveFeed();
  liveFeedToken = token;

  if ((mode === 'follow' || mode === 'custom') && !currentFollows.length) return;

  const sub = await subscribeFeed(
    mode,
    currentRelays,
    currentFollows,
    effectiveFeedSettings(mode),
    { since: newestTimestamp ? newestTimestamp + 1 : Math.floor(Date.now() / 1000), hashtag: currentHashtag },
    (event) => {
      if (token !== liveFeedToken || isKnownFeedEvent(event.id)) return;
      pendingNewerEvents.update((existing) => mergeEvents([event], existing));
      void refreshEventStats([event.id]);
      void hydrateMissingProfiles([event], 8);
    }
  ).catch(() => undefined);

  if (token !== liveFeedToken) {
    sub?.close('stale main feed subscription');
    return;
  }
  liveFeedSub = sub;
}

function isKnownFeedEvent(id: string) {
  return getStoreSnapshot(events).some((event) => event.id === id) || getStoreSnapshot(pendingNewerEvents).some((event) => event.id === id);
}

function revealCachedOlderFeed() {
  if (!cachedOlderEvents.length) return [];

  const existingIds = new Set(getStoreSnapshot(events).map((event) => event.id));
  const nextEvents = cachedOlderEvents.filter((event) => !existingIds.has(event.id)).slice(0, pageFeedLimit);
  const revealedIds = new Set(nextEvents.map((event) => event.id));
  cachedOlderEvents = cachedOlderEvents.filter((event) => !revealedIds.has(event.id));
  if (!nextEvents.length) return [];

  events.update((existing) => {
    const merged = mergeEvents(nextEvents, existing);
    oldestFeedTimestamp = getOldestTimestamp(feedEventsForActiveHashtag(merged));
    return merged;
  });
  void refreshEventStats(nextEvents.map((event) => event.id));
  void hydrateMissingProfiles(nextEvents, 40);
  return nextEvents;
}

export async function loadMoreFeed(force = false) {
  const fetchMode = currentHashtag ? 'global' : currentMode;
  let loading = false;
  let more = true;
  loadingMoreFeed.subscribe((value) => (loading = value))();
  hasMoreFeed.subscribe((value) => (more = value))();
  if (loading || (!force && !more)) return;

  loadingMoreFeed.set(true);
  try {
    revealCachedOlderFeed();
    const currentOldest = getOldestTimestamp(feedEventsForActiveHashtag(getStoreSnapshot(events))) ?? oldestFeedTimestamp;
    const olderThan = currentOldest ? currentOldest - 1 : undefined;
    const nextEvents = await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), {
      limit: pageFeedLimit,
      until: olderThan,
      hashtag: currentHashtag
    });
    const existingIds = new Set(getStoreSnapshot(events).map((event) => event.id));
    const freshEvents = nextEvents.filter((event) => !existingIds.has(event.id));
    if (!freshEvents.length) {
      hasMoreFeed.set(true);
      return;
    }
    hasMoreFeed.set(true);
    const nextOldest = getOldestTimestamp(freshEvents);
    if (nextOldest !== undefined) oldestFeedTimestamp = currentOldest === undefined ? nextOldest : Math.min(currentOldest, nextOldest);
    events.update((existing) => mergeEvents(freshEvents, existing));
    void primeCachedFeedBuffers(fetchMode, getStoreSnapshot(events));
    void refreshEventStats(freshEvents.map((event) => event.id));
    void hydrateMissingProfiles(freshEvents, 40);
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
  const clean = tag.trim().replace(/^#/, '').toLowerCase();
  activeHashtag.set(clean);
  cachedOlderEvents = [];
  void hydrateCachedHashtagFeed(clean);
  void refreshFeed('global');
}

async function hydrateCachedHashtagFeed(tag: string) {
  const cached = topLevelFeedEvents(filterSpam(await getCachedHashtagEvents(tag, cachedFeedBufferLimit)));
  if (!cached.length || tag !== currentHashtag) return;
  const visibleEvents = cached.slice(0, initialFeedLimit);
  cachedOlderEvents = cached.slice(initialFeedLimit);
  events.set(visibleEvents);
  oldestFeedTimestamp = getOldestTimestamp(visibleEvents);
  primeCachedNewerFeed(visibleEvents);
  void refreshEventStats(visibleEvents.map((event) => event.id));
  void hydrateMissingProfiles(visibleEvents, 40);
}

export function selectFeedMode(mode: FeedMode) {
  activeHashtag.set('');
  cachedOlderEvents = [];
  feedMode.set(mode);
  void hydrateCachedFeed(mode);
  void refreshFeed(mode);
}

export function goHome() {
  activeHashtag.set('');
  cachedOlderEvents = [];
  void hydrateCachedFeed(currentMode);
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
    const messages = await fetchDirectMessages(currentSession, currentRelays);
    directMessages.update((existing) => mergeDirectMessages(messages, existing));
  } finally {
    loadingMessages.set(false);
  }
}

export async function resolveMessageRecipient(value: string) {
  const pubkey = normalizePubkey(await resolvePubkeyIdentifier(value, currentRelays).catch(() => ''));
  if (!pubkey) throw new Error('Could not resolve that npub or NIP-05 address.');
  void hydrateMissingProfiles([{ id: pubkey, pubkey, created_at: 0, kind: 0, tags: [], content: '' }], 1);
  activeMessagePeer.set(pubkey);
  return pubkey;
}

export function selectMessagePeer(pubkey: string) {
  activeMessagePeer.set(normalizePubkey(pubkey));
}

export async function sendDirectMessage(peer: string, content: string) {
  const currentSession = requireSession('Sign in before sending a message.');
  const recipient = normalizePubkey(peer);
  const clean = content.trim();
  if (!clean || !recipient) return;
  const wraps = await publishNip17DirectMessage(currentSession, recipient, clean, currentRelays);
  const message: DirectMessage = {
    id: wraps[0]?.id ?? `${currentSession.pubkey}:${recipient}:${Date.now()}`,
    protocol: 'NIP-17',
    peer: recipient,
    from: normalizePubkey(currentSession.pubkey),
    to: recipient,
    created_at: Math.floor(Date.now() / 1000),
    encrypted: wraps[0]?.content ?? '',
    content: clean
  };
  directMessages.update((existing) => mergeDirectMessages([message], existing));
  activeMessagePeer.set(recipient);
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
  const limited = currentMode === 'global' ? limitCryptoTopicDensity(limitConsecutiveAuthors(merged, 2), 10) : merged;
  return limited.slice(0, maxFeedEvents);
}

function mergeDirectMessages(incoming: DirectMessage[], existing: DirectMessage[]) {
  const merged: DirectMessage[] = [];
  for (const message of [...existing, ...incoming]
    .map(normalizeDirectMessage)
    .filter((message): message is DirectMessage => Boolean(message && message.peer !== normalizePubkey(currentSessionValue?.pubkey ?? '')))) {
    const index = merged.findIndex((existingMessage) => existingMessage.id === message.id || isSameDirectMessage(existingMessage, message));
    if (index >= 0) {
      merged[index] = preferDirectMessage(merged[index], message);
    } else {
      merged.push(message);
    }
  }
  return merged.sort((a, b) => b.created_at - a.created_at).slice(0, 400);
}

function normalizeDirectMessage(message: DirectMessage) {
  const peer = normalizePubkey(message.peer);
  const from = normalizePubkey(message.from);
  const to = message.to
    .split(',')
    .map(normalizePubkey)
    .filter(Boolean)
    .join(',');
  if (!peer || !from) return null;
  return { ...message, peer, from, to };
}

function isSameDirectMessage(a: DirectMessage, b: DirectMessage) {
  if (a.protocol !== b.protocol || a.peer !== b.peer || a.from !== b.from) return false;
  if (!a.content || a.content !== b.content) return false;
  return Math.abs(a.created_at - b.created_at) <= 3;
}

function preferDirectMessage(existing: DirectMessage, incoming: DirectMessage) {
  if (!existing.encrypted && incoming.encrypted) return incoming;
  if (!existing.content && incoming.content) return incoming;
  return existing;
}

function normalizePubkey(value: string) {
  const clean = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(clean) ? clean : '';
}

function getOldestTimestamp(items: NostrEvent[]) {
  if (!items.length) return undefined;
  return Math.min(...items.map((event) => event.created_at));
}

function getNewestTimestamp(items: NostrEvent[]) {
  if (!items.length) return undefined;
  return Math.max(...items.map((event) => event.created_at));
}

function feedEventsForActiveHashtag(items: NostrEvent[]) {
  if (!currentHashtag) return items;
  return items.filter((event) => eventHasHashtag(event, currentHashtag));
}

function eventHasHashtag(event: NostrEvent, tag: string) {
  const normalized = tag.trim().replace(/^#/, '').toLowerCase();
  if (!normalized) return true;
  if (event.tags.some((item) => item[0] === 't' && item[1]?.replace(/^#/, '').toLowerCase() === normalized)) return true;
  return new RegExp(`(^|\\s)#${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(event.content);
}

function feedKeywordHashtags(settings: CustomFeedSettings) {
  return [...new Set(settings.keywords.map((keyword) => keyword.trim().replace(/^#/, '').toLowerCase()).filter((keyword) => /^[a-z0-9_]{2,64}$/.test(keyword)))];
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
      keywords: [
        ...new Set([
          ...(Array.isArray(saved.keywords) ? saved.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : []),
          ...keywordsForInterests(Array.isArray(saved.interests) ? saved.interests.filter((interest): interest is string => typeof interest === 'string') : [])
        ])
      ],
      interests: []
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
  const relayList = await fetchRelayListMetadata(currentSession.pubkey, currentRelays).catch(() => []);
  mergeRelayHints(relayList.map((relay) => relay.url), 90);
  const contacts = await fetchContactListDetails(currentSession.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [], items: [] }));
  currentContactItems = contacts.items;
  mergeRelayHints(contacts.relayHints, 74);
  follows.set(contacts.pubkeys);
}

async function hydrateGuestFeedContext() {
  const profile = await resolveNip05Profile(defaultGuestNip05).catch(() => null);
  if (profile) {
    mergeRelayHints(profile.relayHints, 96);
    const relayList = await fetchRelayListMetadata(profile.pubkey, currentRelays).catch(() => []);
    mergeRelayHints(relayList.map((relay) => relay.url), 90);
    const contacts = await fetchContactListDetails(profile.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [], items: [] }));
    mergeRelayHints(contacts.relayHints, 74);
  }
  currentContactItems = [];
  follows.set([]);
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
  return { replies: 0, reposts: 0, likes: 0, dislikes: 0, emoji: 0 };
}

function effectiveFeedSettings(mode: FeedMode): CustomFeedSettings {
  if (currentSessionValue && (mode === 'global' || mode === 'custom')) return currentSettings;
  return { ...currentSettings, interests: [] };
}

function mergeRelayHints(urls: string[], startingScore = 76) {
  const clean = [...new Set(urls.map(normalizeRelayUrl).filter(Boolean))].slice(0, 8);
  if (!clean.length) return;

  relays.update((existing) => {
    const normalizedExisting = existing.map((relay) => ({ ...relay, url: normalizeRelayUrl(relay.url) || relay.url }));
    const byUrl = new Map(normalizedExisting.map((relay) => [relay.url, relay]));
    const known = new Set(byUrl.keys());
    const additions = clean
      .filter((url) => !known.has(url))
      .map((url, index) => ({
        url,
        enabled: true,
        read: true,
        write: false,
        score: Math.max(55, startingScore - index)
      }));

    return additions.length ? [...byUrl.values(), ...additions] : [...byUrl.values()];
  });
}
