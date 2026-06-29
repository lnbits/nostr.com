import { describe, expect, it } from 'vitest';
import { browserUploadUrl, maxImageUploadBytes, maxVideoUploadBytes, uploadMediaKind, uploadMediaValidationError, uploadResponseUrl } from './upload';

describe('nostr.build upload parsing', () => {
  it('uses the local dev proxy for browser uploads in development', () => {
    expect(browserUploadUrl()).toBe('/__nostr_build_upload');
  });

  it('extracts urls from common NIP-94 response shapes', () => {
    expect(uploadResponseUrl({ tags: [['url', 'https://cdn.example.com/a.jpg']] })).toBe('https://cdn.example.com/a.jpg');
    expect(uploadResponseUrl({ data: [{ url: 'https://cdn.example.com/b.jpg' }] })).toBe('https://cdn.example.com/b.jpg');
    expect(uploadResponseUrl({ data: { files: [{ downloadUrl: 'https://cdn.example.com/c.jpg' }] } })).toBe('https://cdn.example.com/c.jpg');
  });

  it('rejects non-http urls from upload responses', () => {
    expect(uploadResponseUrl({ tags: [['url', 'javascript:alert(1)']] })).toBe('');
    expect(uploadResponseUrl({ data: { url: 'data:text/html,<script>alert(1)</script>' } })).toBe('');
  });

  it('allows supported image, gif, and video media uploads by type or extension', () => {
    expect(uploadMediaKind(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))).toBe('image');
    expect(uploadMediaKind(new File(['x'], 'animation.gif', { type: 'image/gif' }))).toBe('image');
    expect(uploadMediaKind(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))).toBe('video');
    expect(uploadMediaKind(new File(['x'], 'clip.mov', { type: '' }))).toBe('video');
    expect(uploadMediaKind(new File(['x'], 'clip.mp4', { type: 'application/octet-stream' }))).toBe('video');
  });

  it('rejects unsupported and oversized media before upload', () => {
    expect(uploadMediaValidationError({ name: 'notes.txt', type: 'text/plain', size: 1 })).toBe('Choose an image, GIF, or video file.');
    expect(uploadMediaValidationError({ name: 'vector.svg', type: 'image/svg+xml', size: 1 })).toBe('Choose an image, GIF, or video file.');
    expect(uploadMediaValidationError({ name: 'large.gif', type: 'image/gif', size: maxImageUploadBytes + 1 })).toBe('Images and GIFs must be 15 MB or smaller.');
    expect(uploadMediaValidationError({ name: 'large.mp4', type: 'video/mp4', size: maxVideoUploadBytes + 1 })).toBe('Videos must be 25 MB or smaller.');
  });
});
