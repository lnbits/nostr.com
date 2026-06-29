import { cachedOlderFeedPage, displayEventsForFeedMode, eventStats, likedEvents, likedStateForEvent, mergeEvents, olderFeedPageCutoff, reconcileStatsWithOwnActions, statsForEvent } from './app';
import type { EventStats, NostrEvent } from '$lib/nostr/types';

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

function repostEvent(id: string, created_at: number, pubkey: string, reposted: NostrEvent): NostrEvent {
  return {
    id,
    pubkey,
    created_at,
    kind: 6,
    tags: [
      ['e', reposted.id],
      ['p', reposted.pubkey]
    ],
    content: JSON.stringify(reposted),
    sig: 'b'.repeat(128)
  };
}

function stats(overrides: Partial<EventStats> = {}): EventStats {
  return {
    replies: 0,
    reposts: 0,
    likes: 0,
    zaps: 0,
    zapSats: 0,
    dislikes: 0,
    emoji: 0,
    ...overrides
  };
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

  it('does not de-flood explicit global authors from the global feed', () => {
    const globalAuthor = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
    const items = [
      authorEvent('trusted-1', 60, globalAuthor),
      authorEvent('trusted-2', 50, globalAuthor),
      authorEvent('trusted-3', 40, globalAuthor),
      authorEvent('trusted-4', 30, globalAuthor)
    ];

    expect(mergeEvents(items, []).map((item) => item.id)).toEqual(['trusted-1', 'trusted-2', 'trusted-3', 'trusted-4']);
  });

  it('caps the in-memory feed after merging', () => {
    const authors = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    const items = Array.from({ length: 605 }, (_, index) => authorEvent(`event-${index}`, index, authors[index % authors.length]));

    const merged = mergeEvents(items, []);
    expect(merged).toHaveLength(600);
    expect(merged[0].id).toBe('event-604');
    expect(merged.at(-1)?.id).toBe('event-5');
  });

  it('reveals cached older notes below the visible cursor before relay pagination can skip ahead', () => {
    const visible = [authorEvent('visible-new', 100, 'a'.repeat(64)), authorEvent('visible-old', 90, 'b'.repeat(64))];
    const cached = [
      authorEvent('too-new', 95, 'c'.repeat(64)),
      authorEvent('gap-fill-1', 80, 'd'.repeat(64)),
      authorEvent('gap-fill-2', 70, 'e'.repeat(64)),
      authorEvent('much-older', 10, 'f'.repeat(64))
    ];

    expect(cachedOlderFeedPage(cached, visible, 2).map((item) => item.id)).toEqual(['gap-fill-1', 'gap-fill-2']);
  });

  it('does not date-window older following pages so sparse follows can keep loading', () => {
    expect(olderFeedPageCutoff(1_000_000, 'follow')).toBeUndefined();
    expect(olderFeedPageCutoff(1_000_000, 'global')).toEqual(expect.any(Number));
  });

  it('limits global display to the default feed hashtags and explicit global authors', () => {
    const globalAuthor = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
    const items = [
      { ...authorEvent('technology', 30, 'a'.repeat(64)), tags: [['t', 'technology']] },
      { ...authorEvent('food-content', 20, 'b'.repeat(64)), content: 'made lunch #foodstr' },
      authorEvent('global-author', 15, globalAuthor),
      { ...authorEvent('other', 10, 'c'.repeat(64)), tags: [['t', 'nostr']] }
    ];

    expect(displayEventsForFeedMode('global', items).map((item) => item.id)).toEqual(['technology', 'food-content', 'global-author']);
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

  it('renders followed reposts as the reposted note in feed display', () => {
    const followed = 'a'.repeat(64);
    const originalAuthor = 'b'.repeat(64);
    const original = authorEvent('1'.repeat(64), 30, originalAuthor);
    const repost = repostEvent('2'.repeat(64), 40, followed, original);

    expect(displayEventsForFeedMode('follow', [repost], [followed]).map((item) => item.id)).toEqual([original.id]);
  });

  it('orders displayed reposts by the repost event time', () => {
    const followed = 'a'.repeat(64);
    const original = authorEvent('1'.repeat(64), 10, 'b'.repeat(64));
    const newer = authorEvent('3'.repeat(64), 30, followed);
    const repost = repostEvent('2'.repeat(64), 40, followed, original);

    expect(displayEventsForFeedMode('follow', [original, newer, repost], [followed]).map((item) => item.id)).toEqual([original.id, newer.id]);
  });

  it('matches custom feed keywords against reposted note content', () => {
    const original = { ...authorEvent('1'.repeat(64), 30, 'b'.repeat(64)), tags: [['t', 'coffee']] };
    const repost = repostEvent('2'.repeat(64), 40, 'c'.repeat(64), original);

    expect(displayEventsForFeedMode('custom', [repost], [], { friendsOfFriends: false, keywords: ['#coffee'], interests: [] }).map((item) => item.id)).toEqual([original.id]);
  });

  it('does not fall back to unrelated global notes for custom display without follows', () => {
    expect(displayEventsForFeedMode('custom', [authorEvent('global', 10, 'c'.repeat(64))], [], { friendsOfFriends: true, keywords: ['#nostr'], interests: [] })).toEqual([]);
  });

  it('allows keyword-only custom display when there are no follows', () => {
    const matching = { ...authorEvent('keyword', 10, 'c'.repeat(64)), content: 'building with nostr today' };
    const tagged = { ...authorEvent('tagged', 8, 'e'.repeat(64)), tags: [['t', 'nostr']], content: 'tagged only' };
    const unrelated = authorEvent('other', 5, 'd'.repeat(64));

    expect(displayEventsForFeedMode('custom', [matching, tagged, unrelated], [], { friendsOfFriends: true, keywords: ['nostr'], interests: [] }).map((item) => item.id)).toEqual(['keyword', 'tagged']);
  });

  it('reconciles cached stats with local own actions without lowering larger counts', () => {
    const liked = '1'.repeat(64);
    const reposted = '2'.repeat(64);
    const popular = '3'.repeat(64);

    expect(
      reconcileStatsWithOwnActions(
        {
          [liked]: { replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 },
          [popular]: { replies: 0, reposts: 4, likes: 9, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 }
        },
        [
          { targetId: liked, type: 'like' },
          { targetId: reposted, type: 'repost' },
          { targetId: popular, type: 'like' },
          { targetId: popular, type: 'repost' }
        ]
      )
    ).toEqual({
      [liked]: { replies: 0, reposts: 0, likes: 1, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 },
      [reposted]: { replies: 0, reposts: 1, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 },
      [popular]: { replies: 0, reposts: 4, likes: 9, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 }
    });
  });

  it('only notifies per-note selectors when the selected note changes', () => {
    const target = '1'.repeat(64);
    const other = '2'.repeat(64);
    const selectedStats: unknown[] = [];
    const selectedLikes: boolean[] = [];

    eventStats.set({});
    likedEvents.set(new Set());
    const unsubscribeStats = statsForEvent(target).subscribe((value) => selectedStats.push(value));
    const unsubscribeLikes = likedStateForEvent(target).subscribe((value) => selectedLikes.push(value));

    eventStats.set({ [other]: stats({ likes: 1 }) });
    likedEvents.set(new Set([other]));
    expect(selectedStats).toHaveLength(1);
    expect(selectedLikes).toEqual([false]);

    eventStats.set({ [target]: stats({ likes: 1 }), [other]: stats({ likes: 2 }) });
    likedEvents.set(new Set([target, other]));
    expect(selectedStats).toHaveLength(2);
    expect(selectedLikes).toEqual([false, true]);

    eventStats.set({ [target]: stats({ likes: 1 }), [other]: stats({ likes: 3 }) });
    likedEvents.set(new Set([target]));
    expect(selectedStats).toHaveLength(2);
    expect(selectedLikes).toEqual([false, true]);

    unsubscribeStats();
    unsubscribeLikes();
    eventStats.set({});
    likedEvents.set(new Set());
  });
});
