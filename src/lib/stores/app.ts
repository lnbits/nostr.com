import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { writable } from 'svelte/store';
import { getCachedEvents, getCachedHashtagEvents, getCachedProfiles } from '$lib/nostr/cache';
import { defaultCustomFeedSettings, defaultGuestNip05, defaultRelays, keywordsForInterests } from '$lib/nostr/config';
import { appPath } from '$lib/paths';
import { markRelaysOnline, syncRelayStatus } from '$lib/stores/relayStatus';
import { mergeDirectMessages } from './directMessages';
import {
  activeRelayUrls,
  createGuestSession,
  fetchDirectMessages,
  fetchContactListDetails,
  fetchFeed,
  fetchEventStats,
  fetchMuteList,
  fetchProfiles,
  fetchNotifications,
  fetchRelayInfoDocuments,
  fetchRelayListMetadata,
  filterSpam,
  eventStatsFromEvents,
  limitCryptoTopicDensity,
  limitConsecutiveAuthors,
  loginWithBunker,
  loginWithNip07,
  loginWithPrivateKey,
  normalizeRelayUrl,
  publishContactList,
  publishDeletion,
  publishMuteList,
  publishNote,
  publishProfile,
  publishReaction,
  publishRelayListMetadata,
  publishReport,
  publishRepost,
  publishNip17DirectMessage,
  resolveNip05Profile,
  resolvePubkeyIdentifier,
  subscribeEventStats,
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
export const mutedPubkeys = writable<string[]>([]);
export const customFeedSettings = writable<CustomFeedSettings>(initialCustomFeedSettings);
export const activeHashtag = writable<string>('');
export const online = writable(true);
export const notifications = writable<NotificationItem[]>([]);
export const directMessages = writable<DirectMessage[]>([]);
export const activeMessagePeer = writable<string>('');
export const eventStats = writable<Record<string, EventStats>>({});
export const likedEvents = writable<Set<string>>(new Set());
export const repostedEvents = writable<Set<string>>(new Set());
export const deletedEventIds = writable<Set<string>>(new Set());
export const editedEvents = writable<Record<string, NostrEvent>>({});
export const loadingFeed = writable(false);
export const loadingNewerFeed = writable(false);
export const loadingMessages = writable(false);
export const loadingNotifications = writable(false);
export const loadingMoreFeed = writable(false);
export const hasMoreFeed = writable(true);
export const composerOpen = writable(false);
export const loginDialogOpen = writable(false);
export const replyTarget = writable<NostrEvent | null>(null);
export const editTarget = writable<NostrEvent | null>(null);

let currentRelays = defaultRelays;
let currentFollows: string[] = [];
let currentMutedPubkeys = new Set<string>();
let currentSettings = defaultCustomFeedSettings;
let currentMode: FeedMode = 'global';
let currentHashtag = '';
let currentSessionValue: Session | null = initialSession;
let currentContactItems: ContactListItem[] = [];
let currentDeletedEventIds = new Set<string>();
let oldestFeedTimestamp: number | undefined;
let liveFeedSub: { close: (reason?: string) => void } | undefined;
let liveFeedToken = 0;
let liveStatsSub: { close: (reason?: string) => void } | undefined;
let liveStatsTimer: ReturnType<typeof setTimeout> | undefined;
let liveStatsKey = '';
let cachedOlderEvents: NostrEvent[] = [];
const visibleStatIds = new Set<string>();
const seenLiveStatEvents = new Set<string>();
const seenLiveReactionAuthors = new Set<string>();
const seenLiveRepostAuthors = new Set<string>();
const requestedStats = new Map<string, number>();
const statsRetryMs = 60_000;
const pendingLikeToggles = new Set<string>();
const pendingRepostToggles = new Set<string>();

relays.subscribe((value) => {
  currentRelays = value;
  syncRelayStatus(value);
  liveStatsKey = '';
  if (visibleStatIds.size) scheduleVisibleStatsSubscription();
});
follows.subscribe((value) => (currentFollows = value));
mutedPubkeys.subscribe((value) => (currentMutedPubkeys = new Set(value)));
customFeedSettings.subscribe((value) => {
  currentSettings = value;
  if (browser) localStorage.setItem(customFeedStorageKey, JSON.stringify(value));
});
feedMode.subscribe((value) => (currentMode = value));
activeHashtag.subscribe((value) => (currentHashtag = value));
session.subscribe((value) => (currentSessionValue = value));
deletedEventIds.subscribe((value) => (currentDeletedEventIds = value));

export async function bootstrap() {
  if (!browser) return;
  online.set(navigator.onLine);
  addEventListener('online', () => online.set(true));
  addEventListener('offline', () => online.set(false));

  const [cachedEvents, cachedProfiles] = await Promise.all([getCachedEvents(cachedFeedBufferLimit), getCachedProfiles()]);
  const cachedTopLevelEvents = cachedEventsForMode(currentMode, topLevelFeedEvents(filterSpam(cachedEvents, currentMutedPubkeys)), cachedFeedBufferLimit);
  const visibleEvents = cachedTopLevelEvents.slice(0, initialFeedLimit);
  cachedOlderEvents = cachedTopLevelEvents.slice(initialFeedLimit);
  events.set(visibleEvents);
  oldestFeedTimestamp = getOldestTimestamp(visibleEvents);
  profiles.set(Object.fromEntries(cachedProfiles.map((profile) => [profile.pubkey, profile])));

  const relayCountBeforeContext = currentRelays.length;
  const contextReady = hydrateDefaultFeedContext();
  void refreshRelayInfo();
  void refreshFeed();
  void contextReady
    .then(() => {
      void refreshRelayInfo();
      if (currentRelays.length !== relayCountBeforeContext || currentMode !== 'global' || currentHashtag) void refreshFeed();
      void refreshNotifications();
    })
    .catch(() => {
      void refreshNotifications();
    });
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
    const nextEvents = filterMutedEvents(await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), { limit: initialFeedLimit, hashtag: currentHashtag }));
    if (nextEvents.length) {
      markRelaysOnline(activeRelayUrls(currentRelays, 'read'));
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
  return topLevelFeedEvents(filterSpam(cachedEventsForMode(mode, topLevelFeedEvents(filterSpam(cachedEvents, currentMutedPubkeys)), limit), currentMutedPubkeys));
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
    const nextEvents = filterMutedEvents(await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), {
      limit: initialFeedLimit,
      since: newestTimestamp + 1,
      hashtag: currentHashtag
    }));
    if (!nextEvents.length) return [];
    const existingIds = new Set(getStoreSnapshot(events).map((event) => event.id));
    const freshEvents = nextEvents.filter((event) => !existingIds.has(event.id));
    if (!freshEvents.length) return [];
    markRelaysOnline(activeRelayUrls(currentRelays, 'read'));
    events.update((existing) => {
      const merged = mergeEvents(freshEvents, existing);
      oldestFeedTimestamp = getOldestTimestamp(feedEventsForActiveHashtag(merged));
      return merged;
    });
    void refreshEventStats(nextEvents.map((event) => event.id));
    void hydrateMissingProfiles(nextEvents, 60);
    return freshEvents;
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

