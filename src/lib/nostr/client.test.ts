import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import { afterEach, vi } from 'vitest';
import {
  activeRelayUrls,
  customFeedSliceLimits,
  dedupeEvents,
  eventStatsFromEvents,
  eventMatchesTimeWindow,
  extractContactListDetails,
  feedKindsForMode,
  feedRelayLimitForMode,
  feedSinceForQuery,
  feedFiltersForMode,
  fetchFeed,
  fetchRelayInfoDocuments,
  filterEventsDeletedByRequests,
  filterSpam,
  isReplyEvent,
  isMachineGeneratedContent,
  limitCryptoTopicDensity,
  limitConsecutiveAuthors,
  loginWithBunker,
  loginWithPrivateKey,
  nextRelayBackoffState,
  notificationForEvent,
  normalizeNip05Identifier,
  normalizePomegranateCentralUrl,
  parseProfileEvents,
  pomegranateBunkerUrl,
  preferredReadRelayUrls,
  publishNote,
  topLevelFeedEvents
} from './client';
import type { NostrEvent, RelayState, Session } from './types';

const pubkey = 'a'.repeat(64);

afterEach(() => {
  vi.restoreAllMocks();
});

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: overrides.id ?? crypto.randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
    pubkey: overrides.pubkey ?? pubkey,
    created_at: overrides.created_at ?? 100,
    kind: overrides.kind ?? 1,
    tags: overrides.tags ?? [],
    content: overrides.content ?? 'hello nostr',
    sig: overrides.sig ?? 'b'.repeat(128)
  };
}

