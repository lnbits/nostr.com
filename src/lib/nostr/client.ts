import { finalizeEvent, generateSecretKey, getPublicKey, nip04, nip19, SimplePool } from 'nostr-tools';
import type { Event as NostrToolsEvent, Filter } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { cacheEvents, cacheProfile } from './cache';
import { adultDomains, adultHashtags, defaultGuestNip05, defaultRelays, mutedWords } from './config';
import type { ContactListDetails, CustomFeedSettings, DirectMessage, EventStats, FeedMode, Nip05Profile, NostrEvent, Profile, RelayState, Session } from './types';

const pool = new SimplePool();

export function activeRelayUrls(relays: RelayState[], intent: 'read' | 'write') {
  return relays
    .filter((relay) => relay.enabled && relay[intent])
    .sort((a, b) => b.score - a.score)
    .slice(0, intent === 'read' ? 8 : 3)
    .map((relay) => relay.url);
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

export function loginWithBunker(uri: string): Session {
  return { pubkey: uri.replace(/^bunker:\/\//, '').slice(0, 64), mode: 'bunker', bunker: uri };
}

export function filterSpam(events: NostrEvent[], mutedPubkeys = new Set<string>()) {
  return events.filter((event) => {
    if (mutedPubkeys.has(event.pubkey)) return false;
    if (isMachineGeneratedContent(event.content)) return false;
    if (!isFamilySafeEvent(event)) return false;
    const lower = event.content.toLowerCase();
    return !mutedWords.some((word) => containsBlockedPhrase(lower, word));
  });
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
  if (!trimmed || trimmed.length < 80) return false;
  if (isTransportPayload(trimmed)) return true;
  if (!/^[{[]/.test(trimmed) || !/[}\]]$/.test(trimmed)) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const keys = Object.keys(parsed as Record<string, unknown>);
    const machineKeys = ['protocol', 'action', 'pipeline_segment', 'session_entropy', 'system_telemetry', 'devicePk', 'swarm', 'service_metadata'];
    const machineKeyHits = keys.filter((key) => machineKeys.includes(key)).length;
    return machineKeyHits >= 2 || (keys.length >= 5 && machineKeyHits >= 1);
  } catch {
    return false;
  }
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

export async function fetchFeed(
  mode: FeedMode,
  relays = defaultRelays,
  follows: string[] = [],
  settings: CustomFeedSettings = { friendsOfFriends: true, keywords: [] },
  options: { limit?: number; until?: number } = {}
) {
  const relayUrls = activeRelayUrls(relays, 'read');
  const base: Filter = { kinds: [1], limit: options.limit ?? 24 };
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
  if (options.until) base.until = options.until;
  const filters: Filter[] =
    mode === 'follow' && follows.length
      ? [{ ...base, authors: follows, since }]
      : mode === 'custom' && follows.length
        ? await customFeedFilters(base, follows, settings, since, relayUrls)
        : [{ ...base, since }];

  const events = (await Promise.all(filters.map((filter) => pool.querySync(relayUrls, filter)))).flat() as NostrEvent[];
  const clean = dedupeEvents(filterSpam(events));
  await cacheEvents(clean);
  return clean;
}

export async function fetchMissingEvents(ids: string[], relays = defaultRelays) {
  if (!ids.length) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = (await pool.querySync(relayUrls, { ids })) as NostrEvent[];
  const clean = dedupeEvents(events);
  await cacheEvents(clean);
  return clean;
}

export async function fetchProfileEvents(pubkey: string, relays = defaultRelays, limit = 36) {
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = (await pool.querySync(relayUrls, { kinds: [1], authors: [pubkey], limit })) as NostrEvent[];
  const clean = dedupeEvents(filterSpam(events));
  await cacheEvents(clean);
  return clean;
}

export async function fetchProfiles(pubkeys: string[], relays = defaultRelays) {
  if (!pubkeys.length) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = (await pool.querySync(relayUrls, { kinds: [0], authors: pubkeys, limit: pubkeys.length })) as NostrEvent[];
  const profiles = parseProfileEvents(events);
  await Promise.all(profiles.map(cacheProfile));
  return profiles;
}

export async function searchProfiles(query: string, relays = defaultRelays) {
  const search = query.trim().replace(/^@/, '');
  if (search.length < 2) return [];
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = (await pool.querySync(relayUrls, { kinds: [0], search, limit: 12 })) as NostrEvent[];
  const profiles = parseProfileEvents(events);
  await Promise.all(profiles.map(cacheProfile));
  return profiles;
}

export async function fetchDirectMessages(session: Session, relays = defaultRelays) {
  const relayUrls = activeRelayUrls(relays, 'read');
  const incomingFilter: Filter = { kinds: [4], '#p': [session.pubkey], limit: 80 };
  const outgoingFilter: Filter = { kinds: [4], authors: [session.pubkey], limit: 80 };
  const events = (await Promise.all([pool.querySync(relayUrls, incomingFilter), pool.querySync(relayUrls, outgoingFilter)])).flat() as NostrEvent[];
  return Promise.all(dedupeEvents(events).map((event) => toDirectMessage(event, session)));
}

export async function fetchEventStats(ids: string[], relays = defaultRelays) {
  const uniqueIds = [...new Set(ids)].filter(Boolean).slice(0, 80);
  const emptyStats = () => ({ replies: 0, reposts: 0, likes: 0, zaps: 0 });
  const stats: Record<string, EventStats> = Object.fromEntries(uniqueIds.map((id) => [id, emptyStats()]));
  if (!uniqueIds.length) return stats;

  const relayUrls = activeRelayUrls(relays, 'read');
  const filters: Filter[] = [
    { kinds: [1], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) },
    { kinds: [6, 16], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) },
    { kinds: [7], '#e': uniqueIds, limit: Math.min(800, uniqueIds.length * 35) },
    { kinds: [9735], '#e': uniqueIds, limit: Math.min(500, uniqueIds.length * 20) }
  ];
  const events = dedupeEvents((await Promise.all(filters.map((filter) => pool.querySync(relayUrls, filter)))).flat() as NostrEvent[]);
  const seen = {
    replies: new Set<string>(),
    reposts: new Set<string>(),
    likes: new Set<string>(),
    zaps: new Set<string>()
  };

  for (const event of events) {
    for (const id of referencedEventIds(event, uniqueIds)) {
      if (!stats[id]) continue;
      if (event.kind === 1 && !seen.replies.has(`${id}:${event.id}`)) {
        seen.replies.add(`${id}:${event.id}`);
        stats[id].replies += 1;
      } else if ((event.kind === 6 || event.kind === 16) && !seen.reposts.has(`${id}:${event.id}`)) {
        seen.reposts.add(`${id}:${event.id}`);
        stats[id].reposts += 1;
      } else if (event.kind === 7 && !seen.likes.has(`${id}:${event.pubkey}`)) {
        seen.likes.add(`${id}:${event.pubkey}`);
        stats[id].likes += 1;
      } else if (event.kind === 9735 && !seen.zaps.has(`${id}:${event.id}`)) {
        seen.zaps.add(`${id}:${event.id}`);
        stats[id].zaps += 1;
      }
    }
  }

  return stats;
}

export async function fetchContactList(pubkey: string, relays = defaultRelays) {
  return (await fetchContactListDetails(pubkey, relays)).pubkeys;
}

export async function fetchContactListDetails(pubkey: string, relays = defaultRelays): Promise<ContactListDetails> {
  const relayUrls = activeRelayUrls(relays, 'read');
  const events = ((await pool.querySync(relayUrls, { kinds: [3], authors: [pubkey], limit: 1 })) as NostrEvent[]).sort(
    (a, b) => b.created_at - a.created_at
  );
  return extractContactListDetails(events[0]);
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
  return events.flatMap((event) => {
    try {
      const profile = JSON.parse(event.content) as Profile;
      return [{ ...profile, pubkey: event.pubkey }];
    } catch {
      return [];
    }
  });
}

async function toDirectMessage(event: NostrEvent, session: Session): Promise<DirectMessage> {
  const recipient = event.tags.find((tag) => tag[0] === 'p' && tag[1])?.[1] ?? '';
  const delegated = event.tags.some((tag) => tag[0] === 'delegation');
  const isOutgoing = event.pubkey === session.pubkey;
  const peer = isOutgoing ? recipient : event.pubkey;
  return {
    id: event.id,
    protocol: delegated ? 'NIP-26' : 'NIP-04',
    peer,
    from: event.pubkey,
    to: recipient,
    created_at: event.created_at,
    encrypted: event.content,
    content: await decryptNip04(session, peer, event.content).catch(() => undefined),
    delegated
  };
}

export function canDecryptNip04(session: Session) {
  return session.mode === 'private-key' || Boolean(typeof window !== 'undefined' && window.nostr?.nip04);
}

async function decryptNip04(session: Session, peer: string, ciphertext: string) {
  if (!peer) return undefined;
  if (session.secret) return nip04.decrypt(hexToBytes(session.secret), peer, ciphertext);
  if (typeof window !== 'undefined' && session.mode === 'nip07' && window.nostr?.nip04) return window.nostr.nip04.decrypt(peer, ciphertext);
  return undefined;
}

export async function publishNote(session: Session, content: string, relays = defaultRelays, tags: string[][] = []) {
  const draft = { kind: 1, content, tags, created_at: Math.floor(Date.now() / 1000) };
  let event: NostrToolsEvent;
  if (session.mode === 'nip07' && window.nostr) {
    event = (await window.nostr.signEvent({ ...draft, pubkey: session.pubkey })) as unknown as NostrToolsEvent;
  } else if (session.secret) {
    event = finalizeEvent(draft, hexToBytes(session.secret));
  } else {
    throw new Error('This login mode cannot sign yet. Connect a signer before publishing.');
  }

  const urls = activeRelayUrls(relays, 'write');
  if (!urls.length) throw new Error('No write relays are enabled.');
  await Promise.any(pool.publish(urls, event));
  return event as unknown as NostrEvent;
}

export async function publishProfile(session: Session, profile: Profile, relays = defaultRelays) {
  const metadata = compactProfile(profile);
  const draft = { kind: 0, content: JSON.stringify(metadata), tags: [], created_at: Math.floor(Date.now() / 1000) };
  let event: NostrToolsEvent;
  if (session.mode === 'nip07' && window.nostr) {
    event = (await window.nostr.signEvent({ ...draft, pubkey: session.pubkey })) as unknown as NostrToolsEvent;
  } else if (session.secret) {
    event = finalizeEvent(draft, hexToBytes(session.secret));
  } else {
    throw new Error('This login mode cannot sign yet. Connect a signer before updating your profile.');
  }

  const urls = activeRelayUrls(relays, 'write');
  if (!urls.length) throw new Error('No write relays are enabled.');
  await Promise.any(pool.publish(urls, event));
  const savedProfile = { ...metadata, pubkey: session.pubkey };
  await cacheProfile(savedProfile);
  return { event: event as unknown as NostrEvent, profile: savedProfile };
}

export async function publishContactList(session: Session, pubkeys: string[], relays = defaultRelays) {
  const tags = [...new Set(pubkeys)].map((pubkey) => ['p', pubkey]);
  const draft = { kind: 3, content: '', tags, created_at: Math.floor(Date.now() / 1000) };
  let event: NostrToolsEvent;
  if (session.mode === 'nip07' && window.nostr) {
    event = (await window.nostr.signEvent({ ...draft, pubkey: session.pubkey })) as unknown as NostrToolsEvent;
  } else if (session.secret) {
    event = finalizeEvent(draft, hexToBytes(session.secret));
  } else {
    throw new Error('This login mode cannot sign yet. Connect a signer before updating your follow list.');
  }

  const urls = activeRelayUrls(relays, 'write');
  if (!urls.length) throw new Error('No write relays are enabled.');
  await Promise.any(pool.publish(urls, event));
  return event as unknown as NostrEvent;
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

async function customFeedFilters(base: Filter, follows: string[], settings: CustomFeedSettings, since: number, relayUrls: string[]) {
  const total = base.limit ?? 24;
  const hasKeywords = settings.keywords.some((keyword) => keyword.trim());
  const keywordLimit = hasKeywords ? Math.max(1, Math.round(total * 0.2)) : 0;
  const friendsOfFriends = settings.friendsOfFriends ? await fetchFriendsOfFriends(follows, relayUrls) : [];
  const friendsOfFriendsLimit = friendsOfFriends.length ? Math.max(1, Math.round(total * 0.2)) : 0;
  const followLimit = Math.max(1, total - keywordLimit - friendsOfFriendsLimit);
  const filters: Filter[] = [{ ...base, authors: sampleAuthors(follows, followLimit), limit: followLimit, since }];

  if (friendsOfFriendsLimit) {
    filters.push({ ...base, authors: sampleAuthors(friendsOfFriends, friendsOfFriendsLimit), limit: friendsOfFriendsLimit, since });
  }

  const search = settings.keywords.map((keyword) => keyword.trim()).filter(Boolean).join(' ');
  if (search) filters.push({ ...base, search, limit: keywordLimit, since });
  return filters;
}

async function fetchFriendsOfFriends(follows: string[], relayUrls: string[]) {
  const contactEvents = (await pool.querySync(relayUrls, { kinds: [3], authors: follows, limit: Math.min(120, follows.length) })) as NostrEvent[];
  const directFollows = new Set(follows);
  const pubkeys = new Set<string>();
  for (const event of contactEvents) {
    for (const pubkey of extractContactListDetails(event).pubkeys) if (!directFollows.has(pubkey)) pubkeys.add(pubkey);
  }
  return [...pubkeys];
}

export function extractContactListDetails(event?: NostrEvent): ContactListDetails {
  if (!event) return { pubkeys: [], relayHints: [] };
  const pubkeys = new Set<string>();
  const relayHints = new Set<string>();

  for (const tag of event.tags) {
    if (tag[0] !== 'p' || !tag[1]) continue;
    pubkeys.add(tag[1]);
    if (tag[2]) sanitizeRelayHints([tag[2]]).forEach((url) => relayHints.add(url));
  }

  return { pubkeys: [...pubkeys], relayHints: [...relayHints] };
}

function sanitizeRelayHints(urls: string[]) {
  return [...new Set(urls.map((url) => url.trim()).filter((url) => /^wss:\/\/[^ ]+\.[^ ]+/.test(url)))];
}

function referencedEventIds(event: NostrEvent, ids: string[]) {
  const idSet = new Set(ids);
  return [...new Set(event.tags.flatMap((tag) => (tag[0] === 'e' && idSet.has(tag[1]) ? [tag[1]] : [])))];
}

function compactProfile(profile: Profile): Omit<Profile, 'pubkey'> {
  return Object.fromEntries(
    Object.entries({
      name: profile.name,
      display_name: profile.display_name,
      about: profile.about,
      picture: profile.picture,
      banner: profile.banner,
      nip05: profile.nip05,
      lud16: profile.lud16,
      lud06: profile.lud06,
      website: profile.website
    }).filter(([, value]) => typeof value === 'string' && value.trim())
  ) as Omit<Profile, 'pubkey'>;
}
