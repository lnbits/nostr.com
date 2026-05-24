import { finalizeEvent, generateSecretKey, getEventHash, getPublicKey, nip04, nip17, nip19, nip44, nip98, SimplePool, verifyEvent } from 'nostr-tools';
import type { Event as NostrToolsEvent, Filter } from 'nostr-tools';
import * as nip46 from 'nostr-tools/nip46';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { cacheEvents, cacheProfile, cacheProfileEvents } from './cache';
import { adultDomains, adultHashtags, defaultGuestNip05, defaultRelays, mutedWords } from './config';
import type { ContactListDetails, ContactListItem, CustomFeedSettings, DirectMessage, EventStats, FeedMode, FeedQueryOptions, Nip05Profile, NostrEvent, NotificationItem, Profile, RelayState, Session } from './types';

const pool = new SimplePool();
const bunkerSigners = new Map<string, nip46.BunkerSigner>();
type SubCloser = { close: (reason?: string) => void };
type PomegranateProfile = { name: string; handler_pubkey: string; email?: string };
type PomegranateAccount = { pubkey: string; email?: string };

class PomegranateRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function activeRelayUrls(relays: RelayState[], intent: 'read' | 'write') {
  const urls = relays
    .filter((relay) => relay.enabled && relay[intent])
    .sort((a, b) => b.score - a.score)
    .slice(0, intent === 'read' ? 10 : 3)
    .map((relay) => normalizeRelayUrl(relay.url))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function normalizeRelayUrl(url: string) {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') return '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return /^wss:\/\/[^ ]+\.[^ ]+/.test(trimmed) ? trimmed.replace(/\/+$/, '') : '';
  }
}

function queryShortLived(relayUrls: string[], filter: Filter, maxWait = 5000) {
  return new Promise<NostrEvent[]>((resolve) => {
    const events: NostrEvent[] = [];
    let settled = false;
    let closer: SubCloser | undefined;
    const timeout = setTimeout(() => finish(), maxWait + 250);

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      closer?.close();
      resolve(events);
    };

    closer = pool.subscribeManyEose(relayUrls, filter, {
      maxWait,
      onevent(event) {
        events.push(event as NostrEvent);
      },
      onclose() {
        finish();
      }
    });
  });
}

export function createGuestSession(): Session {
  const secret = generateSecretKey();
  return { pubkey: getPublicKey(secret), mode: 'private-key', secret: bytesToHex(secret) };
}

export async function loginWithNip07(): Promise<Session> {
  if (!window.nostr) throw new Error('No NIP-07 extension was found.');
  return { pubkey: await window.nostr.getPublicKey(), mode: 'nip07' };
}

export function loginWithPrivateKey(secret: string): Session {
  const normalized = secret.trim();
  const bytes = normalized.startsWith('nsec1') ? decodeNsec(normalized) : hexToBytes(normalized);
  return { pubkey: getPublicKey(bytes), mode: 'private-key', secret: bytesToHex(bytes) };
}

export async function loginWithBunker(uri: string): Promise<Session> {
  const bunker = uri.trim();
  const pointer = await nip46.parseBunkerInput(bunker);
  if (!pointer) throw new Error('Enter a valid bunker:// URI.');
  const clientSecret = generateSecretKey();
  const signer = nip46.BunkerSigner.fromBunker(clientSecret, pointer, {
    pool,
    onauth: (url: string) => {
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
  await signer.connect();
  const pubkey = await signer.getPublicKey();
  const session: Session = {
    pubkey,
    mode: 'bunker',
    bunker,
    bunkerClientSecret: bytesToHex(clientSecret),
    bunkerRelays: pointer.relays,
    bunkerRemotePubkey: pointer.pubkey,
    bunkerSecret: pointer.secret
  };
  bunkerSigners.set(bunkerSignerKey(session), signer);
  return session;
}

export async function loginWithPomegranate(centralInput: string): Promise<Session> {
  const centralUrl = normalizePomegranateCentralUrl(centralInput);
  const token = await authenticatePomegranateCentral(centralUrl);
  const account = await fetchPomegranateAccount(centralUrl, token);
  const profile = await ensurePomegranateDefaultProfile(centralUrl, token);
  const bunker = pomegranateBunkerUrl(centralUrl, profile.handler_pubkey);
  const session = await loginWithBunker(bunker);
  if (account.pubkey && account.pubkey !== session.pubkey) throw new Error('Pomegranate account key did not match the remote signer.');
  return {
    ...session,
    mode: 'pomegranate',
    pomegranateCentral: centralUrl,
    pomegranateEmail: pomegranateEmailFromToken(token) || account.email || profile.email,
    pomegranateProfile: profile.name
  };
}

export function normalizePomegranateCentralUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a Pomegranate central URL.');
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const value = hasProtocol ? trimmed : trimmed.replace(/\/+$/, '');
  const withProtocol = hasProtocol ? value : `${isLocalPomegranateHost(value) ? 'http' : 'https'}://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Pomegranate central URL must use http or https.');
    return url.origin;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must use')) throw error;
    throw new Error('Enter a valid Pomegranate central URL.');
  }
}

export function pomegranateBunkerUrl(centralUrl: string, handlerPubkey: string) {
  if (!/^[0-9a-f]{64}$/i.test(handlerPubkey)) throw new Error('Pomegranate profile is missing a valid handler public key.');
  const url = new URL(centralUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return `bunker://${handlerPubkey}?relay=${encodeURIComponent(url.toString().replace(/\/$/, ''))}`;
}

function isLocalPomegranateHost(value: string) {
  const host = value.split('/')[0];
  return /^localhost(?::\d+)?$/i.test(host) || /^127(?:\.\d{1,3}){3}(?::\d+)?$/.test(host);
}

async function authenticatePomegranateCentral(centralUrl: string) {
  if (typeof window === 'undefined') throw new Error('Pomegranate login is only available in the browser.');
  return new Promise<string>((resolve, reject) => {
    const popup = window.open(`${centralUrl}/login/google`, 'pomegranate-login', 'width=560,height=720');
    if (!popup) {
      reject(new Error('Pomegranate login popup was blocked.'));
      return;
    }
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timeout);
      clearInterval(closedCheck);
      window.removeEventListener('message', onMessage);
    };
    const finish = (token: string) => {
      cleanup();
      popup.close();
      resolve(token);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const timeout = setTimeout(() => fail('Pomegranate login timed out.'), 120_000);
    const closedCheck = setInterval(() => {
      if (!settled && popup.closed) fail('Pomegranate login was closed before approval.');
    }, 500);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== centralUrl) return;
      const token = typeof event.data?.token === 'string' ? event.data.token : '';
      if (token) finish(token);
    };
    window.addEventListener('message', onMessage);
  });
}

async function fetchPomegranateAccount(centralUrl: string, token: string) {
  try {
    return await pomegranateFetch<PomegranateAccount>(centralUrl, '/account', token);
  } catch (error) {
    if (error instanceof PomegranateRequestError && error.status === 404) {
      throw new Error('No Pomegranate account was found for this login. Create or recover it in Pomegranate first.');
    }
    throw error;
  }
}

async function ensurePomegranateDefaultProfile(centralUrl: string, token: string) {
  const profiles = await pomegranateFetch<PomegranateProfile[]>(centralUrl, '/profiles', token);
  const existing = profiles.find((profile) => profile.name === 'default') ?? profiles[0];
  if (existing) return existing;
  return pomegranateFetch<PomegranateProfile>(centralUrl, '/profiles', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'default' })
  });
}

