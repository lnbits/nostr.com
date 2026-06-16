import { nip19 } from 'nostr-tools';
import { extractMediaAttachments, extractMediaUrls, extractQuotedNoteReferences, extractSocialEmbeds, isVideoUrl, parseHashtags, parseNoteText } from './media';
import type { NostrEvent } from './types';

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: overrides.id ?? 'a'.repeat(64),
    pubkey: overrides.pubkey ?? 'b'.repeat(64),
    created_at: overrides.created_at ?? 1,
    kind: overrides.kind ?? 1,
    tags: overrides.tags ?? [],
    content: overrides.content ?? '',
    sig: overrides.sig ?? 'c'.repeat(128)
  };
}

describe('media helpers', () => {
  it('extracts unique image and video urls from note content', () => {
    const image = 'https://example.com/photo.jpg';
    const video = 'https://cdn.example.com/clip.webm?x=1';

    expect(extractMediaUrls(`look ${image} again ${image} and ${video}`)).toEqual([image, video]);
    expect(isVideoUrl(image)).toBe(false);
    expect(isVideoUrl(video)).toBe(true);
  });

  it('ignores article page urls in imeta tags', () => {
    expect(
      extractMediaAttachments(
        event({
          content: 'Read: https://theboard.world/articles/russia-support-iran-middle-east-conflict',
          tags: [['imeta', 'url https://theboard.world/articles/russia-support-iran-middle-east-conflict', 'm text/html']]
        })
      )
    ).toEqual([]);
  });

  it('accepts extensionless imeta urls when they include image or video mime types', () => {
    expect(
      extractMediaAttachments(
        event({
          tags: [['imeta', 'url https://cdn.example.com/media/abc123', 'm image/jpeg', 'alt profile photo']]
        })
      )
    ).toEqual([{ url: 'https://cdn.example.com/media/abc123', type: 'image', alt: 'profile photo', fallbackUrls: [] }]);
  });

  it('parses hashtags into clickable text parts', () => {
    expect(parseHashtags('hello #nostr and (#bitcoin)')).toEqual([
      { type: 'text', value: 'hello ' },
      { type: 'hashtag', value: 'nostr' },
      { type: 'text', value: ' and (' },
      { type: 'hashtag', value: 'bitcoin' },
      { type: 'text', value: ')' }
    ]);
  });

  it('hides rendered media urls and makes ordinary web links clickable', () => {
    const media = 'https://cdn.example.com/clip.mp4';
    const link = 'https://example.com/story';

    expect(parseNoteText(`watch this ${media}\nread ${link}`, [media])).toEqual([
      { type: 'text', value: 'watch this\nread ' },
      { type: 'link', value: link, href: link }
    ]);
  });

  it('extracts playable social embeds from common video links', () => {
    expect(
      extractSocialEmbeds(
        [
          'https://youtu.be/7UtgB_enTw8',
          'https://www.youtube.com/watch?v=IpOktupkl0c',
          'https://vimeo.com/123456789',
          'https://www.instagram.com/reel/Cabc123_def/',
          'https://www.tiktok.com/@nostr/video/7330000000000000000'
        ].join('\n')
      )
    ).toEqual([
      {
        provider: 'youtube',
        url: 'https://youtu.be/7UtgB_enTw8',
        embedUrl: 'https://www.youtube-nocookie.com/embed/7UtgB_enTw8?enablejsapi=1',
        title: 'YouTube video',
        aspect: 'video'
      },
      {
        provider: 'youtube',
        url: 'https://www.youtube.com/watch?v=IpOktupkl0c',
        embedUrl: 'https://www.youtube-nocookie.com/embed/IpOktupkl0c?enablejsapi=1',
        title: 'YouTube video',
        aspect: 'video'
      },
      {
        provider: 'vimeo',
        url: 'https://vimeo.com/123456789',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        title: 'Vimeo video',
        aspect: 'video'
      },
      {
        provider: 'instagram',
        url: 'https://www.instagram.com/reel/Cabc123_def/',
        embedUrl: 'https://www.instagram.com/reel/Cabc123_def/embed',
        title: 'Instagram reel',
        aspect: 'portrait'
      },
      {
        provider: 'tiktok',
        url: 'https://www.tiktok.com/@nostr/video/7330000000000000000',
        embedUrl: 'https://www.tiktok.com/embed/v2/7330000000000000000',
        title: 'TikTok video',
        aspect: 'portrait'
      }
    ]);
  });

  it('does not treat lookalike social domains as embeds', () => {
    expect(
      extractSocialEmbeds(
        [
          'https://evilvimeo.com/123456789',
          'https://notinstagram.com/reel/Cabc123_def/',
          'https://bad-tiktok.com/@nostr/video/7330000000000000000'
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('makes bare domains, mentions, and bare nostr references clickable', () => {
    const pubkey = 'a'.repeat(64);
    const npub = nip19.npubEncode(pubkey);

    expect(parseNoteText(`site example.com/story @PodcastsLive/116624629041088746 ${npub}`)).toEqual([
      { type: 'text', value: 'site ' },
      { type: 'link', value: 'example.com/story', href: 'https://example.com/story' },
      { type: 'text', value: ' ' },
      { type: 'mention', value: '@PodcastsLive/116624629041088746', href: '/profile/PodcastsLive?note=116624629041088746' },
      { type: 'text', value: ' ' },
      { type: 'nostr', value: npub, href: `/profile/${pubkey}`, label: '@nostr', pubkey }
    ]);
  });

  it('does not treat decimal numbers as bare domain links', () => {
    expect(parseNoteText('Amount: 4098.52004465 BTC (~$309.00M)\nSite: ethicoin.org')).toEqual([
      { type: 'text', value: 'Amount: 4098.52004465 BTC (~$309.00M)\nSite: ' },
      { type: 'link', value: 'ethicoin.org', href: 'https://ethicoin.org' }
    ]);
  });

  it('resolves NIP-27 indexed profile and note references through event tags', () => {
    const pubkey = 'b'.repeat(64);
    const noteId = 'c'.repeat(64);

    expect(
      parseNoteText('hello #[0] see #[1]', [], [
        ['p', pubkey],
        ['e', noteId]
      ])
    ).toEqual([
      { type: 'text', value: 'hello ' },
      { type: 'nostr', value: '#[0]', href: `/profile/${pubkey}`, label: '@nostr', pubkey },
      { type: 'text', value: ' see ' },
      { type: 'nostr', value: '#[1]', href: `/thread/${noteId}`, label: 'note' }
    ]);
  });

  it('leaves malformed NIP-27 indexed references as text', () => {
    expect(
      parseNoteText('hello #[0] see #[1]', [], [
        ['p', '../settings'],
        ['e', 'not-a-note-id']
      ])
    ).toEqual([
      { type: 'text', value: 'hello ' },
      { type: 'text', value: '#[0]' },
      { type: 'text', value: ' see ' },
      { type: 'text', value: '#[1]' }
    ]);
  });

  it('extracts quoted note references from NIP-19 and indexed references', () => {
    const first = 'd'.repeat(64);
    const second = 'e'.repeat(64);
    const third = 'f'.repeat(64);
    const note = nip19.noteEncode(first);
    const nevent = nip19.neventEncode({ id: second });

    expect(extractQuotedNoteReferences(`quote nostr:${note} and ${nevent} plus #[2]`, [['p', 'a'.repeat(64)], ['e', first], ['e', third]])).toEqual([
      { id: first, raw: `nostr:${note}` },
      { id: second, raw: nevent },
      { id: third, raw: '#[2]' }
    ]);
  });

  it('keeps nevent route links intact so relay hints survive navigation', () => {
    const id = 'f'.repeat(64);
    const nevent = nip19.neventEncode({ id, relays: ['wss://relay.example'] });

    expect(parseNoteText(nevent)).toEqual([{ type: 'nostr', value: nevent, href: `/thread/${nevent}`, label: 'note' }]);
  });
});
