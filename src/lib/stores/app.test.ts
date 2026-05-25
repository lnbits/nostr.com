import { displayEventsForFeedMode, mergeEvents } from './app';
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

function authorEvent(id: string, created_at: number, pubkey: string): NostrEvent {
  return { ...event(id, created_at), pubkey };
}

describe('app store helpers', () => {
  it('merges feed events by id and keeps the newest timeline order', () => {
    const oldCopy = event('same', 10, 'old');
    const newCopy = event('same', 20, 'new');
    const other = event('other', 15);

    expect(mergeEvents([newCopy], [oldCopy, other])).toEqual([newCopy, other]);
  });

  it('keeps only two adjacent global feed notes from the same author after merging', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const items = [
      authorEvent('a1', 60, a),
      authorEvent('a2', 50, a),
      authorEvent('a3', 40, a),
      authorEvent('b1', 30, b),
      authorEvent('a4', 20, a)
    ];

    expect(mergeEvents(items, []).map((item) => item.id)).toEqual(['a1', 'a2', 'b1', 'a3', 'a4']);
  });

  it('caps the in-memory feed after merging', () => {
    const authors = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const items = Array.from({ length: 605 }, (_, index) => authorEvent(`event-${index}`, index, authors[index % authors.length]));

    const merged = mergeEvents(items, []);
    expect(merged).toHaveLength(600);
    expect(merged[0].id).toBe('event-604');
    expect(merged.at(-1)?.id).toBe('event-5');
  });

  it('allows direct follows, friends of friends, hashtags, and keyword matches in custom display', () => {
    const follow = 'a'.repeat(64);
    const friend = 'b'.repeat(64);
    const unrelated = 'c'.repeat(64);
    const items = [
      authorEvent('follow', 40, follow),
      authorEvent('friend', 30, friend),
      { ...authorEvent('hashtag', 20, unrelated), tags: [['t', 'coffee']] },
      { ...authorEvent('keyword', 10, unrelated), content: 'this mentions quiche today' },
      authorEvent('other', 5, unrelated)
    ];

    expect(
      displayEventsForFeedMode('custom', items, [follow], { friendsOfFriends: true, keywords: ['#coffee', 'quiche'], interests: [] }, [friend]).map((item) => item.id)
    ).toEqual(['follow', 'friend', 'hashtag', 'keyword']);
  });
});