async function pomegranateFetch<T>(centralUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${centralUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });
  if (!response.ok) throw new PomegranateRequestError(response.status, `Pomegranate request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function pomegranateEmailFromToken(token: string) {
  try {
    if (typeof atob !== 'function') return '';
    const decoded = JSON.parse(atob(token)) as { tags?: string[][] };
    return decoded.tags?.find((tag) => tag[0] === 'email' && tag[1])?.[1] ?? '';
  } catch {
    return '';
  }
}

export function filterSpam(events: NostrEvent[], mutedPubkeys = new Set<string>()) {
  return events.filter((event) => {
    if (mutedPubkeys.has(event.pubkey)) return false;
    if (event.kind === 6) return Boolean(parseRepostContent(event));
    if (isMachineGeneratedContent(event.content)) return false;
    if (!isFamilySafeEvent(event)) return false;
    const lower = event.content.toLowerCase();
    return !mutedWords.some((word) => containsBlockedPhrase(lower, word));
  });
}

export function topLevelFeedEvents(events: NostrEvent[]) {
  return events.filter((event) => event.kind === 1 && !isReplyEvent(event));
}

export function isReplyEvent(event: NostrEvent) {
  const eventTags = event.tags.filter((tag) => tag[0] === 'e' && tag[1]);
  if (!eventTags.length) return false;

  return eventTags.some((tag) => tag[3] === 'root' || tag[3] === 'reply') || eventTags.length > 0;
}

export function isFamilySafeEvent(event: NostrEvent) {
  const text = event.content.toLowerCase();
  if (mutedWords.some((word) => containsBlockedPhrase(text, word))) return false;
  if (adultDomains.some((domain) => text.includes(domain))) return false;
  if (adultHashtags.some((tag) => hasHashtag(text, tag))) return false;

  for (const tag of event.tags) {
    const [name, ...values] = tag;
    const lowerValues = values.map((value) => value.toLowerCase());
    if (name === 'content-warning' || name === 'warning') return false;
    if (name === 't' && lowerValues.some((value) => adultHashtags.includes(value.replace(/^#/, '')))) return false;
    if ((name === 'r' || name === 'url' || name === 'imeta') && lowerValues.some((value) => adultDomains.some((domain) => value.includes(domain)))) return false;
  }

  return true;
}

export function isMachineGeneratedContent(content: string) {
  const trimmed = content.trim();
  if (isTransportPayload(trimmed)) return true;
  if (!trimmed) return false;
  if (!/^[{[]/.test(trimmed) || !/[}\]]$/.test(trimmed)) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const keys = Object.keys(parsed as Record<string, unknown>);
    const machineKeys = ['protocol', 'action', 'pipeline_segment', 'session_entropy', 'system_telemetry', 'devicePk', 'swarm', 'service_metadata'];
    const machineKeyHits = keys.filter((key) => machineKeys.includes(key)).length;
    return isPureJsonNotePayload(parsed) || machineKeyHits >= 2 || isMachineJsonPayload(parsed) || isBotMetadataPayload(parsed) || (keys.length >= 5 && machineKeyHits >= 1);
  } catch {
    return false;
  }
}

function isPureJsonNotePayload(parsed: unknown) {
  return typeof parsed === 'object' && parsed !== null;
}

function isMachineJsonPayload(parsed: unknown) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  if (/^(swarm|device|service|telemetry|protocol|identity)[_-]/.test(type)) return true;
  if (type.includes('swarm') || type.includes('telemetry') || type.includes('device_record')) return true;
  if ('record' in record && typeof record.record === 'string' && isMachineGeneratedContent(record.record)) return true;
  if ('content' in record && typeof record.content === 'string' && isMachineGeneratedContent(record.content)) return true;
  return false;
}

function isBotMetadataPayload(parsed: unknown) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  const hasBotShape = typeof record.p === 'string' && typeof record.u === 'string' && typeof record.m === 'string';
  const hasTelemetryShape = 'bots' in record || 'emotes' in record || 'serverTime' in record || 'fw' in record || 'a' in record;
  return hasBotShape && hasTelemetryShape;
}

function isTransportPayload(content: string) {
  if (/^\[broadcast:\[#?[a-z0-9]+]]\s*\{/i.test(content)) return true;
  if (content.length < 500) return false;
  if (/"route"\s*:/.test(content) && /"payload"\s*:/.test(content)) return true;
  if (/"type"\s*:\s*"ar_profile"/.test(content) && /"payload"\s*:/.test(content)) return true;
  return /[A-Za-z0-9+/=_-]{420,}/.test(content) && /"payload"\s*:/.test(content);
}

function containsBlockedPhrase(text: string, phrase: string) {
  const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function hasHashtag(text: string, tag: string) {
  return new RegExp(`(^|\\s)#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}

export function dedupeEvents(events: NostrEvent[]) {
  const output: NostrEvent[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    output.push(event);
  }
  return output.sort((a, b) => b.created_at - a.created_at);
}

export function limitConsecutiveAuthors(events: NostrEvent[], maxConsecutive = 2) {
  const output: NostrEvent[] = [];
  const deferred: NostrEvent[] = [];
  let lastPubkey = '';
  let streak = 0;

  for (const event of events) {
    if (event.pubkey === lastPubkey && streak >= maxConsecutive) {
      deferred.push(event);
      continue;
    }

    output.push(event);
    streak = event.pubkey === lastPubkey ? streak + 1 : 1;
    lastPubkey = event.pubkey;
    flushDeferred(output, deferred, maxConsecutive);
  }

  return output;
}

export function limitCryptoTopicDensity(events: NostrEvent[], minGap = 10) {
  const output: NostrEvent[] = [];
  let postsSinceCryptoTopic = minGap;

  for (const event of events) {
    if (isCryptoTopicEvent(event)) {
      if (postsSinceCryptoTopic < minGap) continue;
      postsSinceCryptoTopic = 0;
    } else {
      postsSinceCryptoTopic += 1;
    }
    output.push(event);
  }

  return output;
}

function isCryptoTopicEvent(event: NostrEvent) {
  const text = event.content.toLowerCase();
  const limitedTopics = ['crypto', 'bitcoin', 'fintech', 'node', 'z-cash', 'zacsh', 'monero'];
  if (limitedTopics.some((topic) => containsBlockedPhrase(text, topic))) return true;
  return event.tags.some((tag) => tag[0] === 't' && tag[1] && limitedTopics.includes(tag[1].replace(/^#/, '').toLowerCase()));
}

function flushDeferred(output: NostrEvent[], deferred: NostrEvent[], maxConsecutive: number) {
  let changed = true;
  while (changed && deferred.length) {
    changed = false;
    const last = output.at(-1);
    const streak = trailingAuthorStreak(output);
    const index = deferred.findIndex((event) => event.pubkey !== last?.pubkey || streak < maxConsecutive);
    if (index >= 0) {
      output.push(...deferred.splice(index, 1));
      changed = true;
    }
  }
}

function trailingAuthorStreak(events: NostrEvent[]) {
  const last = events.at(-1);
  if (!last) return 0;
  let count = 0;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].pubkey !== last.pubkey) break;
    count += 1;
  }
  return count;
}

export function verifiedRelayEvents(events: NostrEvent[]) {
  return events.filter((event) => verifyEvent(event as NostrToolsEvent) && !isExpiredEvent(event));
}

export function isExpiredEvent(event: NostrEvent, now = Math.floor(Date.now() / 1000)) {
  const expiration = event.tags.find((tag) => tag[0] === 'expiration' && tag[1])?.[1];
  return Boolean(expiration && Number(expiration) <= now);
}

export function feedFiltersForMode(
  mode: FeedMode,
  base: Filter,
  follows: string[] = [],
  settings: CustomFeedSettings = { friendsOfFriends: true, keywords: [], interests: [] },
  since: number,
  relayUrls: string[] = [],
  options: FeedQueryOptions = {}
) {
  const tag = normalizedHashtag(options.hashtag);
  const taggedBase = tag ? { ...base, '#t': [tag] } : base;
  if (mode === 'follow' && follows.length) return [{ ...taggedBase, authors: follows, since }];
  if (mode === 'custom' && follows.length) return customFeedFilters(taggedBase, follows, settings, since, relayUrls);
  if (mode === 'global' && hashtagKeywords(settings).length) return globalFeedFilters(taggedBase, settings, since);
  return [{ ...taggedBase, since }];
}

export async function fetchFeed(
  mode: FeedMode,
  relays = defaultRelays,
  follows: string[] = [],
  settings: CustomFeedSettings = { friendsOfFriends: true, keywords: [], interests: [] },
  options: FeedQueryOptions = {}
) {
  if ((mode === 'follow' || mode === 'custom') && !follows.length) return [];

  const relayUrls = activeRelayUrls(relays, 'read');
  const base: Filter = { kinds: [1], limit: options.limit ?? 24 };
  const since = options.since ?? Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
  if (options.until) base.until = options.until;
  const filters = await feedFiltersForMode(mode, base, follows, settings, since, relayUrls, options);

  const events = verifiedRelayEvents((await Promise.all(filters.map((filter) => queryShortLived(relayUrls, filter, 5000)))).flat());
  const clean = dedupeEvents(topLevelFeedEvents(filterSpam(events)));
  const output = mode === 'global' ? limitCryptoTopicDensity(limitConsecutiveAuthors(clean, 2), 10) : clean;
  await cacheEvents(output);
  return output;
}

export async function subscribeFeed(
  mode: FeedMode,
  relays = defaultRelays,
  follows: string[] = [],
  settings: CustomFeedSettings = { friendsOfFriends: true, keywords: [], interests: [] },
  options: FeedQueryOptions = {},
  onEvent: (event: NostrEvent) => void
) {
  if ((mode === 'follow' || mode === 'custom') && !follows.length) return undefined;

  const relayUrls = activeRelayUrls(relays, 'read');
  if (!relayUrls.length) return undefined;

  const base: Filter = { kinds: [1] };
  const since = options.since ?? Math.floor(Date.now() / 1000);
  const filters = await feedFiltersForMode(mode, base, follows, settings, since, relayUrls, options);
  const requests = filters.flatMap((filter) => relayUrls.map((url) => ({ url, filter })));

  return pool.subscribeMap(requests, {
    label: 'main-feed-live',
    onevent(event) {
      const [clean] = topLevelFeedEvents(filterSpam(verifiedRelayEvents([event as NostrEvent])));
      if (clean) {
        void cacheEvents([clean]);
        onEvent(clean);
      }
    }
  });
}

export async function subscribeEventStats(ids: string[], relays = defaultRelays, onEvent: (event: NostrEvent) => void) {
  const cleanIds = [...new Set(ids)].filter((id) => /^[0-9a-f]{64}$/i.test(id)).slice(0, 80);
  if (!cleanIds.length) return undefined;

  const relayUrls = activeRelayUrls(relays, 'read');
  if (!relayUrls.length) return undefined;

  const filter: Filter = { kinds: [1, 6, 7, 16, 9735], '#e': cleanIds, since: Math.floor(Date.now() / 1000) };
  return pool.subscribeMany(relayUrls, filter, {
    label: 'visible-note-stats',
    onevent(event) {
      const [clean] = verifiedRelayEvents([event as NostrEvent]);
      if (clean) onEvent(clean);
    }
  });
}

export async function subscribeZapReceipts(invoice: string, recipientPubkey: string, relays = defaultRelays, onEvent: (event: NostrEvent) => void) {
  const relayUrls = activeRelayUrls(relays, 'read');
  if (!relayUrls.length || !invoice || !/^[0-9a-f]{64}$/i.test(recipientPubkey)) return undefined;

  const filter: Filter = { kinds: [9735], '#p': [recipientPubkey], since: Math.floor(Date.now() / 1000) - 10 };
  return pool.subscribeMany(relayUrls, filter, {
    label: 'zap-receipts',
    onevent(event) {
      const [clean] = verifiedRelayEvents([event as NostrEvent]);
      const bolt11 = clean?.tags.find((tag) => tag[0] === 'bolt11')?.[1];
      if (clean && bolt11?.toLowerCase() === invoice.toLowerCase()) onEvent(clean);
    }
  });
}

export async function fetchMissingEvents(ids: string[], relays = defaultRelays) {
  if (!ids.length) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, { ids }, 5000));
  const clean = dedupeEvents(events);
  await cacheEvents(clean);
  return clean;
}