describe('nostr client helpers', () => {
  it('selects the best enabled relays for read and write intents', () => {
    const relays: RelayState[] = [
      { url: 'wss://low.example', enabled: true, read: true, write: true, score: 10 },
      { url: 'wss://off.example', enabled: false, read: true, write: true, score: 99 },
      { url: 'wss://read.example', enabled: true, read: true, write: false, score: 90 },
      { url: 'wss://write.example', enabled: true, read: false, write: true, score: 80 }
    ];

    expect(activeRelayUrls(relays, 'read')).toEqual(['wss://read.example', 'wss://low.example']);
    expect(activeRelayUrls(relays, 'write')).toEqual(['wss://write.example', 'wss://low.example']);
  });

  it('waits for repeated relay failures before backing off reads', () => {
    const first = nextRelayBackoffState(undefined, 1000);
    const second = nextRelayBackoffState(first, 2000);
    const third = nextRelayBackoffState(second, 3000);

    expect(first).toEqual({ failures: 1, retryAt: 1000 });
    expect(second).toEqual({ failures: 2, retryAt: 2000 });
    expect(third.failures).toBe(3);
    expect(third.retryAt).toBeGreaterThan(3000);
  });

  it('prefers already connected read relays for the first short-lived query', () => {
    const relays = [
      'wss://relay-one.example',
      'wss://relay-two.example/',
      'wss://relay-three.example',
      'wss://relay-four.example',
      'wss://relay-five.example'
    ];

    expect(preferredReadRelayUrls(relays, ['wss://relay-two.example', 'wss://relay-three.example', 'wss://relay-five.example'])).toEqual([
      'wss://relay-two.example/',
      'wss://relay-three.example',
      'wss://relay-five.example'
    ]);
  });

  it('falls back to the full relay set when too few connected relays are available', () => {
    const relays = ['wss://relay-one.example', 'wss://relay-two.example', 'wss://relay-three.example'];

    expect(preferredReadRelayUrls(relays, ['wss://relay-two.example'])).toEqual(relays);
    expect(preferredReadRelayUrls(relays, [])).toEqual(relays);
  });

  it('preserves relays when relay info lookups fail', async () => {
    const relays: RelayState[] = [
      { url: 'wss://ok.example', enabled: true, read: true, write: true, score: 10 },
      { url: 'wss://fail.example', enabled: true, read: true, write: false, score: 5 },
      { url: 'wss://disabled.example', enabled: false, read: true, write: true, score: 1 }
    ];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://ok.example') {
        return new Response(JSON.stringify({ supported_nips: [1, 11], limitation: { max_message_length: 1024 } }), { status: 200 });
      }
      throw new Error('relay info unavailable');
    });

    const enriched = await fetchRelayInfoDocuments(relays);

    expect(enriched).toHaveLength(relays.length);
    expect(enriched[0]).toMatchObject({ url: 'wss://ok.example', supportedNips: [1, 11], limitation: { max_message_length: 1024 } });
    expect(enriched[1]).toEqual(relays[1]);
    expect(enriched[2]).toEqual(relays[2]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('dedupes each relay batch and sorts newest first without poisoning future batches', () => {
    const older = event({ id: '1'.repeat(64), created_at: 10 });
    const newer = event({ id: '2'.repeat(64), created_at: 20 });

    expect(dedupeEvents([older, newer, older]).map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(dedupeEvents([older]).map((item) => item.id)).toEqual([older.id]);
  });

  it('rejects relay results outside the requested time window', () => {
    expect(eventMatchesTimeWindow(event({ created_at: 100 }), 90, 110)).toBe(true);
    expect(eventMatchesTimeWindow(event({ created_at: 89 }), 90, 110)).toBe(false);
    expect(eventMatchesTimeWindow(event({ created_at: 111 }), 90, 110)).toBe(false);
  });

  it('limits consecutive authors and only restores deferred notes after other authors', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const c = 'c'.repeat(64);
    const items = [
      event({ id: '1'.repeat(64), pubkey: a }),
      event({ id: '2'.repeat(64), pubkey: a }),
      event({ id: '3'.repeat(64), pubkey: a }),
      event({ id: '4'.repeat(64), pubkey: a }),
      event({ id: '5'.repeat(64), pubkey: b }),
      event({ id: '6'.repeat(64), pubkey: c })
    ];

    expect(limitConsecutiveAuthors(items, 2).map((item) => item.pubkey)).toEqual([a, a, b, a, a, c]);
    expect(limitConsecutiveAuthors(items.slice(0, 4), 2).map((item) => item.id)).toEqual(['1'.repeat(64), '2'.repeat(64)]);
  });

  it('spaces crypto and bitcoin topics out in broad global feeds', () => {
    const items = [
      event({ id: '1'.repeat(64), content: 'bitcoin is moving' }),
      event({ id: '2'.repeat(64), content: 'crypto markets update' }),
      event({ id: 'a'.repeat(64), content: 'fintech node operators are active' }),
      event({ id: 'b'.repeat(64), content: 'monero and z-cash discussion' }),
      ...Array.from({ length: 10 }, (_, index) => event({ id: `${index + 3}`.repeat(64).slice(0, 64), content: `normal post ${index}` })),
      event({ id: 'd'.repeat(64), content: 'another #bitcoin thought' })
    ];

    expect(limitCryptoTopicDensity(items, 10).map((item) => item.content)).toEqual([
      'bitcoin is moving',
      ...Array.from({ length: 10 }, (_, index) => `normal post ${index}`),
      'another #bitcoin thought'
    ]);
  });

  it('keeps trusted global authors through spam filtering unless muted', () => {
    const trusted = 'a'.repeat(64);
    const muted = new Set<string>();
    const trustedSet = new Set([trusted]);
    const noisy = event({ id: '1'.repeat(64), pubkey: trusted, content: `${'long '.repeat(300)} #adult` });
    const regularNoisy = event({ id: '2'.repeat(64), pubkey: 'b'.repeat(64), content: `${'long '.repeat(300)} #adult` });

    expect(filterSpam([noisy, regularNoisy], muted, trustedSet).map((item) => item.id)).toEqual([noisy.id]);
    expect(filterSpam([noisy], new Set([trusted]), trustedSet)).toEqual([]);
  });

  it('returns an empty follow or custom feed when there are no follows', async () => {
    await expect(fetchFeed('follow', [], [])).resolves.toEqual([]);
    await expect(fetchFeed('custom', [], [])).resolves.toEqual([]);
  });

  it('does not date-throttle the initial following feed query', () => {
    expect(feedSinceForQuery('follow', {}, 1_000_000)).toBeUndefined();
    expect(feedSinceForQuery('follow', { since: 123 }, 1_000_000)).toBe(123);
    expect(feedSinceForQuery('global', {}, 1_000_000)).toBe(395_200);
  });

  it('requests reposts for personal feeds because profiles display repost activity too', () => {
    expect(feedKindsForMode('follow')).toEqual([1, 6]);
    expect(feedKindsForMode('custom')).toEqual([1, 6]);
    expect(feedKindsForMode('global')).toEqual([1]);
  });

  it('over-fetches raw personal feed events so sparse follows can fill visible notes', () => {
    expect(feedRelayLimitForMode('follow', 24)).toBe(96);
    expect(feedRelayLimitForMode('custom', 72)).toBe(240);
    expect(feedRelayLimitForMode('global', 24)).toBe(24);
  });

  it('adds hashtag constraints while preserving the active feed mode', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10 };

    expect(await feedFiltersForMode('global', base, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, [], { hashtag: '#Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], since: 123 }
    ]);
    expect(await feedFiltersForMode('follow', base, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, [], { hashtag: 'Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], authors: follows, since: 123 }
    ]);
    expect(await feedFiltersForMode('custom', base, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, [], { hashtag: 'Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], authors: follows, since: 123 }
    ]);
  });

  it('omits since from older paged feed filters', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10, until: 456 };

    expect(await feedFiltersForMode('follow', base, follows, { friendsOfFriends: false, keywords: [], interests: [] }, undefined, [], { until: 456 })).toEqual([
      { kinds: [1], limit: 10, until: 456, authors: follows }
    ]);
    expect(await feedFiltersForMode('custom', base, follows, { friendsOfFriends: false, keywords: ['art'], interests: [] }, undefined, [], { until: 456 })).toEqual([
      { kinds: [1], limit: 8, until: 456, authors: follows },
      { kinds: [1], limit: 1, until: 456, '#t': ['art'] },
      { kinds: [1], limit: 1, until: 456, search: 'art' }
    ]);
  });

  it('uses the full follow list for custom follow slices instead of sampling authors', async () => {
    const follows = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)];
    const base = { kinds: [1], limit: 10 };

    expect(await feedFiltersForMode('custom', base, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, [])).toEqual([
      { kinds: [1], limit: 10, authors: follows, since: 123 }
    ]);
  });

  it('splits large following author filters so relays do not receive one huge authors list', async () => {
    const follows = Array.from({ length: 100 }, (_, index) => index.toString(16).padStart(64, '0'));
    const filters = await feedFiltersForMode('follow', { kinds: [1], limit: 24 }, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, []);

    expect(filters).toHaveLength(3);
    expect(filters.flatMap((filter) => filter.authors ?? [])).toEqual(follows);
    expect(filters.map((filter) => filter.authors?.length)).toEqual([48, 48, 4]);
    expect(filters.map((filter) => filter.limit)).toEqual([8, 8, 8]);
    expect(filters.every((filter) => filter.since === 123)).toBe(true);
  });

  it('does not add limits to live following filters when splitting large author lists', async () => {
    const follows = Array.from({ length: 50 }, (_, index) => index.toString(16).padStart(64, '0'));
    const filters = await feedFiltersForMode('follow', { kinds: [1] }, follows, { friendsOfFriends: false, keywords: [], interests: [] }, 123, []);

    expect(filters).toHaveLength(2);
    expect(filters.map((filter) => filter.limit)).toEqual([undefined, undefined]);
    expect(filters.flatMap((filter) => filter.authors ?? [])).toEqual(follows);
  });

  it('shows like and repost notifications for events that tag the user even before the target note is cached', () => {
    const target = 'f'.repeat(64);
    const like = event({ id: '1'.repeat(64), kind: 7, pubkey: 'b'.repeat(64), content: '+', tags: [['e', target], ['p', pubkey]] });
    const repost = event({ id: '2'.repeat(64), kind: 6, pubkey: 'c'.repeat(64), tags: [['e', target], ['p', pubkey]] });

    expect(notificationForEvent(like, pubkey, new Map())).toMatchObject([{ id: `like:${target}:${like.pubkey}`, type: 'like', actor: like.pubkey, targetId: target }]);
    expect(notificationForEvent(repost, pubkey, new Map())).toMatchObject([{ id: `repost:${target}:${repost.pubkey}`, type: 'repost', actor: repost.pubkey, targetId: target }]);
  });

  it('does not create app notifications for follows', () => {
    const follower = 'b'.repeat(64);
    const first = event({ id: '1'.repeat(64), kind: 3, pubkey: follower, tags: [['p', pubkey]] });
    const second = event({ id: '2'.repeat(64), kind: 3, pubkey: follower, tags: [['p', pubkey]] });

    expect(notificationForEvent(first, pubkey, new Map())).toEqual([]);
    expect(notificationForEvent(second, pubkey, new Map())).toEqual([]);
  });


  it('constrains the global feed to default hashtags while preserving custom feed keyword slices', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10 };
    const settings = { friendsOfFriends: false, keywords: ['#art', '#artstr', '#music', '#musicstr'], interests: [] };

    expect(await feedFiltersForMode('global', base, follows, settings, 123, [])).toEqual([
      { kinds: [1], limit: 10, '#t': ['technology', 'food', 'foodstr', 'music', 'musicstr', 'introductions'], since: 123 }
    ]);
    expect(await feedFiltersForMode('custom', base, follows, settings, 123, [])).toEqual([
      { kinds: [1], limit: 8, authors: follows, since: 123 },
      { kinds: [1], limit: 2, '#t': ['art', 'artstr', 'music', 'musicstr'], since: 123 }
    ]);
  });

  it('uses the default hashtag set for broad global feed queries', async () => {
    const base = { kinds: [1], limit: 10 };

    expect(await feedFiltersForMode('global', base, [], { friendsOfFriends: false, keywords: [], interests: [] }, 123, [])).toEqual([
      { kinds: [1], limit: 10, '#t': ['technology', 'food', 'foodstr', 'music', 'musicstr', 'introductions'], since: 123 }
    ]);
  });

  it('mixes default global authors into broad global feed queries at 50 percent', async () => {
    const base = { kinds: [1], limit: 20 };
    const authors = ['a'.repeat(64), 'b'.repeat(64)];

    expect(await feedFiltersForMode('global', base, [], { friendsOfFriends: false, keywords: [], interests: [] }, 123, [], { globalAuthors: authors })).toEqual([
      { kinds: [1], limit: 10, '#t': ['technology', 'food', 'foodstr', 'music', 'musicstr', 'introductions'], since: 123 },
      { kinds: [1], limit: 10, authors, since: 123 }
    ]);
  });

  it('uses follows and keywords when custom feed has follows, keywords, and no available friends-of-friends', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10 };
    const settings = { friendsOfFriends: true, keywords: ['#sports', 'cycling'], interests: [] };

    expect(await feedFiltersForMode('custom', base, follows, settings, 123, [])).toEqual([
      { kinds: [1], limit: 8, authors: follows, since: 123 },
      { kinds: [1], limit: 1, '#t': ['sports', 'cycling'], since: 123 },
      { kinds: [1], limit: 1, search: 'cycling', since: 123 }
    ]);
  });

  it('keeps keyword query filters within the allocated keyword limit', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10 };
    const settings = { friendsOfFriends: false, keywords: ['guns', 'bitcoin', 'flowers'], interests: [] };

    const filters = await feedFiltersForMode('custom', base, follows, settings, 123, []);
    expect(filters).toEqual([
      { kinds: [1], limit: 8, authors: follows, since: 123 },
      { kinds: [1], limit: 1, '#t': ['guns', 'bitcoin', 'flowers'], since: 123 },
      { kinds: [1], limit: 1, search: 'guns', since: 123 }
    ]);
    expect(filters.reduce((total, filter) => total + (filter.limit ?? 0), 0)).toBe(10);
  });

  it('uses only keyword filters when custom feed has keywords but no follows', async () => {
    const base = { kinds: [1], limit: 10 };

    expect(await feedFiltersForMode('custom', base, [], { friendsOfFriends: true, keywords: ['#sports', 'cycling'], interests: [] }, 123, [])).toEqual([
      { kinds: [1], limit: 5, '#t': ['sports', 'cycling'], since: 123 },
      { kinds: [1], limit: 5, search: 'cycling', since: 123 }
    ]);
  });

  it('allocates custom feed slices and redistributes missing optional slices to follows', () => {
    expect(customFeedSliceLimits(10, true, true, true)).toEqual({
      followLimit: 6,
      friendsOfFriendsLimit: 2,
      keywordLimit: 2
    });
    expect(customFeedSliceLimits(10, true, true, false)).toEqual({
      followLimit: 8,
      friendsOfFriendsLimit: 2,
      keywordLimit: 0
    });
    expect(customFeedSliceLimits(10, true, false, true)).toEqual({
      followLimit: 8,
      friendsOfFriendsLimit: 0,
      keywordLimit: 2
    });
    expect(customFeedSliceLimits(10, true, false, false)).toEqual({
      followLimit: 10,
      friendsOfFriendsLimit: 0,
      keywordLimit: 0
    });
    expect(customFeedSliceLimits(10, false, false, true)).toEqual({
      followLimit: 0,
      friendsOfFriendsLimit: 0,
      keywordLimit: 10
    });
  });

  it('filters muted pubkeys and obvious muted-word spam', () => {
    const muted = event({ pubkey: 'c'.repeat(64), content: 'normal note' });
    const spam = event({ content: 'free sats now' });
    const good = event({ content: 'protocol work is happening' });

    expect(filterSpam([muted, spam, good], new Set([muted.pubkey]))).toEqual([good]);
  });

  it('can filter profanity for broad global feeds without changing the default spam filter', () => {
    const profane = event({ content: 'fuck you maga #introductions' });
    const good = event({ content: 'welcome to nostr #introductions' });

    expect(filterSpam([profane, good]).map((item) => item.id)).toEqual([profane.id, good.id]);
    expect(filterSpam([profane, good], new Set(), new Set(), { blockProfanity: true }).map((item) => item.id)).toEqual([good.id]);
  });

  it('filters article-length feed posts', () => {
    const longPost = event({ content: 'a'.repeat(901) });
    const normalPost = event({ content: 'a'.repeat(900) });

    expect(filterSpam([longPost, normalPost])).toEqual([normalPost]);
  });

  it('keeps replies out of top-level feed results', () => {
    const root = event({ content: 'top-level note' });
    const markedReply = event({ content: 'reply', tags: [['e', root.id, 'wss://relay.example', 'reply', root.pubkey]] });
    const legacyReply = event({ content: 'legacy reply', tags: [['e', root.id]] });
    const quoted = event({ content: 'quoted note', tags: [['e', root.id], ['q', root.id]] });
    const mentioned = event({ content: 'mentioned note', tags: [['e', root.id, 'wss://relay.example', 'mention']] });
    const embedded = event({
      content: 'nostr:note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqc8247j',
      tags: [['e', root.id]]
    });

    expect(isReplyEvent(root)).toBe(false);
    expect(isReplyEvent(markedReply)).toBe(true);
    expect(isReplyEvent(legacyReply)).toBe(true);
    expect(isReplyEvent(quoted)).toBe(false);
    expect(isReplyEvent(mentioned)).toBe(false);
    expect(isReplyEvent(embedded)).toBe(false);
    expect(topLevelFeedEvents([root, markedReply, legacyReply, quoted, mentioned, embedded])).toEqual([root, quoted, mentioned, embedded]);
  });

  it('hides events only when deletion requests are signed by the original author', () => {
    const kept = event({ id: '1'.repeat(64), pubkey: 'a'.repeat(64), content: 'keep me' });
    const deleted = event({ id: '2'.repeat(64), pubkey: 'b'.repeat(64), content: 'delete me' });
    const validDeletion = event({ kind: 5, pubkey: deleted.pubkey, tags: [['e', deleted.id], ['k', '1']] });
    const forgedDeletion = event({ kind: 5, pubkey: 'c'.repeat(64), tags: [['e', kept.id], ['k', '1']] });

    expect(filterEventsDeletedByRequests([kept, deleted], [validDeletion, forgedDeletion])).toEqual([kept]);
  });

  it('counts note stats using NIP-10, NIP-18, and NIP-25 targets', () => {
    const root = event({ id: '1'.repeat(64), content: 'root' });
    const mentioned = event({ id: '2'.repeat(64), content: 'mentioned' });
    const reply = event({ id: '3'.repeat(64), tags: [['e', root.id, 'wss://relay.example', 'root', root.pubkey]] });
    const legacyReply = event({ id: '4'.repeat(64), tags: [['e', root.id]] });
    const repost = event({ id: '5'.repeat(64), kind: 6, tags: [['e', root.id, 'wss://relay.example'], ['p', root.pubkey]] });
    const like = event({ id: '6'.repeat(64), kind: 7, pubkey: 'c'.repeat(64), content: '+', tags: [['e', mentioned.id], ['e', root.id]] });
    const duplicateLike = event({ id: '7'.repeat(64), kind: 7, pubkey: 'c'.repeat(64), content: '+', tags: [['e', root.id]] });
    const dislike = event({ id: '8'.repeat(64), kind: 7, pubkey: 'd'.repeat(64), content: '-', tags: [['e', root.id]] });
    const emoji = event({ id: '9'.repeat(64), kind: 7, pubkey: 'e'.repeat(64), content: '🔥', tags: [['e', root.id]] });
    const zap = event({
      id: 'a'.repeat(64),
      kind: 9735,
      pubkey: 'f'.repeat(64),
      tags: [
        ['e', root.id],
        ['bolt11', 'lnbc1test'],
        ['description', JSON.stringify({ tags: [['amount', '21000'], ['e', root.id]] })]
      ]
    });

    expect(eventStatsFromEvents([root.id, mentioned.id], [reply, legacyReply, repost, like, duplicateLike, dislike, emoji, zap])).toEqual({
      [root.id]: { replies: 2, reposts: 1, likes: 1, zaps: 1, zapSats: 21, dislikes: 1, emoji: 1 },
      [mentioned.id]: { replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 }
    });
  });

  it('deduplicates repeat likes from the same pubkey', () => {
    const root = event({ id: '1'.repeat(64), content: 'root' });
    const liker = 'c'.repeat(64);
    const oldLike = event({ id: '6'.repeat(64), kind: 7, pubkey: liker, content: '+', tags: [['e', root.id]] });
    const newLike = event({ id: '7'.repeat(64), kind: 7, pubkey: liker, content: '+', tags: [['e', root.id]] });

    expect(eventStatsFromEvents([root.id], [oldLike, newLike])[root.id].likes).toBe(1);
  });

  it('deduplicates repeat reposts from the same pubkey', () => {
    const root = event({ id: '1'.repeat(64), content: 'root' });
    const reposter = 'c'.repeat(64);
    const oldRepost = event({ id: '6'.repeat(64), kind: 6, pubkey: reposter, tags: [['e', root.id]] });
    const newRepost = event({ id: '7'.repeat(64), kind: 6, pubkey: reposter, tags: [['e', root.id]] });

    expect(eventStatsFromEvents([root.id], [oldRepost, newRepost])[root.id].reposts).toBe(1);
  });

  it('filters obvious adult content by keyword, hashtag, domain, and warning tags', () => {
    const keyword = event({ content: 'this is nsfw content' });
    const hashtag = event({ content: 'look at this #porn account' });
    const domain = event({ content: 'bad link https://onlyfans.com/example' });
    const warning = event({ content: 'hidden behind warning', tags: [['content-warning']] });
    const good = event({ content: 'teenage engineering made a nice synthesizer' });

    expect(filterSpam([keyword, hashtag, domain, warning, good])).toEqual([good]);
  });

  it('filters common hate and harassment terms without substring false positives', () => {
    const hate = event({ content: 'white power rally spam' });
    const slur = event({ content: 'posting n1gger bait' });
    const benignSubstring = event({ content: 'I am debugging the turn signal relay in my car.' });

    expect(filterSpam([hate, slur, benignSubstring])).toEqual([benignSubstring]);
  });

  it('filters machine telemetry json while allowing human text with small json snippets', () => {
    const machine = event({
      content: JSON.stringify({
        protocol: 'NATIVE_AI_PROTOCOL_V2',
        action: 'REGISTER_ACTIVE_TOOL',
        pipeline_segment: 'A',
        session_entropy: 'abc',
        system_telemetry: { node_status: 'ONLINE' }
      })
    });
    const human = event({ content: 'Here is a useful config snippet: {"relay":"wss://relay.example"}' });

    expect(isMachineGeneratedContent(machine.content)).toBe(true);
    expect(isMachineGeneratedContent(human.content)).toBe(false);
    expect(filterSpam([machine, human])).toEqual([human]);
  });

  it('filters pure json text notes from broad feeds', () => {
    const jsonNote = event({
      content: JSON.stringify({
        type: 'zone_list',
        zone: '7gS9HiiJAlzX6DpcYoq',
        name: 'Tucson',
        ts: 1779568044946,
        members: [{ devicePk: '4a29ff60c53837e9e20555bfeb2a046be3eb140818144628691fcf7efb1d2f1', swarm: '' }]
      })
    });
    const human = event({ content: 'I posted a human-readable note with a tiny sample: {"ok":true}' });

    expect(isMachineGeneratedContent(jsonNote.content)).toBe(true);
    expect(isMachineGeneratedContent(human.content)).toBe(false);
    expect(filterSpam([jsonNote, human])).toEqual([human]);
  });

  it('filters nested swarm device json records from the feed', () => {
    const swarm = event({
      content: JSON.stringify({
        type: 'swarm_device_record',
        record: JSON.stringify({
          kind: 30078,
          created_at: 1779560256,
          tags: [['t', 'swarm_discovery']],
          type: 'device',
          content: JSON.stringify({ identityId: 'id-LnZz1joVZtIvTiIo', label: 'Aux', devicePks: ['4a29ff60c5'] })
        })
      })
    });
    const human = event({ content: 'I changed my lightning node setup today and wrote notes for humans.' });

    expect(isMachineGeneratedContent(swarm.content)).toBe(true);
    expect(filterSpam([swarm, human])).toEqual([human]);
  });

  it('filters broadcast transport payloads that are not human-readable notes', () => {
    const transport = event({
      content: `[broadcast:[#1695f]] {"route":{"id":"1779540780109963-80109","from":"[#1695f]","to":"broadcast"},"payload":{"type":"ar_profile","profile":{"id":"[#1695f]"},"p":"${'A'.repeat(600)}"}}`
    });
    const human = event({ content: 'I am debugging a relay route today, but this is still a normal human note.' });

    expect(isMachineGeneratedContent(transport.content)).toBe(true);
    expect(filterSpam([transport, human])).toEqual([human]);
  });

  it('filters machine hostname payloads while allowing normal discussion', () => {
    const payload = event({ content: 'sp_4c43bd1.lee73059.03.5XSLXRRCYOYAEVOKEZVTEF4A67LG3AYWG4DSTQNLXNTC2O2EPFMHAILOPKXVLWY.drift.gits.net' });
    const rotatedDomain = event({ content: '  sp_4c43bd1.5cdc4f52.06.WJYMOTSU7XZBVZCU55RYUQB2SIRSBTOCFMOVTZBKFPU2OEJ5OJYLUPKLI24WKWA.example.net  ' });
    const rotatedPrefix = event({ content: 'mx9a77fd.5cdc4f52.06.WJYMOTSU7XZBVZCU55RYUQB2SIRSBTOCFMOVTZBKFPU2OEJ5OJYLUPKLI24WKWA.example.net' });
    const human = event({ content: 'I saw odd drift.gits.net hostnames on a relay and wrote notes about filtering them.' });
    const normalHost = event({ content: 'sp_service.docs.example.net' });
    const normalCacheBustUrl = event({ content: 'assets.2026-06-02.a1b2c3d4.example.net' });

    expect(isMachineGeneratedContent(payload.content)).toBe(true);
    expect(isMachineGeneratedContent(rotatedDomain.content)).toBe(true);
    expect(isMachineGeneratedContent(rotatedPrefix.content)).toBe(true);
    expect(isMachineGeneratedContent(human.content)).toBe(false);
    expect(isMachineGeneratedContent(normalHost.content)).toBe(false);
    expect(isMachineGeneratedContent(normalCacheBustUrl.content)).toBe(false);
    expect(filterSpam([payload, rotatedDomain, rotatedPrefix, human, normalHost, normalCacheBustUrl])).toEqual([human, normalHost, normalCacheBustUrl]);
  });

  it('filters bot metadata json notes with emote payload fields', () => {
    const bot = event({
      content:
        '{"p":"kick","u":"Holispider","m":"💻 Pokud tě zajímá cokoliv o mně nebo mém contentu, tak skoč na https://holispider.eu\\\\h — tam je kompletní lore 😂","b":"9","a":"0","f":"0","fw":"","bot":1,"emotes":[{"name":"💻","url":""},{"name":"😂","url":""}],"serverTime":"17:29"}'
    });
    const human = event({ content: 'I keep my links and notes here, enjoy the rabbit hole.' });

    expect(isMachineGeneratedContent(bot.content)).toBe(true);
    expect(filterSpam([bot, human])).toEqual([human]);
  });

  it('logs in with raw hex and nsec private keys', () => {
    const secret = new Uint8Array(32).fill(7);
    const hex = bytesToHex(secret);
    const nsec = nip19.nsecEncode(secret);

    expect(loginWithPrivateKey(hex)).toMatchObject({ mode: 'private-key', secret: hex });
    expect(loginWithPrivateKey(nsec)).toMatchObject({ mode: 'private-key', secret: hex });
  });

  it('rejects invalid bunker sessions before trying to sign', async () => {
    await expect(loginWithBunker('bunker://not-a-valid-pubkey?relay=wss://relay.example')).rejects.toThrow('Enter a valid bunker:// URI.');
  });

  it('normalizes Pomegranate central URLs', () => {
    expect(normalizePomegranateCentralUrl('localhost:5033/')).toBe('http://localhost:5033');
    expect(normalizePomegranateCentralUrl('localhost:5033/profile')).toBe('http://localhost:5033');
    expect(normalizePomegranateCentralUrl('central.example/path')).toBe('https://central.example');
    expect(normalizePomegranateCentralUrl('https://central.example/profile')).toBe('https://central.example');
    expect(() => normalizePomegranateCentralUrl('')).toThrow('Enter a Pomegranate central URL.');
    expect(() => normalizePomegranateCentralUrl('https://')).toThrow('Enter a valid Pomegranate central URL.');
  });

  it('normalizes exact NIP-05 search identifiers', () => {
    expect(normalizeNip05Identifier('@BenArc@Nostr.com')).toBe('benarc@nostr.com');
    expect(normalizeNip05Identifier('benarc')).toBe('');
    expect(normalizeNip05Identifier('bad@localhost')).toBe('');
  });

  it('builds Pomegranate bunker URLs from profile handlers', () => {
    const handler = 'c'.repeat(64);

    expect(pomegranateBunkerUrl('https://central.example', handler)).toBe(`bunker://${handler}?relay=wss%3A%2F%2Fcentral.example`);
    expect(pomegranateBunkerUrl('http://localhost:5033', handler)).toBe(`bunker://${handler}?relay=ws%3A%2F%2Flocalhost%3A5033`);
    expect(() => pomegranateBunkerUrl('https://central.example', 'not-a-pubkey')).toThrow('valid handler public key');
  });

  it('parses profile metadata events and ignores malformed records', () => {
    const valid = event({ kind: 0, pubkey, content: JSON.stringify({ name: 'Ada', about: 'builds clients' }) });
    const invalid = event({ kind: 0, pubkey: 'd'.repeat(64), content: '{nope' });

    expect(parseProfileEvents([valid, invalid])).toEqual([{ pubkey, name: 'Ada', about: 'builds clients', updated_at: valid.created_at }]);
  });

  it('extracts contact pubkeys and relay hints from contact lists', () => {
    const contact = 'c'.repeat(64);
    const details = extractContactListDetails(
      event({
        kind: 3,
        tags: [
          ['p', contact, 'wss://relay.contact.example'],
          ['p', contact, 'wss://relay.contact.example'],
          ['p', 'd'.repeat(64), 'https://not-a-relay.example']
        ]
      })
    );

    expect(details.pubkeys).toEqual([contact, 'd'.repeat(64)]);
    expect(details.relayHints).toEqual(['wss://relay.contact.example']);
  });

  it('fails clearly when publishing with no write relays', async () => {
    const session: Session = { mode: 'private-key', pubkey, secret: bytesToHex(new Uint8Array(32).fill(1)) };

    await expect(publishNote(session, 'hello', [{ url: 'wss://read.example', enabled: true, read: true, write: false, score: 10 }])).rejects.toThrow(
      'No write relays are enabled.'
    );
  });

  it('refuses to publish the active private key in event content or tags', async () => {
    const secret = bytesToHex(new Uint8Array(32).fill(2));
    const session: Session = { mode: 'private-key', pubkey: loginWithPrivateKey(secret).pubkey, secret };

    await expect(publishNote(session, `do not post ${secret}`, [])).rejects.toThrow('private signing material');
    await expect(publishNote(session, 'hello', [], [['alt', nip19.nsecEncode(new Uint8Array(32).fill(2))]])).rejects.toThrow('private signing material');
  });

  it('refuses to publish nsec-looking private keys even when they are not the active key', async () => {
    const session: Session = { mode: 'private-key', pubkey, secret: bytesToHex(new Uint8Array(32).fill(3)) };
    const otherNsec = nip19.nsecEncode(new Uint8Array(32).fill(4));

    await expect(publishNote(session, `oops ${otherNsec}`, [])).rejects.toThrow('nsec private key');
  });
});
