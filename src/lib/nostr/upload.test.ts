import { describe, expect, it } from 'vitest';
import { uploadResponseUrl } from './upload';

describe('nostr.build upload parsing', () => {
  it('extracts urls from common NIP-94 response shapes', () => {
    expect(uploadResponseUrl({ tags: [['url', 'https://cdn.example.com/a.jpg']] })).toBe('https://cdn.example.com/a.jpg');
    expect(uploadResponseUrl({ data: [{ url: 'https://cdn.example.com/b.jpg' }] })).toBe('https://cdn.example.com/b.jpg');
    expect(uploadResponseUrl({ data: { files: [{ downloadUrl: 'https://cdn.example.com/c.jpg' }] } })).toBe('https://cdn.example.com/c.jpg');
  });
});
