<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import ThreadReplyTree from '$lib/components/ThreadReplyTree.svelte';
  import { getCachedThreadEvents } from '$lib/nostr/cache';
  import { deletedEventIds, eventStats, events, mergeEvents, mergeProfileRecords, profiles, refreshEventStats, relays } from '$lib/stores/app';
  import { eventStatsFromEvents, fetchMissingEvents, fetchProfiles, fetchThreadReplies } from '$lib/nostr/client';
  import { eventPointerFromIdentifier } from '$lib/nostr/identifiers';
  import { appPath } from '$lib/paths';
  import { readRouteScrollState, saveRouteScrollState } from '$lib/stores/routeScroll';
  import { readThreadReturnTarget } from '$lib/stores/threadNavigation';
  import { readPrefetchedThreadReplies, readThreadSeed } from '$lib/stores/threadSeed';
  import { timelineCursor, windowTimelineItems } from '$lib/timeline/window';
  import type { TimelineTrimEdge } from '$lib/timeline/window';
  import type { NostrEvent } from '$lib/nostr/types';

  const initialThreadReplyLimit = 40;
  const nestedThreadReplyLimit = 80;
  const threadReplyPageLimit = 40;
  const maxThreadReplies = 160;
  const threadScrollStateMaxAgeMs = 30 * 60 * 1000;

  let loading = true;
  let loadingNewerReplies = false;
  let loadingOlderReplies = false;
  let hasOlderReplies = true;
  let hydratedId = '';
  let seededId = '';
  let rootEvent: NostrEvent | undefined;
  let localThreadEvents: NostrEvent[] = [];
  let topSentinel: HTMLDivElement;
  let bottomSentinel: HTMLDivElement;
  let topObserver: IntersectionObserver | undefined;
  let bottomObserver: IntersectionObserver | undefined;
  let restoredThreadRouteKey = '';

  $: routeId = decodeURIComponent($page.params.id ?? '');
  $: pointer = eventPointerFromIdentifier(routeId);
  $: id = pointer?.id ?? routeId;
  $: focusedReplyId = $page.url.searchParams.get('focus') ?? '';
  $: routeKey = currentThreadRouteKey();
  $: backHref = (id && readThreadReturnTarget(id)) || appPath('/');
  $: if (id && id !== seededId) seedThreadFromCache(id, focusedReplyId);
  $: threadEvents = mergeThreadEvents(rootEvent ? [rootEvent, ...localThreadEvents] : localThreadEvents, []);
  $: root = rootEvent?.id === id ? rootEvent : threadEvents.find((event) => event.id === id);
  $: replies = id ? threadReplyEvents(threadEvents, id) : [];
  $: repliesByParent = id ? groupRepliesByParent(replies, id) : {};
  $: if (browser && routeKey && root && routeKey !== restoredThreadRouteKey) void restoreThreadScrollPosition(routeKey);

  beforeNavigate(() => {
    saveCurrentThreadScrollPosition();
  });

  onMount(() => {
    topObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadNewerThreadReplies();
      },
      { rootMargin: '260px 0px 0px 0px' }
    );
    bottomObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadOlderThreadReplies();
      },
      { rootMargin: '0px 0px 420px 0px' }
    );
    if (topSentinel) topObserver.observe(topSentinel);
    if (bottomSentinel) bottomObserver.observe(bottomSentinel);
    void hydrateThread();
    void restoreThreadScrollPosition(routeKey);
  });

  onDestroy(() => {
    saveCurrentThreadScrollPosition();
    topObserver?.disconnect();
    bottomObserver?.disconnect();
  });

  $: if (browser && id && id !== hydratedId) void hydrateThread();
  $: if (browser && topObserver && topSentinel) topObserver.observe(topSentinel);
  $: if (browser && bottomObserver && bottomSentinel) bottomObserver.observe(bottomSentinel);

  function mergeThreadEvents(incoming: NostrEvent[], existing: NostrEvent[]) {
    const byId = new Map<string, NostrEvent>();
    [...existing, ...incoming].forEach((event) => byId.set(event.id, event));
    return [...byId.values()].filter((event) => !$deletedEventIds.has(event.id)).sort((a, b) => b.created_at - a.created_at);
  }

  function threadReplyEvents(items: NostrEvent[], rootId: string) {
    const candidates = items.filter((event) => event.id !== rootId && event.kind === 1 && event.tags.some((tag) => tag[0] === 'e' && tag[1]));
    const included = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const event of candidates) {
        if (included.has(event.id)) continue;
        const parent = replyParentId(event, rootId);
        if (parent === rootId || included.has(parent)) {
          included.add(event.id);
          changed = true;
        }
      }
    }
    return candidates.filter((event) => included.has(event.id));
  }

  function groupRepliesByParent(items: NostrEvent[], rootId: string) {
    const byParent: Record<string, NostrEvent[]> = {};
    for (const event of items) {
      const parent = replyParentId(event, rootId);
      if (!parent) continue;
      byParent[parent] = [...(byParent[parent] ?? []), event];
    }
    Object.values(byParent).forEach((events) => events.sort((a, b) => b.created_at - a.created_at));
    return byParent;
  }

  function replyParentId(event: NostrEvent, rootId: string) {
    const replyTag = [...event.tags].reverse().find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'reply');
    if (replyTag?.[1]) return replyTag[1];
    const eTags = event.tags.filter((tag) => tag[0] === 'e' && tag[1]);
    const nonRoot = [...eTags].reverse().find((tag) => tag[1] !== rootId);
    return nonRoot?.[1] ?? (eTags.some((tag) => tag[1] === rootId) ? rootId : '');
  }

  async function hydrateThread() {
    if (!id || hydratedId === id) return;
    hydratedId = id;
    seedThreadFromCache(id, focusedReplyId);
    hasOlderReplies = true;
    loading = true;
    try {
      const cached = $events.find((event) => event.id === id);
      const [found] = cached ? [cached] : await fetchMissingEvents([id], $relays, pointer?.relays ?? []).catch(() => []);
      if (found) {
        rootEvent = found;
        localThreadEvents = mergeThreadEvents([found], localThreadEvents).filter((event) => event.id !== found.id);
        events.update((existing) => mergeEvents([found], existing));
      }
      if (rootEvent) refreshThreadStats([rootEvent]);
      void hydrateCachedThreadReplies();

      const directReplies = await fetchDirectThreadReplies({ limit: initialThreadReplyLimit });
      if (directReplies.length) {
        localThreadEvents = mergeThreadEvents(directReplies, localThreadEvents);
        trimThreadReplyWindow('bottom');
        hydrateThreadProfiles(directReplies);
        refreshThreadStats(directReplies);
      }

      const nestedReplies = await fetchNestedThreadReplies(directReplies);
      if (nestedReplies.length) {
        localThreadEvents = mergeThreadEvents(nestedReplies, localThreadEvents);
        trimThreadReplyWindow('bottom');
        hydrateThreadProfiles(nestedReplies);
        refreshThreadStats(nestedReplies);
      }
    } finally {
      loading = false;
    }
  }

  async function hydrateCachedThreadReplies() {
    if (!id) return;
    const cached = mergeThreadEvents(await getCachedThreadEvents(id, maxThreadReplies).catch(() => []), []);
    if (!cached.length) return;
    localThreadEvents = mergeThreadEvents(cached.filter((event) => event.id !== id), localThreadEvents);
    const cachedRoot = cached.find((event) => event.id === id);
    if (cachedRoot && !rootEvent) rootEvent = cachedRoot;
    trimThreadReplyWindow('bottom');
    hydrateThreadProfiles(cached);
    refreshThreadStats(cached);
  }

  async function fetchDirectThreadReplies(options: { limit?: number; since?: number; until?: number } = {}) {
    if (!id) return [];
    return fetchThreadReplies(id, $relays, options.limit ?? threadReplyPageLimit, {
      since: options.since,
      until: options.until
    }).catch(() => []);
  }

  async function fetchNestedThreadReplies(parentReplies: NostrEvent[]) {
    return parentReplies.length
      ? fetchThreadReplies(
          parentReplies.map((event) => event.id),
          $relays,
          nestedThreadReplyLimit
        ).catch(() => [])
      : [];
  }

  async function fetchThreadReplyPage(options: { limit?: number; since?: number; until?: number } = {}) {
    if (!id) return [];
    const fetchedReplies = await fetchDirectThreadReplies(options);
    const nestedReplies = await fetchNestedThreadReplies(fetchedReplies);
    return mergeThreadEvents(nestedReplies, fetchedReplies).filter((event) => event.id !== id);
  }

  async function loadNewerThreadReplies() {
    if (!id || loading || loadingNewerReplies || !replies.length) return;
    const newest = timelineCursor(replies, 'newest');
    if (!newest) return;
    const beforeHeight = document.documentElement.scrollHeight;
    loadingNewerReplies = true;
    try {
      const nextReplies = await fetchThreadReplyPage({ since: newest + 1 });
      if (!nextReplies.length) return;
      localThreadEvents = mergeThreadEvents(nextReplies, localThreadEvents);
      trimThreadReplyWindow('bottom');
      hydrateThreadProfiles(nextReplies);
      refreshThreadStats(nextReplies);
      await preserveScrollAfterTopMutation(beforeHeight);
    } finally {
      loadingNewerReplies = false;
    }
  }

  async function loadOlderThreadReplies() {
    if (!id || loading || loadingOlderReplies || !hasOlderReplies) return;
    const oldest = timelineCursor(replies, 'oldest');
    if (!oldest) return;
    loadingOlderReplies = true;
    try {
      const nextReplies = await fetchThreadReplyPage({ until: oldest - 1 });
      if (!nextReplies.length) {
        hasOlderReplies = false;
        return;
      }
      localThreadEvents = mergeThreadEvents(nextReplies, localThreadEvents);
      trimThreadReplyWindow('top');
      hydrateThreadProfiles(nextReplies);
      refreshThreadStats(nextReplies);
    } finally {
      loadingOlderReplies = false;
    }
  }

  function cachedThreadSeed(rootId: string, focusId: string) {
    const directSeed = readThreadSeed(rootId);
    const prefetchedReplies = readPrefetchedThreadReplies(rootId);
    return mergeThreadEvents(
      [...(directSeed ? [directSeed] : []), ...prefetchedReplies, ...$events.filter((event) => event.id === rootId || (focusId && event.id === focusId))],
      []
    );
  }

  function seedThreadFromCache(rootId: string, focusId: string) {
    seededId = rootId;
    localThreadEvents = cachedThreadSeed(rootId, focusId);
    rootEvent = localThreadEvents.find((event) => event.id === rootId);
  }

  function trimThreadReplyWindow(trimFrom: 'top' | 'bottom') {
    const rootId = rootEvent?.id ?? id;
    const rootItems = localThreadEvents.filter((event) => event.id === rootId);
    const replyItems = localThreadEvents.filter((event) => event.id !== rootId);
    const { visible } = windowTimelineItems(replyItems, maxThreadReplies, trimFrom, trimThreadRepliesWithContext);
    localThreadEvents = mergeThreadEvents([...rootItems, ...visible], []);
  }

  function trimThreadRepliesWithContext(items: NostrEvent[], limit: number, trimEdge: TimelineTrimEdge) {
    const sortedNewestFirst = [...items].sort((a, b) => b.created_at - a.created_at);
    const core = trimEdge === 'bottom' ? sortedNewestFirst.slice(0, limit) : sortedNewestFirst.slice(-limit);
    const byId = new Map(items.map((event) => [event.id, event]));
    const kept = new Map(core.map((event) => [event.id, event]));

    for (const event of core) {
      let parentId = replyParentId(event, rootEvent?.id ?? id);
      while (parentId && parentId !== (rootEvent?.id ?? id)) {
        const parent = byId.get(parentId);
        if (!parent || kept.has(parent.id)) break;
        kept.set(parent.id, parent);
        parentId = replyParentId(parent, rootEvent?.id ?? id);
      }
    }

    return mergeThreadEvents([...kept.values()], []);
  }

  async function preserveScrollAfterTopMutation(beforeHeight: number) {
    if (!browser) return;
    await tick();
    const heightDelta = document.documentElement.scrollHeight - beforeHeight;
    if (heightDelta > 0) window.scrollBy({ top: heightDelta, left: 0, behavior: 'instant' });
  }

  function currentThreadRouteKey() {
    if (!browser) return '';
    return `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
  }

  function saveCurrentThreadScrollPosition() {
    if (!browser || !routeKey) return;
    const anchor = firstVisibleThreadNote();
    saveRouteScrollState(routeKey, {
      scrollY: window.scrollY,
      anchorId: anchor?.dataset.noteId,
      anchorOffset: anchor?.getBoundingClientRect().top
    });
  }

  async function restoreThreadScrollPosition(nextRouteKey: string) {
    if (!browser || !nextRouteKey || restoredThreadRouteKey === nextRouteKey) return;
    const state = readRouteScrollState(nextRouteKey);
    if (!state || Date.now() - state.savedAt > threadScrollStateMaxAgeMs) {
      restoredThreadRouteKey = nextRouteKey;
      return;
    }
    restoredThreadRouteKey = nextRouteKey;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await tick();
      await nextAnimationFrame();
      const anchor = state.anchorId ? document.querySelector<HTMLElement>(`.thread-page [data-note-id="${state.anchorId}"]`) : null;
      if (anchor) {
        const top = window.scrollY + anchor.getBoundingClientRect().top - (state.anchorOffset ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
      } else {
        window.scrollTo({ top: state.scrollY, left: 0, behavior: 'instant' });
      }
    }
  }

  function firstVisibleThreadNote() {
    if (!browser) return undefined;
    return [...document.querySelectorAll<HTMLElement>('.thread-page [data-note-id]')].find((element) => element.getBoundingClientRect().bottom > 0);
  }

  function nextAnimationFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function hydrateThreadProfiles(threadItems: NostrEvent[]) {
    const missingPubkeys = [...new Set(threadItems.map((event) => event.pubkey).filter((pubkey) => !$profiles[pubkey]))];
    if (!missingPubkeys.length) return;
    const fetchedProfiles = await fetchProfiles(missingPubkeys, $relays).catch(() => []);
    if (fetchedProfiles.length) profiles.update((existing) => mergeProfileRecords(existing, fetchedProfiles));
  }

  function refreshThreadStats(threadItems: NostrEvent[]) {
    const statIds = [...new Set(threadItems.map((event) => event.id))];
    if (!statIds.length) return;

    const localStats = eventStatsFromEvents(statIds, threadItems);
    eventStats.update((existing) => {
      const next = { ...existing };
      for (const id of statIds) {
        const existingStats = next[id] ?? { replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 };
        const loadedStats = localStats[id] ?? existingStats;
        next[id] = {
          replies: Math.max(existingStats.replies, loadedStats.replies),
          reposts: Math.max(existingStats.reposts, loadedStats.reposts),
          likes: Math.max(existingStats.likes, loadedStats.likes),
          zaps: Math.max(existingStats.zaps, loadedStats.zaps),
          zapSats: Math.max(existingStats.zapSats, loadedStats.zapSats),
          dislikes: Math.max(existingStats.dislikes, loadedStats.dislikes),
          emoji: Math.max(existingStats.emoji, loadedStats.emoji)
        };
      }
      return next;
    });
    void refreshEventStats(statIds, true);
  }
</script>

<section class="thread-page">
  <a class="page-back" href={backHref} aria-label="Back"><ArrowLeft size={18} /> Back</a>
  <div class="thread-load-sentinel" bind:this={topSentinel} aria-live="polite">
    {#if loadingNewerReplies}<span>Loading newer replies</span>{/if}
  </div>

  {#if root}
    <div class="feed-list">
      <NoteCard event={root} profile={$profiles[root.pubkey]} />
      {#if replies.length}
        <ThreadReplyTree parentId={root.id} {repliesByParent} profiles={$profiles} focusedId={focusedReplyId} />
      {:else if loading}
        <div class="empty-state"><span>Loading replies</span></div>
      {:else}
        <div class="empty-state"><strong>No replies found yet</strong><span>Relays did not return replies for this thread.</span></div>
      {/if}
    </div>
    <div class="thread-load-sentinel" bind:this={bottomSentinel} aria-live="polite">
      {#if loadingOlderReplies}
        <span>Loading older replies</span>
      {:else if hasOlderReplies && replies.length}
        <span>Scroll down for older replies</span>
      {/if}
    </div>
  {:else if loading}
    <div class="empty-state"><span>Loading thread</span></div>
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
