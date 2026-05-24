import { nip19 } from 'nostr-tools';
import { extractMediaUrls, extractQuotedNoteReferences, isVideoUrl, parseHashtags, parseNoteText } from './media';

describe('media helpers', () => {
  it('extracts unique image and video urls from note content', () => {
    const image = 'https://example.com/photo.jpg';
    const video = 'https://cdn.example.com/clip.webm?x=1';

    expect(extractMediaUrls(`look ${image} again ${image} and ${video}`)).toEqual([image, video]);
    expect(isVideoUrl(image)).toBe(false);
    expect(isVideoUrl(video)).toBe(true);
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

  it('makes bare domains, mentions, and bare nostr references clickable', () => {
    const pubkey = 'a'.repeat(64);
    const npub = nip19.npubEncode(pubkey);

    expect(parseNoteText(`site example.com/story @PodcastsLive/116624629041088746 ${npub}`)).toEqual([
      { type: 'text', value: 'site ' },
      { type: 'link', value: 'example.com/story', href: 'https://example.com/story' },
      { type: 'text', value: ' ' },
      { type: 'mention', value: '@PodcastsLive/116624629041088746', href: '/profile/PodcastsLive?note=116624629041088746' },
      { type: 'text', value: ' ' },
      { type: 'nostr', value: npub, href: `/profile/${pubkey}`, label: '@nostr' }
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
      { type: 'nostr', value: '#[0]', href: `/profile/${pubkey}`, label: '@nostr' },
      { type: 'text', value: ' see ' },
      { type: 'nostr', value: '#[1]', href: `/thread/${noteId}`, label: 'note' }
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
});