function stopLiveStats(reason = 'stopping visible stats subscription') {
  liveStatsSub?.close(reason);
  liveStatsSub = undefined;
  liveStatsKey = '';
}

export function watchVisibleNoteStats(id: string, visible: boolean) {
  if (!browser || !/^[0-9a-f]{64}$/i.test(id)) return;
  if (visible) {
    visibleStatIds.add(id);
    void refreshEventStats([id]);
  } else {
    visibleStatIds.delete(id);
  }
  scheduleVisibleStatsSubscription();
}

function scheduleVisibleStatsSubscription() {
  if (liveStatsTimer) clearTimeout(liveStatsTimer);
  liveStatsTimer = setTimeout(() => void restartVisibleStatsSubscription(), 350);
}

async function restartVisibleStatsSubscription() {
  const ids = [...visibleStatIds].sort().slice(0, 80);
  const nextKey = ids.join(',');
  if (nextKey === liveStatsKey) return;
  stopLiveStats('visible note set changed');
  if (!ids.length) return;

  liveStatsKey = nextKey;
  liveStatsSub = await subscribeEventStats(ids, currentRelays, (event) => {
    if (seenLiveStatEvents.has(event.id)) return;
    seenLiveStatEvents.add(event.id);
    if (seenLiveStatEvents.size > 1500) seenLiveStatEvents.clear();
    mergeLiveStatEvent(ids, event);
  }).catch(() => undefined);
}

