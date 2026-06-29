import { describe, expect, it } from 'vitest';
import { appendMediaUrlToDraft } from './mediaDraft';

describe('media draft helpers', () => {
  it('adds uploaded media below the writing position', () => {
    expect(appendMediaUrlToDraft('', 'https://cdn.example.com/a.jpg')).toEqual({
      content: '\n\nhttps://cdn.example.com/a.jpg',
      caret: 0
    });
    expect(appendMediaUrlToDraft('hello', 'https://cdn.example.com/a.jpg')).toEqual({
      content: 'hello\n\nhttps://cdn.example.com/a.jpg',
      caret: 5
    });
    expect(appendMediaUrlToDraft('hello\n\n', 'https://cdn.example.com/a.jpg')).toEqual({
      content: 'hello\n\nhttps://cdn.example.com/a.jpg',
      caret: 5
    });
  });
});