export async function fetchThreadReplies(rootId: string | string[], relays = defaultRelays, limit = 80) {
  const ids = (Array.isArray(rootId) ? rootId : [rootId]).filter((id) => /^[0-9a-f]{64}$/i.test(id));
  if (!ids.length) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [1], '#e': ids, limit }, 5000));
  const clean = dedupeEvents(filterSpam(events));
  await cacheEvents(clean);
  return clean;
}

export async function fetchProfileEvents(pubkey: string, relays = defaultRelays, limit = 36, options: Pick<FeedQueryOptions, 'until' | 'since'> = {}) {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const filter: Filter = { kinds: [1, 6], authors: [pubkey], limit };
  if (options.until) filter.until = options.until;
  if (options.since) filter.since = options.since;
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, filter, 5000));
  const clean = dedupeEvents([...filterSpam(events.filter((event) => event.kind !== 6)), ...events.filter((event) => event.kind === 6 && parseRepostContent(event))]);
  await cacheProfileEvents(clean);
  return clean;
}

export function parseRepostContent(event: NostrEvent) {
  if (event.kind !== 6 || !event.content.trim()) return null;
  try {
    const reposted = JSON.parse(event.content) as NostrEvent;
    return reposted?.kind === 1 && /^[0-9a-f]{64}$/i.test(reposted.id) ? reposted : null;
  } catch {
    return null;
  }
}

export async function fetchLikeAuthors(eventId: string, relays = defaultRelays, limit = 32) {
  if (!/^[0-9a-f]{64}$/i.test(eventId)) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const reactions = dedupeEvents(verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [7], '#e': [eventId], limit }, 4000)));
  return [
    ...new Set(
      reactions
        .filter((event) => {
          const reaction = event.content.trim();
          return reactionTargetId(event) === eventId && (!reaction || reaction === '+');
        })
        .map((event) => event.pubkey)
    )
  ];
}