function mergeLiveStatEvent(ids: string[], event: NostrEvent) {
  const targetIds = statTargetIdsForLocalUse(event, ids);
  if (event.kind === 7 && targetIds.every((id) => seenLiveReactionAuthors.has(`${id}:${event.pubkey}`))) return;
  if ((event.kind === 6 || event.kind === 16) && targetIds.every((id) => seenLiveRepostAuthors.has(`${id}:${event.pubkey}`))) return;

  const stats = eventStatsFromEvents(ids, [event]);
  eventStats.update((existing) => {
    const next = { ...existing };
    for (const [id, stat] of Object.entries(stats)) {
      if (!stat.replies && !stat.reposts && !stat.likes && !stat.zaps && !stat.zapSats && !stat.dislikes && !stat.emoji) continue;
      if (event.kind === 7) seenLiveReactionAuthors.add(`${id}:${event.pubkey}`);
      if (event.kind === 6 || event.kind === 16) seenLiveRepostAuthors.add(`${id}:${event.pubkey}`);
      const previous = next[id] ?? emptyStats();
      next[id] = {
        replies: previous.replies + stat.replies,
        reposts: previous.reposts + stat.reposts,
        likes: previous.likes + stat.likes,
        zaps: previous.zaps + stat.zaps,
        zapSats: previous.zapSats + stat.zapSats,
        dislikes: previous.dislikes + stat.dislikes,
        emoji: previous.emoji + stat.emoji
      };
    }
    return next;
  });
}

