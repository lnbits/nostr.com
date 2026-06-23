import { get } from 'svelte/store';
import { vi } from 'vitest';
import type { NostrEvent, Session } from '$lib/nostr/types';

const clientMocks = vi.hoisted(() => ({
  fetchUserEventActions: vi.fn(),
  publishReaction: vi.fn(),
  publishRepost: vi.fn(),
  publishDeletion: vi.fn()
}));

vi.mock('$lib/nostr/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/nostr/client')>();
  return {
    ...actual,
    fetchUserEventActions: clientMocks.fetchUserEventActions,
    publishReaction: clientMocks.publishReaction,
    publishRepost: clientMocks.publishRepost,
    publishDeletion: clientMocks.publishDeletion
  };
});

import { deletedEventIds, events, eventStats, likedEvents, reactToNote, repostedEvents, repostNote, session } from './app';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function note(id: string): NostrEvent {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: 'note',
    sig: 'b'.repeat(128)
  };
}

function actionEvent(id: string, target: NostrEvent, pubkey = 'c'.repeat(64), kind = 7): NostrEvent {
  return {
    id,
    pubkey,
    created_at: 2,
    kind,
    tags: [['e', target.id], ['p', target.pubkey]],
    content: kind === 7 ? '+' : JSON.stringify(target),
    sig: 'd'.repeat(128)
  };
}

function emptyActions() {
  return {
    liked: new Set<string>(),
    reposted: new Set<string>(),
    likeEvents: new Map<string, NostrEvent>(),
    repostEvents: new Map<string, NostrEvent>()
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function setSignedIn(pubkey = 'c'.repeat(64)) {
  session.set({ pubkey, mode: 'private-key', secret: 'nsec' } satisfies Session);
}

describe('app action optimism', () => {
  beforeEach(() => {
    clientMocks.fetchUserEventActions.mockReset();
    clientMocks.publishReaction.mockReset();
    clientMocks.publishRepost.mockReset();
    clientMocks.publishDeletion.mockReset();
    eventStats.set({});
    events.set([]);
    deletedEventIds.set(new Set());
    likedEvents.set(new Set());
    repostedEvents.set(new Set());
    setSignedIn();
  });

  it('marks likes locally before relay lookup and publish finish', async () => {
    const target = note('1'.repeat(64));
    const lookup = deferred<ReturnType<typeof emptyActions>>();
    const publish = deferred<NostrEvent>();
    clientMocks.fetchUserEventActions.mockReturnValueOnce(lookup.promise);
    clientMocks.publishReaction.mockReturnValueOnce(publish.promise);

    const action = reactToNote(target);

    expect(get(likedEvents).has(target.id)).toBe(true);
    expect(get(eventStats)[target.id].likes).toBe(1);
    expect(clientMocks.publishReaction).not.toHaveBeenCalled();

    lookup.resolve(emptyActions());
    await flushPromises();
    expect(clientMocks.publishReaction).toHaveBeenCalledTimes(1);

    publish.resolve(actionEvent('2'.repeat(64), target));
    await action;
  });

  it('does not double-count or double-publish a pending like', async () => {
    const target = note('3'.repeat(64));
    const lookup = deferred<ReturnType<typeof emptyActions>>();
    const publish = deferred<NostrEvent>();
    clientMocks.fetchUserEventActions.mockReturnValueOnce(lookup.promise);
    clientMocks.publishReaction.mockReturnValueOnce(publish.promise);

    const first = reactToNote(target);
    const second = reactToNote(target);

    expect(get(likedEvents).has(target.id)).toBe(true);
    expect(get(eventStats)[target.id].likes).toBe(1);

    lookup.resolve(emptyActions());
    await flushPromises();
    publish.resolve(actionEvent('4'.repeat(64), target));
    await Promise.all([first, second]);

    expect(clientMocks.publishReaction).toHaveBeenCalledTimes(1);
    expect(get(eventStats)[target.id].likes).toBe(1);
  });

  it('does not publish a duplicate like when the relay already has one', async () => {
    const target = note('5'.repeat(64));
    const existing = actionEvent('6'.repeat(64), target);
    clientMocks.fetchUserEventActions.mockResolvedValueOnce({
      ...emptyActions(),
      liked: new Set([target.id]),
      likeEvents: new Map([[target.id, existing]])
    });

    await reactToNote(target);

    expect(get(likedEvents).has(target.id)).toBe(true);
    expect(get(eventStats)[target.id].likes).toBe(1);
    expect(clientMocks.publishReaction).not.toHaveBeenCalled();
  });

  it('marks reposts locally before relay lookup and publish finish', async () => {
    const target = note('7'.repeat(64));
    const lookup = deferred<ReturnType<typeof emptyActions>>();
    const publish = deferred<NostrEvent>();
    clientMocks.fetchUserEventActions.mockReturnValueOnce(lookup.promise);
    clientMocks.publishRepost.mockReturnValueOnce(publish.promise);

    const action = repostNote(target);

    expect(get(repostedEvents).has(target.id)).toBe(true);
    expect(get(eventStats)[target.id].reposts).toBe(1);
    expect(clientMocks.publishRepost).not.toHaveBeenCalled();

    lookup.resolve(emptyActions());
    await flushPromises();
    expect(clientMocks.publishRepost).toHaveBeenCalledTimes(1);

    publish.resolve(actionEvent('8'.repeat(64), target, 'c'.repeat(64), 6));
    await action;
  });

  it('publishes a deletion when undoing a repost with a known repost event', async () => {
    const target = note('9'.repeat(64));
    const repost = actionEvent('a'.repeat(64), target, 'c'.repeat(64), 6);
    clientMocks.fetchUserEventActions.mockResolvedValueOnce({
      ...emptyActions(),
      reposted: new Set([target.id]),
      repostEvents: new Map([[target.id, repost]])
    });
    await repostNote(target);

    expect(get(repostedEvents).has(target.id)).toBe(true);

    await repostNote(target);

    expect(get(repostedEvents).has(target.id)).toBe(false);
    expect(clientMocks.publishDeletion).toHaveBeenCalledWith(expect.objectContaining({ pubkey: 'c'.repeat(64) }), repost, expect.any(Array), 'Unreposted by author');
  });

  it('can undo a newly published repost without another relay lookup', async () => {
    const target = note('b'.repeat(64));
    const repost = actionEvent('c'.repeat(64), target, 'c'.repeat(64), 6);
    clientMocks.fetchUserEventActions.mockResolvedValueOnce(emptyActions());
    clientMocks.publishRepost.mockResolvedValueOnce(repost);

    await repostNote(target);
    expect(get(repostedEvents).has(target.id)).toBe(true);

    await repostNote(target);

    expect(clientMocks.fetchUserEventActions).toHaveBeenCalledTimes(1);
    expect(get(repostedEvents).has(target.id)).toBe(false);
    expect(get(events).some((event) => event.id === repost.id)).toBe(false);
    expect(get(deletedEventIds).has(repost.id)).toBe(true);
    expect(clientMocks.publishDeletion).toHaveBeenCalledWith(expect.objectContaining({ pubkey: 'c'.repeat(64) }), repost, expect.any(Array), 'Unreposted by author');
  });
});