export async function fetchProfiles(pubkeys: string[], relays = defaultRelays) {
  if (!pubkeys.length) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [0], authors: pubkeys, limit: pubkeys.length }, 4000));
  const profiles = parseProfileEvents(events);
  await Promise.all(profiles.map(cacheProfile));
  return profiles;
}

export async function searchProfiles(query: string, relays = defaultRelays) {
  const search = query.trim().replace(/^@/, '');
  if (search.length < 2) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [0], search, limit: 12 }, 4000));
  const profiles = parseProfileEvents(events);
  await Promise.all(profiles.map(cacheProfile));
  return profiles;
}

export async function resolvePubkeyIdentifier(value: string, relays = defaultRelays) {
  const clean = value.trim().replace(/^@/, '');
  if (/^[0-9a-f]{64}$/i.test(clean)) return clean.toLowerCase();

  if (/^(npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+$/i.test(clean)) {
    const decoded = nip19.decode(clean);
    if (decoded.type === 'npub') return decoded.data;
    if (decoded.type === 'nprofile') return decoded.data.pubkey;
  }

  if (clean.includes('@')) return (await resolveNip05Profile(clean))?.pubkey ?? '';
  return '';
}

export async function fetchDirectMessages(session: Session, relays = defaultRelays) {
  const relayUrls = activeRelayUrls(relays, 'read');
  const incomingFilter: Filter = { kinds: [4], '#p': [session.pubkey], limit: 80 };
  const outgoingFilter: Filter = { kinds: [4], authors: [session.pubkey], limit: 80 };
  const nip17Filter: Filter = { kinds: [1059], '#p': [session.pubkey], limit: 80 };
  const events = verifiedRelayEvents(
    (await Promise.all([
      queryShortLived(relayUrls, incomingFilter, 5000),
      queryShortLived(relayUrls, outgoingFilter, 5000),
      queryShortLived(relayUrls, nip17Filter, 5000)
    ])).flat()
  );
  const messages = await Promise.all(
    dedupeEvents(events).map((event) => (event.kind === 1059 ? toNip17DirectMessage(event, session) : toNip04DirectMessage(event, session)))
  );
  return messages.filter((message): message is DirectMessage => Boolean(message));
}

export async function subscribeDirectMessages(session: Session, relays = defaultRelays, onMessage: (message: DirectMessage) => void) {
  const relayUrls = activeRelayUrls(relays, 'read');
  if (!relayUrls.length) return undefined;

  const since = Math.floor(Date.now() / 1000) - 10;
  const filters: Filter[] = [
    { kinds: [4], '#p': [session.pubkey], since },
    { kinds: [4], authors: [session.pubkey], since },
    { kinds: [1059], '#p': [session.pubkey], since }
  ];

  const requests = filters.flatMap((filter) => relayUrls.map((url) => ({ url, filter })));
  return pool.subscribeMap(requests, {
    label: 'direct-messages-live',
    async onevent(event) {
      const [clean] = verifiedRelayEvents([event as NostrEvent]);
      if (!clean) return;
      const message = clean.kind === 1059 ? await toNip17DirectMessage(clean, session) : await toNip04DirectMessage(clean, session);
      if (message) onMessage(message);
    }
  });
}

export async function fetchEventStats(ids: string[], relays = defaultRelays) {
  const uniqueIds = [...new Set(ids)].filter(Boolean).slice(0, 80);
  const emptyStats = () => ({ replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 });
  const stats: Record<string, EventStats> = Object.fromEntries(uniqueIds.map((id) => [id, emptyStats()]));
  if (!uniqueIds.length) return stats;

  const relayUrls = activeRelayUrls(relays, 'read');
  const filters: Filter[] = [
    { kinds: [1], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) },
    { kinds: [6, 16], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) },
    { kinds: [7], '#e': uniqueIds, limit: Math.min(800, uniqueIds.length * 35) },
    { kinds: [9735], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) }
  ];
  const countStats: Record<string, Partial<EventStats>> = await fetchCountStats(uniqueIds, relayUrls).catch(() => ({}));
  const events = dedupeEvents(verifiedRelayEvents((await Promise.all(filters.map((filter) => queryShortLived(relayUrls, filter, 4500)))).flat()));

  const eventStats = eventStatsFromEvents(uniqueIds, events);
  for (const id of uniqueIds) {
    const fromEvents = eventStats[id] ?? emptyStats();
    const fromCount = countStats[id];
    stats[id] = {
      replies: Math.max(fromEvents.replies, fromCount?.replies ?? 0),
      reposts: Math.max(fromEvents.reposts, fromCount?.reposts ?? 0),
      likes: Math.max(fromEvents.likes, fromCount?.likes ?? 0),
      zaps: Math.max(fromEvents.zaps, fromCount?.zaps ?? 0),
      zapSats: fromEvents.zapSats,
      dislikes: fromEvents.dislikes,
      emoji: fromEvents.emoji
    };
  }

  return stats;
}

export function eventStatsFromEvents(ids: string[], events: NostrEvent[]) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const emptyStats = () => ({ replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 });
  const stats: Record<string, EventStats> = Object.fromEntries(uniqueIds.map((id) => [id, emptyStats()]));
  const seen = {
    replies: new Set<string>(),
    reposts: new Set<string>(),
    likes: new Set<string>(),
    zaps: new Set<string>()
  };

  for (const event of events) {
    for (const id of statTargetIds(event, uniqueIds)) {
      if (!stats[id]) continue;
      if (event.kind === 1 && !seen.replies.has(`${id}:${event.id}`)) {
        seen.replies.add(`${id}:${event.id}`);
        stats[id].replies += 1;
      } else if ((event.kind === 6 || event.kind === 16) && !seen.reposts.has(`${id}:${event.id}`)) {
        seen.reposts.add(`${id}:${event.id}`);
        stats[id].reposts += 1;
      } else if (event.kind === 7 && !seen.likes.has(`${id}:${event.pubkey}`)) {
        seen.likes.add(`${id}:${event.pubkey}`);
        const reaction = event.content.trim();
        if (!reaction || reaction === '+') stats[id].likes += 1;
        else if (reaction === '-') stats[id].dislikes += 1;
        else stats[id].emoji += 1;
      } else if (event.kind === 9735) {
        const bolt11 = event.tags.find((tag) => tag[0] === 'bolt11')?.[1] ?? event.id;
        if (!seen.zaps.has(`${id}:${bolt11}`)) {
          seen.zaps.add(`${id}:${bolt11}`);
          stats[id].zaps += 1;
          stats[id].zapSats += zapReceiptAmountSats(event);
        }
      }
    }
  }

  return stats;
}

export async function fetchNotifications(pubkey: string, relays = defaultRelays, limit = 80) {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const ownPosts = topLevelFeedEvents(
    filterSpam(verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [1], authors: [pubkey], limit: Math.min(limit, 80) }, 4500)))
  );
  const ownPostIds = ownPosts.map((event) => event.id);
  const ownPostById = new Map(ownPosts.map((event) => [event.id, event]));

  const filters: Filter[] = [
    { kinds: [1], '#p': [pubkey], limit },
    { kinds: [3], '#p': [pubkey], limit }
  ];
  if (ownPostIds.length) {
    filters.push({ kinds: [7], '#e': ownPostIds, limit: Math.min(240, ownPostIds.length * 12) });
    filters.push({ kinds: [6, 16], '#e': ownPostIds, limit: Math.min(180, ownPostIds.length * 8) });
  }

  const events = dedupeEvents(verifiedRelayEvents((await Promise.all(filters.map((filter) => queryShortLived(relayUrls, filter, 5000)))).flat()));
  const notifications = events.flatMap((event) => notificationForEvent(event, pubkey, ownPostById));
  await cacheEvents([...ownPosts, ...events.filter((event) => event.kind !== 3)]);
  return dedupeNotifications(notifications).slice(0, limit);
}