function statTargetIdsForLocalUse(event: NostrEvent, ids: string[]) {
  const wanted = new Set(ids);
  return event.tags.filter((tag) => tag[0] === 'e' && wanted.has(tag[1])).map((tag) => tag[1]);
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
      if (token !== liveFeedToken || isKnownFeedEvent(event.id) || currentMutedPubkeys.has(event.pubkey)) return;
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
    const nextEvents = filterMutedEvents(await fetchFeed(fetchMode, currentRelays, currentFollows, effectiveFeedSettings(fetchMode), {
      limit: pageFeedLimit,
      until: olderThan,
      hashtag: currentHashtag
    }));
    const existingIds = new Set(getStoreSnapshot(events).map((event) => event.id));
    const freshEvents = nextEvents.filter((event) => !existingIds.has(event.id));
    if (!freshEvents.length) {
      hasMoreFeed.set(true);
      return;
    }
    markRelaysOnline(activeRelayUrls(currentRelays, 'read'));
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

export async function refreshEventStats(ids: string[], force = false) {
  const checkedAt = Date.now();
  const nextIds = ids.filter((id) => force || checkedAt - (requestedStats.get(id) ?? 0) > statsRetryMs);
  nextIds.forEach((id) => requestedStats.set(id, checkedAt));
  if (!nextIds.length) return;
  const stats = await fetchEventStats(nextIds, currentRelays).catch(() => ({}));
  eventStats.update((existing) => mergeStats(existing, stats));
}

function mergeStats(existing: Record<string, EventStats>, incoming: Record<string, EventStats>) {
  const next = { ...existing };
  for (const [id, stat] of Object.entries(incoming)) {
    const previous = next[id] ?? emptyStats();
    next[id] = {
      replies: Math.max(previous.replies, stat.replies),
      reposts: Math.max(previous.reposts, stat.reposts),
      likes: Math.max(previous.likes, stat.likes),
      zaps: Math.max(previous.zaps, stat.zaps),
      zapSats: Math.max(previous.zapSats, stat.zapSats),
      dislikes: Math.max(previous.dislikes, stat.dislikes),
      emoji: Math.max(previous.emoji, stat.emoji)
    };
  }
  return next;
}

function filterMutedEvents(items: NostrEvent[]) {
  return currentMutedPubkeys.size ? items.filter((event) => !currentMutedPubkeys.has(event.pubkey)) : items;
}

export function filterByHashtag(tag: string) {
  const clean = tag.trim().replace(/^#/, '').toLowerCase();
  activeHashtag.set(clean);
  cachedOlderEvents = [];
  void hydrateCachedHashtagFeed(clean);
  void refreshFeed('global');
}

async function hydrateCachedHashtagFeed(tag: string) {
  const cached = topLevelFeedEvents(filterSpam(await getCachedHashtagEvents(tag, cachedFeedBufferLimit), currentMutedPubkeys));
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
    directMessages.update((existing) => mergeDirectMessages(messages, existing, currentSessionValue?.pubkey));
  } finally {
    loadingMessages.set(false);
  }
}

export async function refreshNotifications() {
  const currentSession = getStoreSnapshot(session);
  if (!currentSession) {
    notifications.set([]);
    return;
  }

  loadingNotifications.set(true);
  try {
    const nextNotifications = (await fetchNotifications(currentSession.pubkey, currentRelays).catch(() => [])).filter((item) => !currentMutedPubkeys.has(item.event.pubkey));
    notifications.set(nextNotifications);
    const pubkeys = [...new Set(nextNotifications.map((item) => item.event.pubkey))];
    await hydrateMissingProfiles(pubkeys.map((pubkey) => ({ id: pubkey, pubkey, created_at: 0, kind: 0, tags: [], content: '' })), 80);
  } finally {
    loadingNotifications.set(false);
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
  directMessages.update((existing) => mergeDirectMessages([message], existing, currentSession.pubkey));
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
  void refreshNotifications();
}

export async function signOut() {
  session.set(null);
  if (browser) localStorage.removeItem(sessionStorageKey);
  activeHashtag.set('');
  feedMode.set('global');
  cachedOlderEvents = [];
  if (browser) await goto(appPath('/'));
  await hydrateGuestFeedContext();
  void refreshFeed('global');
  notifications.set([]);
  mutedPubkeys.set([]);
  replyTarget.set(null);
  editTarget.set(null);
}

export async function postNote(content: string, parent?: NostrEvent) {
  let currentSession: Session | null = null;
  session.subscribe((value) => (currentSession = value))();
  if (!currentSession) throw new Error('Sign in before posting.');
  const tags = parent ? replyTags(parent) : [];
  const event = await publishNote(currentSession, content, currentRelays, tags);
  seenLiveStatEvents.add(event.id);
  events.update((existing) => mergeEvents([event], existing));
  if (parent) mergeLocalReplyStats(event);
  replyTarget.set(null);
}

export async function editNote(content: string, target: NostrEvent) {
  const currentSession = requireSession('Sign in before editing.');
  if (target.pubkey !== currentSession.pubkey) throw new Error('You can only edit your own posts.');
  const optimisticEvent = { ...target, content, created_at: Math.floor(Date.now() / 1000) };
  editedEvents.update((existing) => ({ ...existing, [target.id]: optimisticEvent }));
  events.update((existing) => existing.map((item) => (item.id === target.id ? optimisticEvent : item)));
  pendingNewerEvents.update((existing) => existing.map((item) => (item.id === target.id ? optimisticEvent : item)));
  cachedOlderEvents = cachedOlderEvents.map((item) => (item.id === target.id ? optimisticEvent : item));
  replyTarget.set(null);
  editTarget.set(null);
  await publishNote(currentSession, content, currentRelays, target.tags);
  await publishDeletion(currentSession, target, currentRelays, 'Edited by author');
}

export async function deleteNote(target: NostrEvent) {
  const currentSession = requireSession('Sign in before deleting.');
  if (target.pubkey !== currentSession.pubkey) throw new Error('You can only delete your own posts.');
  deletedEventIds.update((existing) => new Set(existing).add(target.id));
  editedEvents.update((existing) => {
    const next = { ...existing };
    delete next[target.id];
    return next;
  });
  events.update((existing) => existing.filter((item) => item.id !== target.id));
  pendingNewerEvents.update((existing) => existing.filter((item) => item.id !== target.id));
  cachedOlderEvents = cachedOlderEvents.filter((item) => item.id !== target.id);
  if (getStoreSnapshot(replyTarget)?.id === target.id) replyTarget.set(null);
  if (getStoreSnapshot(editTarget)?.id === target.id) editTarget.set(null);
  await publishDeletion(currentSession, target, currentRelays, 'Deleted by author');
}

export async function repostNote(target: NostrEvent) {
  const currentSession = requireSession('Sign in before reposting.');
  const pendingKey = `${target.id}:${currentSession.pubkey}`;
  if (pendingRepostToggles.has(pendingKey)) return;
  pendingRepostToggles.add(pendingKey);

  const alreadyReposted = getStoreSnapshot(repostedEvents).has(target.id);
  if (alreadyReposted) {
    repostedEvents.update((existing) => {
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
          reposts: Math.max(0, previous.reposts - 1)
        }
      };
    });
    seenLiveRepostAuthors.delete(pendingKey);
    pendingRepostToggles.delete(pendingKey);
    return;
  }

  repostedEvents.update((existing) => new Set(existing).add(target.id));
  seenLiveRepostAuthors.add(pendingKey);
  eventStats.update((existing) => {
    const previous = existing[target.id] ?? emptyStats();
    return {
      ...existing,
      [target.id]: {
        ...previous,
        reposts: previous.reposts + 1
      }
    };
  });

  try {
    const event = await publishRepost(currentSession, target, currentRelays);
    events.update((existing) => mergeEvents([event], existing));
  } catch (err) {
    repostedEvents.update((existing) => {
      const next = new Set(existing);
      next.delete(target.id);
      return next;
    });
    seenLiveRepostAuthors.delete(pendingKey);
    eventStats.update((existing) => {
      const previous = existing[target.id] ?? emptyStats();
      return {
        ...existing,
        [target.id]: {
          ...previous,
          reposts: Math.max(0, previous.reposts - 1)
        }
      };
    });
    throw err;
  } finally {
    pendingRepostToggles.delete(pendingKey);
  }
}

