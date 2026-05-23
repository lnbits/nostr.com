import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  activeRelayUrls,
  dedupeEvents,
  extractContactListDetails,
  feedFiltersForMode,
  fetchFeed,
  filterSpam,
  isReplyEvent,
  isMachineGeneratedContent,
  limitConsecutiveAuthors,
  loginWithBunker,
  loginWithPrivateKey,
  parseProfileEvents,
  publishNote,
  topLevelFeedEvents
} from './client';
import type { NostrEvent, RelayState, Session } from './types';

const pubkey = 'a'.repeat(64);

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

  it('dedupes each relay batch and sorts newest first without poisoning future batches', () => {
    const older = event({ id: '1'.repeat(64), created_at: 10 });
    const newer = event({ id: '2'.repeat(64), created_at: 20 });

    expect(dedupeEvents([older, newer, older]).map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(dedupeEvents([older]).map((item) => item.id)).toEqual([older.id]);
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

  it('returns an empty follow or custom feed when there are no follows', async () => {
    await expect(fetchFeed('follow', [], [])).resolves.toEqual([]);
    await expect(fetchFeed('custom', [], [])).resolves.toEqual([]);
  });

  it('adds hashtag constraints while preserving the active feed mode', async () => {
    const follows = ['c'.repeat(64)];
    const base = { kinds: [1], limit: 10 };

    expect(await feedFiltersForMode('global', base, follows, { friendsOfFriends: false, keywords: [] }, 123, [], { hashtag: '#Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], since: 123 }
    ]);
    expect(await feedFiltersForMode('follow', base, follows, { friendsOfFriends: false, keywords: [] }, 123, [], { hashtag: 'Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], authors: follows, since: 123 }
    ]);
    expect(await feedFiltersForMode('custom', base, follows, { friendsOfFriends: false, keywords: [] }, 123, [], { hashtag: 'Nostr' })).toEqual([
      { kinds: [1], limit: 10, '#t': ['nostr'], authors: follows, since: 123 }
    ]);
  });

  it('filters muted pubkeys and obvious muted-word spam', () => {
    const muted = event({ pubkey: 'c'.repeat(64), content: 'normal note' });
    const spam = event({ content: 'free sats now' });
    const good = event({ content: 'protocol work is happening' });

    expect(filterSpam([muted, spam, good], new Set([muted.pubkey]))).toEqual([good]);
  });

  it('keeps replies out of top-level feed results', () => {
    const root = event({ content: 'top-level note' });
    const markedReply = event({ content: 'reply', tags: [['e', root.id, 'wss://relay.example', 'reply', root.pubkey]] });
    const legacyReply = event({ content: 'legacy reply', tags: [['e', root.id]] });

    expect(isReplyEvent(root)).toBe(false);
    expect(isReplyEvent(markedReply)).toBe(true);
    expect(isReplyEvent(legacyReply)).toBe(true);
    expect(topLevelFeedEvents([root, markedReply, legacyReply])).toEqual([root]);
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

  it('filters broadcast transport payloads that are not human-readable notes', () => {
    const transport = event({
      content: `[broadcast:[#1695f]] {"route":{"id":"1779540780109963-80109","from":"[#1695f]","to":"broadcast"},"payload":{"type":"ar_profile","profile":{"id":"[#1695f]"},"p":"${'A'.repeat(600)}"}}`
    });
    const human = event({ content: 'I am debugging a relay route today, but this is still a normal human note.' });

    expect(isMachineGeneratedContent(transport.content)).toBe(true);
    expect(filterSpam([transport, human])).toEqual([human]);
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

  it('parses profile metadata events and ignores malformed records', () => {
    const valid = event({ kind: 0, pubkey, content: JSON.stringify({ name: 'Ada', about: 'builds clients' }) });
    const invalid = event({ kind: 0, pubkey: 'd'.repeat(64), content: '{nope' });

    expect(parseProfileEvents([valid, invalid])).toEqual([{ pubkey, name: 'Ada', about: 'builds clients' }]);
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
});