export async function subscribeNotifications(pubkey: string, relays = defaultRelays, onNotifications: (items: NotificationItem[]) => void, limit = 80) {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return undefined;
  const relayUrls = activeRelayUrls(relays, 'read');
  if (!relayUrls.length) return undefined;

  const since = Math.floor(Date.now() / 1000) - 10;
  const ownPosts = topLevelFeedEvents(
    filterSpam(verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [1], authors: [pubkey], limit: Math.min(limit, 80) }, 4500)))
  );
  const ownPostById = new Map(ownPosts.map((event) => [event.id, event]));
  const filters: Filter[] = [
    { kinds: [1], '#p': [pubkey], since },
    { kinds: [3], '#p': [pubkey], since }
  ];
  const ownPostIds = ownPosts.map((event) => event.id);
  if (ownPostIds.length) {
    filters.push({ kinds: [7], '#e': ownPostIds, since });
    filters.push({ kinds: [6, 16], '#e': ownPostIds, since });
  }

  const requests = filters.flatMap((filter) => relayUrls.map((url) => ({ url, filter })));
  return pool.subscribeMap(requests, {
    label: 'notifications-live',
    onevent(event) {
      const [clean] = verifiedRelayEvents([event as NostrEvent]);
      if (!clean) return;
      const next = notificationForEvent(clean, pubkey, ownPostById);
      if (next.length) onNotifications(next);
    }
  });
}

function notificationForEvent(event: NostrEvent, pubkey: string, ownPostById: Map<string, NostrEvent>): NotificationItem[] {
  if (event.pubkey === pubkey) return [];
  if (event.kind === 1) {
    const mentionsMe = event.tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey);
    if (!mentionsMe || !filterSpam([event]).length) return [];
    const type = isReplyEvent(event) ? 'reply' : 'mention';
    const targetId = type === 'reply' ? threadRootOrParentId(event) || event.id : event.id;
    return [{ id: `${type}:${event.id}`, type, event, targetId, targetEvent: ownPostById.get(targetId), seen: false }];
  }
  if (event.kind === 7) {
    const targetId = reactionTargetId(event);
    if (!targetId || !ownPostById.has(targetId)) return [];
    const reaction = event.content.trim();
    if (reaction && reaction !== '+') return [];
    return [{ id: `like:${event.id}`, type: 'like', event, targetId, targetEvent: ownPostById.get(targetId), seen: false }];
  }
  if (event.kind === 6 || event.kind === 16) {
    const targetId = firstReferencedEventId(event, ownPostById);
    if (!targetId) return [];
    return [{ id: `repost:${event.id}`, type: 'repost', event, targetId, targetEvent: ownPostById.get(targetId), seen: false }];
  }
  if (event.kind === 3 && extractContactListDetails(event).pubkeys.includes(pubkey)) {
    return [{ id: `follow:${event.id}:${event.pubkey}`, type: 'follow', event, seen: false }];
  }
  return [];
}

function firstReferencedEventId(event: NostrEvent, eventsById: Map<string, NostrEvent>) {
  return event.tags.find((tag) => tag[0] === 'e' && tag[1] && eventsById.has(tag[1]))?.[1] ?? '';
}

function threadRootOrParentId(event: NostrEvent) {
  const rootTag = event.tags.find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'root');
  if (rootTag?.[1]) return rootTag[1];

  const replyTag = [...event.tags].reverse().find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'reply');
  if (replyTag?.[1]) return replyTag[1];

  return event.tags.find((tag) => tag[0] === 'e' && tag[1])?.[1] ?? '';
}

function dedupeNotifications(items: NotificationItem[]) {
  const byId = new Map<string, NotificationItem>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.event.created_at - a.event.created_at);
}

export async function fetchContactList(pubkey: string, relays = defaultRelays) {
  return (await fetchContactListDetails(pubkey, relays)).pubkeys;
}

export async function fetchContactListDetails(pubkey: string, relays = defaultRelays): Promise<ContactListDetails> {
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [3], authors: [pubkey], limit: 1 }, 4000)).sort(
    (a, b) => b.created_at - a.created_at
  );
  return extractContactListDetails(events[0]);
}

export async function fetchMuteList(pubkey: string, relays = defaultRelays) {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const [event] = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [10000], authors: [pubkey], limit: 1 }, 4000)).sort(
    (a, b) => b.created_at - a.created_at
  );
  return extractMutePubkeys(event);
}

export async function fetchRelayListMetadata(pubkey: string, relays = defaultRelays) {
  const relayUrls = activeRelayUrls(relays, 'read');
  const [event] = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [10002], authors: [pubkey], limit: 1 }, 4000)).sort(
    (a, b) => b.created_at - a.created_at
  );
  if (!event) return [];
  return event.tags
    .filter((tag) => tag[0] === 'r' && tag[1])
    .flatMap((tag) => sanitizeRelayHints([tag[1]]).map((url) => ({ url, marker: tag[2] === 'read' || tag[2] === 'write' ? tag[2] : undefined })));
}

export async function fetchRelayInfoDocuments(relays = defaultRelays) {
  return Promise.all(
    relays
      .filter((relay) => relay.enabled)
      .map(async (relay) => {
        const httpUrl = relay.url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
        const response = await fetch(httpUrl, { headers: { accept: 'application/nostr+json' } });
        if (!response.ok) return relay;
        const info = (await response.json()) as { supported_nips?: number[]; limitation?: Record<string, unknown> };
        return { ...relay, supportedNips: info.supported_nips, limitation: info.limitation };
      })
  );
}

export async function resolveNip05(identifier = defaultGuestNip05) {
  return (await resolveNip05Profile(identifier))?.pubkey ?? null;
}

export async function resolveNip05Profile(identifier = defaultGuestNip05): Promise<Nip05Profile | null> {
  const [name, domain] = identifier.toLowerCase().split('@');
  if (!name || !domain) return null;
  const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { names?: Record<string, string>; relays?: Record<string, string[]> };
  const pubkey = data.names?.[name];
  if (!pubkey) return null;
  return {
    pubkey,
    relayHints: sanitizeRelayHints(data.relays?.[pubkey] ?? [])
  };
}

export function parseProfileEvents(events: NostrEvent[]) {
  const byPubkey = new Map<string, Profile>();
  for (const event of events) {
    try {
      const profile = JSON.parse(event.content) as Profile;
      const existing = byPubkey.get(event.pubkey);
      if (!existing || (existing.updated_at ?? 0) < event.created_at) {
        byPubkey.set(event.pubkey, { ...profile, pubkey: event.pubkey, updated_at: event.created_at });
      }
    } catch {
      // Ignore malformed profile metadata.
    }
  }
  return [...byPubkey.values()];
}

export async function publishReaction(session: Session, target: NostrEvent, relays = defaultRelays, content = '+') {
  return publishEventTemplate(session, { kind: 7, content, tags: [['e', target.id, '', target.pubkey], ['p', target.pubkey], ['k', String(target.kind)]], created_at: now() }, relays);
}

