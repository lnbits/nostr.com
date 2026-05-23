import { mergeEvents } from './app';
import type { NostrEvent } from '$lib/nostr/types';

function event(id: string, created_at: number, content = id): NostrEvent {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content,
    sig: 'b'.repeat(128)
  };
}

describe('app store helpers', () => {
  it('merges feed events by id and keeps the newest timeline order', () => {
    const oldCopy = event('same', 10, 'old');
    const newCopy = event('same', 20, 'new');
    const other = event('other', 15);

    expect(mergeEvents([newCopy], [oldCopy, other])).toEqual([newCopy, other]);
  });
});
