import { extractMediaUrls, isVideoUrl, parseHashtags } from './media';

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
});