export async function publishRepost(session: Session, target: NostrEvent, relays = defaultRelays) {
  return publishEventTemplate(
    session,
    { kind: target.kind === 1 ? 6 : 16, content: target.kind === 1 ? JSON.stringify(target) : '', tags: [['e', target.id, '', target.pubkey], ['p', target.pubkey], ['k', String(target.kind)]], created_at: now() },
    relays
  );
}

export async function publishReport(session: Session, target: NostrEvent, relays = defaultRelays, reportType = 'spam', content = '') {
  return publishEventTemplate(session, { kind: 1984, content, tags: [['e', target.id, reportType], ['p', target.pubkey, reportType]], created_at: now() }, relays);
}

export async function publishDeletion(session: Session, target: NostrEvent, relays = defaultRelays, reason = 'Edited by author') {
  if (target.pubkey !== session.pubkey) throw new Error('You can only delete your own events.');
  return publishEventTemplate(session, { kind: 5, content: reason, tags: [['e', target.id], ['k', String(target.kind)]], created_at: now() }, relays);
}

async function toNip04DirectMessage(event: NostrEvent, session: Session): Promise<DirectMessage> {
  const recipient = event.tags.find((tag) => tag[0] === 'p' && tag[1])?.[1] ?? '';
  const isOutgoing = event.pubkey === session.pubkey;
  const peer = isOutgoing ? recipient : event.pubkey;
  return {
    id: event.id,
    protocol: 'NIP-04',
    peer,
    from: event.pubkey,
    to: recipient,
    created_at: event.created_at,
    encrypted: event.content,
    content: await decryptNip04(session, peer, event.content).catch(() => undefined)
  };
}

async function toNip17DirectMessage(event: NostrEvent, session: Session): Promise<DirectMessage | null> {
  const rumor = await unwrapNip17Event(event, session).catch(() => null);
  if (!rumor || rumor.kind !== 14) return null;
  const recipients = rumor.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]);
  const isOutgoing = rumor.pubkey === session.pubkey;
  const peer = isOutgoing ? (recipients.find((pubkey) => pubkey !== session.pubkey) ?? recipients[0] ?? '') : rumor.pubkey;
  if (!peer) return null;

  return {
    id: event.id,
    protocol: 'NIP-17',
    peer,
    from: rumor.pubkey,
    to: recipients.join(','),
    created_at: rumor.created_at,
    encrypted: event.content,
    content: rumor.content
  };
}

export function canDecryptNip04(session: Session) {
  return session.mode === 'private-key' || isRemoteSignerSession(session) || Boolean(typeof window !== 'undefined' && window.nostr?.nip04);
}

async function decryptNip04(session: Session, peer: string, ciphertext: string) {
  if (!peer) return undefined;
  if (session.secret) return nip04.decrypt(hexToBytes(session.secret), peer, ciphertext);
  if (typeof window !== 'undefined' && session.mode === 'nip07' && window.nostr?.nip04) return window.nostr.nip04.decrypt(peer, ciphertext);
  if (isRemoteSignerSession(session)) return getBunkerSigner(session).nip04Decrypt(peer, ciphertext);
  return undefined;
}

async function unwrapNip17Event(event: NostrEvent, session: Session) {
  if (session.secret) return nip17.unwrapEvent(event as NostrToolsEvent, hexToBytes(session.secret)) as NostrEvent;
  const seal = (await decryptNip44(session, event.pubkey, event.content)) as NostrEvent;
  if (!seal || seal.kind !== 13 || !verifyEvent(seal as NostrToolsEvent)) throw new Error('Invalid NIP-17 seal.');
  const rumor = (await decryptNip44(session, seal.pubkey, seal.content)) as NostrEvent;
  if (!rumor || rumor.pubkey !== seal.pubkey) throw new Error('Invalid NIP-17 rumor.');
  return rumor;
}

async function decryptNip44(session: Session, peer: string, ciphertext: string) {
  let plaintext: string | undefined;
  if (typeof window !== 'undefined' && session.mode === 'nip07' && window.nostr?.nip44) plaintext = await window.nostr.nip44.decrypt(peer, ciphertext);
  if (isRemoteSignerSession(session)) plaintext = await getBunkerSigner(session).nip44Decrypt(peer, ciphertext);
  if (!plaintext) throw new Error('NIP-44 decrypt is not available for this session.');
  return JSON.parse(plaintext) as unknown;
}

async function encryptNip44(session: Session, peer: string, payload: unknown) {
  const plaintext = JSON.stringify(payload);
  if (session.secret) return nip44.encrypt(plaintext, nip44.getConversationKey(hexToBytes(session.secret), peer));
  if (typeof window !== 'undefined' && session.mode === 'nip07' && window.nostr?.nip44) return window.nostr.nip44.encrypt(peer, plaintext);
  if (isRemoteSignerSession(session)) return getBunkerSigner(session).nip44Encrypt(peer, plaintext);
  throw new Error('NIP-44 encrypt is not available for this session.');
}

export async function publishNote(session: Session, content: string, relays = defaultRelays, tags: string[][] = []) {
  const draft = await signEventTemplate(session, { kind: 1, content, tags, created_at: now() });
  void cacheEvents([draft as unknown as NostrEvent]);
  await publishSignedEvent(draft, relays);
  return draft as unknown as NostrEvent;
}

export async function publishProfile(session: Session, profile: Profile, relays = defaultRelays) {
  const metadata = compactProfile(profile);
  const event = await publishEventTemplate(session, { kind: 0, content: JSON.stringify(metadata), tags: [], created_at: now() }, relays);
  const savedProfile = { ...metadata, pubkey: session.pubkey, updated_at: event.created_at };
  await cacheProfile(savedProfile);
  return { event, profile: savedProfile };
}

export async function publishContactList(session: Session, pubkeys: string[], relays = defaultRelays, contacts: ContactListItem[] = [], profileMap: Record<string, Profile> = {}) {
  const byPubkey = new Map(contacts.map((contact) => [contact.pubkey, contact]));
  const tags = [...new Set(pubkeys)].map((pubkey) => {
    const contact = byPubkey.get(pubkey);
    const petname = contact?.petname || profileMap[pubkey]?.name || profileMap[pubkey]?.display_name || '';
    return ['p', pubkey, contact?.relay ?? '', petname];
  });
  return publishEventTemplate(session, { kind: 3, content: '', tags, created_at: now() }, relays);
}

export async function publishMuteList(session: Session, pubkeys: string[], relays = defaultRelays) {
  const tags = [...new Set(pubkeys)].filter((pubkey) => /^[0-9a-f]{64}$/i.test(pubkey) && pubkey !== session.pubkey).map((pubkey) => ['p', pubkey]);
  return publishEventTemplate(session, { kind: 10000, content: '', tags, created_at: now() }, relays);
}

export async function publishRelayListMetadata(session: Session, relays = defaultRelays) {
  const tags = relays
    .filter((relay) => relay.enabled)
    .flatMap((relay) => (relay.read && relay.write ? [['r', relay.url]] : relay.read ? [['r', relay.url, 'read']] : relay.write ? [['r', relay.url, 'write']] : []));
  return publishEventTemplate(session, { kind: 10002, content: '', tags, created_at: now() }, relays);
}