export async function reactToNote(target: NostrEvent, content = '+') {
  const currentSession = requireSession('Sign in before liking.');
  if (content !== '+' && content) {
    await publishReaction(currentSession, target, currentRelays, content);
    return;
  }

  const pendingKey = `${target.id}:${currentSession.pubkey}`;
  if (pendingLikeToggles.has(pendingKey)) return;
  pendingLikeToggles.add(pendingKey);

  const alreadyLiked = getStoreSnapshot(likedEvents).has(target.id);

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
    pendingLikeToggles.delete(pendingKey);
    return;
  }

  likedEvents.update((existing) => new Set(existing).add(target.id));
  seenLiveReactionAuthors.add(pendingKey);
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

  try {
    await publishReaction(currentSession, target, currentRelays, content);
  } catch (err) {
    likedEvents.update((existing) => {
      const next = new Set(existing);
      next.delete(target.id);
      return next;
    });
    seenLiveReactionAuthors.delete(pendingKey);
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
    throw err;
  } finally {
    pendingLikeToggles.delete(pendingKey);
  }
}

export async function reportNote(target: NostrEvent, reportType = 'spam') {
  const currentSession = requireSession('Sign in before reporting.');
  await publishReport(currentSession, target, currentRelays, reportType);
}

export async function muteAccount(pubkey: string) {
  const currentSession = requireSession('Sign in before muting.');
  if (!/^[0-9a-f]{64}$/i.test(pubkey) || pubkey === currentSession.pubkey) return;
  const previous = getStoreSnapshot(mutedPubkeys);
  const next = [...new Set([...previous, pubkey])];
  mutedPubkeys.set(next);
  dropMutedEvents();
  try {
    await publishMuteList(currentSession, next, currentRelays);
  } catch (err) {
    mutedPubkeys.set(previous);
    throw err;
  }
}