export async function publishNip17DirectMessage(session: Session, recipientPubkey: string, content: string, relays = defaultRelays, subject = '') {
  if (!/^[0-9a-f]{64}$/i.test(recipientPubkey)) throw new Error('Recipient public key is invalid.');
  const recipientRelays = await fetchNip17InboxRelays(recipientPubkey, relays);
  const recipient = { publicKey: recipientPubkey, relayUrl: recipientRelays[0] };
  const wraps = await wrapNip17DirectMessage(session, recipient, content, subject);
  const publishUrls = [...new Set([...recipientRelays, ...activeRelayUrls(relays, 'write')])];
  if (!publishUrls.length) throw new Error('No relays are available for NIP-17 message publishing.');
  await Promise.any(wraps.map((event) => Promise.any(pool.publish(publishUrls, event))));
  return wraps as unknown as NostrEvent[];
}

export async function getNip98AuthorizationHeader(session: Session, url: string, method: string) {
  return nip98.getToken(url, method, (draft) => signEventTemplate(session, draft), true);
}

async function wrapNip17DirectMessage(session: Session, recipient: { publicKey: string; relayUrl?: string }, content: string, subject = '') {
  const recipients = [recipient, { publicKey: session.pubkey }];
  return Promise.all(
    recipients.map(async (target) => {
      const rumor = createNip17Rumor(session.pubkey, [recipient], content, subject);
      const seal = await signEventTemplate(session, {
        kind: 13,
        content: await encryptNip44(session, target.publicKey, rumor),
        created_at: session.mode === 'pomegranate' ? now() : randomPastNow(),
        tags: []
      });
      const randomKey = generateSecretKey();
      return finalizeEvent(
        {
          kind: 1059,
          content: nip44.encrypt(JSON.stringify(seal), nip44.getConversationKey(randomKey, target.publicKey)),
          created_at: randomPastNow(),
          tags: [['p', target.publicKey]]
        },
        randomKey
      );
    })
  );
}

function createNip17Rumor(senderPubkey: string, recipients: { publicKey: string; relayUrl?: string }[], content: string, subject = '') {
  const rumor = {
    pubkey: senderPubkey,
    created_at: now(),
    kind: 14,
    tags: [
      ...recipients.map((recipient) => (recipient.relayUrl ? ['p', recipient.publicKey, recipient.relayUrl] : ['p', recipient.publicKey])),
      ...(subject.trim() ? [['subject', subject.trim()]] : [])
    ],
    content
  };
  return { ...rumor, id: getEventHash(rumor) };
}

async function publishEventTemplate(session: Session, draft: Pick<NostrToolsEvent, 'kind' | 'content' | 'tags' | 'created_at'>, relays = defaultRelays) {
  const event = await signEventTemplate(session, draft);
  await publishSignedEvent(event, relays);
  return event as unknown as NostrEvent;
}

async function publishSignedEvent(event: NostrToolsEvent, relays = defaultRelays) {
  const urls = activeRelayUrls(relays, 'write');
  if (!urls.length) throw new Error('No write relays are enabled.');
  await Promise.any(pool.publish(urls, event));
}

export async function signEventTemplate(session: Session, draft: Pick<NostrToolsEvent, 'kind' | 'content' | 'tags' | 'created_at'>) {
  assertNoSessionSecretLeak(session, draft);
  let event: NostrToolsEvent;
  if (session.mode === 'nip07' && window.nostr) {
    event = (await window.nostr.signEvent({ ...draft, pubkey: session.pubkey })) as unknown as NostrToolsEvent;
  } else if (session.secret) {
    event = finalizeEvent(draft, hexToBytes(session.secret));
  } else if (isRemoteSignerSession(session)) {
    event = (await getBunkerSigner(session).signEvent(draft)) as NostrToolsEvent;
  } else {
    throw new Error('No signer is available for this session.');
  }

  return event;
}

function assertNoSessionSecretLeak(session: Session, draft: Pick<NostrToolsEvent, 'content' | 'tags'>) {
  const serializedDraft = JSON.stringify({ content: draft.content, tags: draft.tags });
  const leaked = sessionSecretValues(session).find((value) => serializedDraft.includes(value));
  if (leaked) throw new Error('Refusing to publish because the event contains private signing material.');
  if (containsNsec(serializedDraft)) throw new Error('Refusing to publish because the event contains an nsec private key.');
}

function sessionSecretValues(session: Session) {
  return [session.secret, session.secret ? nip19.nsecEncode(hexToBytes(session.secret)) : '', session.bunkerClientSecret, session.bunkerSecret ?? ''].filter(
    (value): value is string => typeof value === 'string' && value.length >= 12
  );
}

function containsNsec(value: string) {
  return /nsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}/i.test(value);
}

function isRemoteSignerSession(session: Session) {
  return session.mode === 'bunker' || session.mode === 'pomegranate';
}