export async function unmuteAccount(pubkey: string) {
  const currentSession = requireSession('Sign in before unmuting.');
  const clean = normalizePubkey(pubkey);
  if (!clean) return;
  const previous = getStoreSnapshot(mutedPubkeys);
  const next = previous.filter((item) => item !== clean);
  mutedPubkeys.set(next);
  try {
    await publishMuteList(currentSession, next, currentRelays);
  } catch (err) {
    mutedPubkeys.set(previous);
    throw err;
  }
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
  const merged = [...byId.values()].filter((event) => !currentDeletedEventIds.has(event.id)).sort((a, b) => b.created_at - a.created_at);
  const limited = currentMode === 'global' ? limitCryptoTopicDensity(limitConsecutiveAuthors(merged, 2), 10) : merged;
  return limited.slice(0, maxFeedEvents);
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
  editTarget.set(null);
  composerOpen.set(true);
}

export function startEdit(event: NostrEvent) {
  const currentSession = getStoreSnapshot(session);
  if (!currentSession) {
    loginDialogOpen.set(true);
    return;
  }
  if (event.pubkey !== currentSession.pubkey) return;
  replyTarget.set(null);
  editTarget.set(event);
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
  editTarget.set(null);
  activeHashtag.set('');
  if (browser && (window.location.pathname !== appPath('/') || window.location.hash)) void goto(appPath('/'));
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
  const [contacts, muted] = await Promise.all([
    fetchContactListDetails(currentSession.pubkey, currentRelays).catch(() => ({ pubkeys: [], relayHints: [], items: [] })),
    fetchMuteList(currentSession.pubkey, currentRelays).catch(() => [])
  ]);
  currentContactItems = contacts.items;
  mergeRelayHints(contacts.relayHints, 74);
  follows.set(contacts.pubkeys);
  mutedPubkeys.set(muted);
  dropMutedEvents();
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
  mutedPubkeys.set([]);
}

function dropMutedEvents() {
  if (!currentMutedPubkeys.size) return;
  events.update((existing) => filterMutedEvents(existing));
  pendingNewerEvents.update((existing) => filterMutedEvents(existing));
  cachedOlderEvents = filterMutedEvents(cachedOlderEvents);
  notifications.update((existing) => existing.filter((item) => !currentMutedPubkeys.has(item.event.pubkey)));
}

function mergeLocalReplyStats(reply: NostrEvent) {
  const targetIds = [...new Set(reply.tags.flatMap((tag) => (tag[0] === 'e' && tag[1] ? [tag[1]] : [])))];
  if (!targetIds.length) return;

  const stats = eventStatsFromEvents(targetIds, [reply]);
  eventStats.update((existing) => {
    const next = { ...existing };
    for (const id of targetIds) {
      const stat = stats[id];
      if (!stat?.replies) continue;
      const previous = next[id] ?? emptyStats();
      next[id] = {
        ...previous,
        replies: previous.replies + stat.replies
      };
    }
    return next;
  });
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
  return { replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 };
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