function getBunkerSigner(session: Session) {
  if (!session.bunkerClientSecret || !session.bunkerRemotePubkey || !session.bunkerRelays?.length) throw new Error('Bunker session is missing connection details.');
  const key = bunkerSignerKey(session);
  const existing = bunkerSigners.get(key);
  if (existing) return existing;
  const pointer: nip46.BunkerPointer = {
    pubkey: session.bunkerRemotePubkey,
    relays: session.bunkerRelays,
    secret: session.bunkerSecret ?? null
  };
  const signer = nip46.BunkerSigner.fromBunker(hexToBytes(session.bunkerClientSecret), pointer, {
    pool,
    onauth: (url: string) => {
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
  bunkerSigners.set(key, signer);
  return signer;
}

function bunkerSignerKey(session: Session) {
  return `${session.bunker ?? ''}:${session.bunkerClientSecret ?? ''}`;
}

function decodeNsec(value: string) {
  const decoded = nip19.decode(value);
  if (decoded.type !== 'nsec') throw new Error('Expected an nsec private key.');
  return decoded.data;
}

function sampleAuthors(follows: string[], count: number) {
  if (count >= follows.length) return follows;
  return [...follows].sort(() => Math.random() - 0.5).slice(0, count);
}

function normalizedHashtag(tag?: string) {
  const clean = tag?.trim().replace(/^#/, '').toLowerCase();
  return clean && /^[a-z0-9_]{2,64}$/.test(clean) ? clean : '';
}

async function customFeedFilters(base: Filter, follows: string[], settings: CustomFeedSettings, since: number, relayUrls: string[]) {
  const total = base.limit ?? 24;
  const feedHashtags = hashtagKeywords(settings);
  const hashtagLimit = feedHashtags.length ? Math.max(1, Math.round(total * 0.2)) : 0;
  const friendsOfFriends = settings.friendsOfFriends ? await fetchFriendsOfFriends(follows, relayUrls) : [];
  const friendsOfFriendsLimit = friendsOfFriends.length ? Math.max(1, Math.round(total * 0.2)) : 0;
  const followLimit = Math.max(1, total - hashtagLimit - friendsOfFriendsLimit);
  const filters: Filter[] = [{ ...base, authors: sampleAuthors(follows, followLimit), limit: followLimit, since }];

  if (friendsOfFriendsLimit) {
    filters.push({ ...base, authors: sampleAuthors(friendsOfFriends, friendsOfFriendsLimit), limit: friendsOfFriendsLimit, since });
  }

  if (feedHashtags.length) filters.push({ ...base, '#t': feedHashtags, limit: hashtagLimit, since });
  return filters;
}

function globalFeedFilters(base: Filter, settings: CustomFeedSettings, since: number) {
  const total = base.limit ?? 24;
  const hashtagLimit = Math.max(1, Math.round(total * 0.3));
  const generalLimit = Math.max(1, total - hashtagLimit);
  const feedHashtags = hashtagKeywords(settings);
  return [
    { ...base, limit: generalLimit, since },
    { ...base, '#t': feedHashtags, limit: hashtagLimit, since }
  ];
}

function hashtagKeywords(settings: CustomFeedSettings) {
  return [...new Set(settings.keywords.map((keyword) => normalizedHashtag(keyword)).filter(Boolean))];
}

async function fetchFriendsOfFriends(follows: string[], relayUrls: string[]) {
  const contactEvents = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [3], authors: follows, limit: Math.min(120, follows.length) }, 4500));
  const directFollows = new Set(follows);
  const pubkeys = new Set<string>();
  for (const event of contactEvents) {
    for (const pubkey of extractContactListDetails(event).pubkeys) if (!directFollows.has(pubkey)) pubkeys.add(pubkey);
  }
  return [...pubkeys];
}

async function fetchNip17InboxRelays(pubkey: string, relays = defaultRelays) {
  const relayUrls = activeRelayUrls(relays, 'read');
  const [event] = verifiedRelayEvents(await queryShortLived(relayUrls, { kinds: [10050], authors: [pubkey], limit: 1 }, 4000)).sort(
    (a, b) => b.created_at - a.created_at
  );
  const inboxes = event?.tags.filter((tag) => tag[0] === 'relay' && tag[1]).flatMap((tag) => sanitizeRelayHints([tag[1]])) ?? [];
  return inboxes.length ? inboxes.slice(0, 3) : activeRelayUrls(relays, 'write');
}

export function extractContactListDetails(event?: NostrEvent): ContactListDetails {
  if (!event) return { pubkeys: [], relayHints: [], items: [] };
  const pubkeys = new Set<string>();
  const relayHints = new Set<string>();
  const items: ContactListItem[] = [];

  for (const tag of event.tags) {
    if (tag[0] !== 'p' || !tag[1]) continue;
    pubkeys.add(tag[1]);
    const [relay] = tag[2] ? sanitizeRelayHints([tag[2]]) : [];
    if (relay) relayHints.add(relay);
    items.push({ pubkey: tag[1], relay, petname: tag[3] });
  }

  return { pubkeys: [...pubkeys], relayHints: [...relayHints], items };
}

export function extractMutePubkeys(event?: NostrEvent) {
  if (!event) return [];
  return [...new Set(event.tags.filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/i.test(tag[1])).map((tag) => tag[1]))];
}

function sanitizeRelayHints(urls: string[]) {
  return [...new Set(urls.map(normalizeRelayUrl).filter(Boolean))];
}

function referencedEventIds(event: NostrEvent, ids: string[]) {
  const idSet = new Set(ids);
  return [...new Set(event.tags.flatMap((tag) => (tag[0] === 'e' && idSet.has(tag[1]) ? [tag[1]] : [])))];
}

function statTargetIds(event: NostrEvent, ids: string[]) {
  const idSet = new Set(ids);
  if (event.kind === 7) {
    const targetId = reactionTargetId(event);
    return targetId && idSet.has(targetId) ? [targetId] : [];
  }
  if (event.kind === 6 || event.kind === 16) {
    const targetId = event.tags.find((tag) => tag[0] === 'e' && idSet.has(tag[1]))?.[1] ?? '';
    return targetId ? [targetId] : [];
  }
  return referencedEventIds(event, ids);
}

function zapReceiptAmountSats(event: NostrEvent) {
  const description = event.tags.find((tag) => tag[0] === 'description')?.[1];
  if (!description) return 0;
  try {
    const request = JSON.parse(description) as Pick<NostrEvent, 'tags'>;
    const amountMsats = Number(request.tags?.find((tag) => tag[0] === 'amount')?.[1] ?? 0);
    return Number.isFinite(amountMsats) ? Math.floor(amountMsats / 1000) : 0;
  } catch {
    return 0;
  }
}

function reactionTargetId(event: NostrEvent) {
  const eTags = event.tags.filter((tag) => tag[0] === 'e' && tag[1]);
  return eTags.at(-1)?.[1] ?? '';
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function randomPastNow() {
  return Math.round(now() - Math.random() * 2 * 24 * 60 * 60);
}

async function fetchCountStats(ids: string[], relayUrls: string[]) {
  const entries = await Promise.all(ids.map(async (id) => [id, await countStatsForId(id, relayUrls)] as const));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, EventStats] => Boolean(entry[1])));
}

async function countStatsForId(id: string, relayUrls: string[]): Promise<EventStats | undefined> {
  const [replies, reposts, likes, zaps] = await Promise.all([
    relayCount(relayUrls, { kinds: [1], '#e': [id] }),
    relayCount(relayUrls, { kinds: [6, 16], '#e': [id] }),
    relayCount(relayUrls, { kinds: [7], '#e': [id] }),
    relayCount(relayUrls, { kinds: [9735], '#e': [id] })
  ]);
  if ([replies, reposts, likes, zaps].every((value) => value === undefined)) return undefined;
  return {
    replies: replies ?? 0,
    reposts: reposts ?? 0,
    likes: likes ?? 0,
    zaps: zaps ?? 0,
    zapSats: 0,
    dislikes: 0,
    emoji: 0
  };
}

async function relayCount(relayUrls: string[], filter: Filter) {
  const values = await Promise.all(relayUrls.slice(0, 4).map((url) => countOnRelay(url, filter).catch(() => undefined)));
  const counts = values.filter((value): value is number => typeof value === 'number');
  return counts.length ? Math.max(...counts) : undefined;
}

function countOnRelay(url: string, filter: Filter): Promise<number | undefined> {
  if (typeof WebSocket === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const id = `count-${Math.random().toString(16).slice(2)}`;
    const timeout = setTimeout(() => {
      ws.close();
      resolve(undefined);
    }, 1800);
    ws.onopen = () => ws.send(JSON.stringify(['COUNT', id, filter]));
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(undefined);
    };
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(String(message.data)) as unknown[];
        if (data[0] === 'COUNT' && data[1] === id && data[2] && typeof data[2] === 'object') {
          clearTimeout(timeout);
          ws.close();
          resolve(Number((data[2] as { count?: number }).count ?? 0));
        } else if (data[0] === 'CLOSED' && data[1] === id) {
          clearTimeout(timeout);
          ws.close();
          resolve(undefined);
        }
      } catch {
        // Ignore malformed relay frames.
      }
    };
  });
}

function compactProfile(profile: Profile): Omit<Profile, 'pubkey'> {
  return Object.fromEntries(
    Object.entries({
      name: profile.name,
      display_name: profile.display_name,
      about: profile.about,
      interests: profile.interests?.filter((interest) => interest.trim()),
      picture: profile.picture,
      banner: profile.banner,
      nip05: profile.nip05,
      lud16: profile.lud16,
      lud06: profile.lud06,
      website: profile.website
    }).filter(([, value]) => (typeof value === 'string' && value.trim()) || (Array.isArray(value) && value.length))
  ) as Omit<Profile, 'pubkey'>;
}
