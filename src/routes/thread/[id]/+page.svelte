<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { getCachedThreadEvents } from '$lib/nostr/cache';
  import { deletedEventIds, eventStats, events, mergeEvents, mergeProfileRecords, profiles, refreshEventStats, relays } from '$lib/stores/app';
  import { eventStatsFromEvents, fetchMissingEvents, fetchProfiles, fetchThreadReplies } from '$lib/nostr/client';
  import { eventPointerFromIdentifier } from '$lib/nostr/identifiers';
  import { appPath } from '$lib/paths';
  import { readRouteScrollState, saveRouteScrollState } from '$lib/stores/routeScroll';
  import { currentThreadReturnTarget, readThreadReturnTarget, saveThreadReturnTarget } from '$lib/stores/threadNavigation';
  import { readHydratedThread, readPrefetchedThreadReplies, readThreadSeed, saveHydratedThread, saveThreadSeed } from '$lib/stores/threadSeed';
  import { timelineCursor, windowTimelineItems } from '$lib/timeline/window';
  import type { TimelineTrimEdge } from '$lib/timeline/window';
  import type { NostrEvent } from '$lib/nostr/types';

  const initialThreadReplyLimit = 40;
  const nestedThreadReplyLimit = 80;
  const threadReplyPageLimit = 40;
  const maxThreadReplies = 160;
  const threadScrollStateMaxAgeMs = 30 * 60 * 1000;
  const threadReplyWindowSeconds = 60 * 60 * 24 * 30;
  const threadReplyWindowScanLimit = 6;

  let loading = true;
  let loadingOlderReplies = false;
  let hasOlderReplies = true;
  let olderThreadReplyCursor = 0;
  let hydratedId = '';
  let seededId = '';
  let rootEvent: NostrEvent | undefined;
  let localThreadEvents: NostrEvent[] = [];
  let bottomSentinel: HTMLDivElement;
  let bottomObserver: IntersectionObserver | undefined;
  let restoredThreadRouteKey = '';
  let focusedThreadRouteKey = '';
  let activeRouteId = '';
  let hydrationRunId = 0;

  $: routeId = decodeURIComponent($page.params.id ?? '');
  $: pointer = eventPointerFromIdentifier(routeId);
  $: id = pointer?.id ?? routeId;
  $: focusedReplyId = $page.url.searchParams.get('focus') ?? '';
  $: routeKey = currentThreadRouteKey();
  $: backHref = (id && readThreadReturnTarget(id)) || appPath('/');
  $: if (id && id !== activeRouteId) {
    saveCurrentThreadState();
    resetThreadRouteState(id, focusedReplyId);
  }
  $: if (id && id !== seededId && !readHydratedThread(id)) seedThreadFromCache(id, focusedReplyId);
  $: threadEvents = mergeThreadEvents(rootEvent ? [rootEvent, ...localThreadEvents] : localThreadEvents, []);
  $: root = rootEvent?.id === id ? rootEvent : threadEvents.find((event) => event.id === id);
  $: replies = id ? threadReplyEvents(threadEvents, id) : [];
  $: sortedReplies = [...replies].sort((a, b) => a.created_at - b.created_at);
  $: hiddenThreadQuoteIds = id ? sameThreadQuotedNoteIds(id, threadEvents) : [];
  $: if (browser && routeKey && root && routeKey !== restoredThreadRouteKey) void restoreThreadScrollPosition(routeKey);
  $: if (browser && routeKey && focusedReplyId && sortedReplies.some((reply) => reply.id === focusedReplyId) && `${routeKey}:${focusedReplyId}` !== focusedThreadRouteKey) {
    void scrollFocusedReplyIntoView(routeKey, focusedReplyId);
  }

  beforeNavigate(() => {
    saveCurrentThreadState();
    saveCurrentThreadScrollPosition();
  });

  onMount(() => {
    bottomObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadOlderThreadReplies();
      },
      { rootMargin: '0px 0px 420px 0px' }
    );
    if (bottomSentinel) bottomObserver.observe(bottomSentinel);
    void hydrateThread();
    void restoreThreadScrollPosition(routeKey);
  });

  onDestroy(() => {
    saveCurrentThreadState();
    saveCurrentThreadScrollPosition();
    bottomObserver?.disconnect();
  });

  $: if (browser && id && id !== hydratedId) void hydrateThread();
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

  function replyParentId(event: NostrEvent, rootId: string) {
    const replyTag = [...event.tags].reverse().find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'reply');
    if (replyTag?.[1]) return replyTag[1];
    const eTags = event.tags.filter((tag) => tag[0] === 'e' && tag[1]);
    const nonRoot = [...eTags].reverse().find((tag) => tag[1] !== rootId);
    return nonRoot?.[1] ?? (eTags.some((tag) => tag[1] === rootId) ? rootId : '');
  }

  async function hydrateThread() {
    if (!id || hydratedId === id) return;
    const rootId = id;
    const runId = ++hydrationRunId;
    hydratedId = rootId;
    const restored = restoreHydratedThread(rootId);
    if (restored) {
      loading = false;
    } else {
      seedThreadFromCache(rootId, focusedReplyId);
      hasOlderReplies = true;
      olderThreadReplyCursor = 0;
      loading = true;
    }
    try {
      const cached = $events.find((event) => event.id === rootId);
      const [found] = cached ? [cached] : await fetchMissingEvents([rootId], $relays, pointer?.relays ?? []).catch(() => []);
      if (!isCurrentHydration(rootId, runId)) return;
      if (found) {
        rootEvent = found;
        localThreadEvents = mergeThreadEvents([found], localThreadEvents).filter((event) => event.id !== found.id);
        events.update((existing) => mergeEvents([found], existing));
      }
      if (rootEvent) refreshThreadStats([rootEvent]);
      if (!restored) void hydrateCachedThreadReplies(rootId, runId);
      await hydrateFocusedReplyContext(rootId, runId);

      const replyBatch =
        restored && rootEvent
          ? await fetchLatestThreadReplyBatch(rootId, initialThreadReplyLimit)
          : rootEvent
            ? await fetchForwardThreadReplyBatch(rootEvent.created_at, initialThreadReplyLimit)
            : await fetchThreadReplyWindow({ limit: initialThreadReplyLimit });
      if (!isCurrentHydration(rootId, runId)) return;
      if ('cursor' in replyBatch) {
        olderThreadReplyCursor = replyBatch.cursor;
        hasOlderReplies = replyBatch.hasMore;
      } else if (!restored) {
        olderThreadReplyCursor = nextThreadForwardCursor(replyBatch.events, 0);
        hasOlderReplies = Boolean(rootEvent && replyBatch.directCount >= initialThreadReplyLimit);
      }
      if (replyBatch.events.length) {
        localThreadEvents = mergeThreadEvents(replyBatch.events, localThreadEvents);
        trimThreadReplyWindow('bottom');
        hydrateThreadProfiles(replyBatch.events);
        refreshThreadStats(replyBatch.events);
        saveCurrentThreadState();
      }
    } finally {
      if (isCurrentHydration(rootId, runId)) {
        loading = false;
        saveCurrentThreadState();
      }
    }
  }

  function isCurrentHydration(rootId: string, runId: number) {
    return id === rootId && hydrationRunId === runId;
  }

  async function hydrateCachedThreadReplies(rootId: string, runId: number) {
    const cached = mergeThreadEvents(await getCachedThreadEvents(rootId, maxThreadReplies).catch(() => []), []);
    if (!isCurrentHydration(rootId, runId)) return;
    if (!cached.length) return;
    localThreadEvents = mergeThreadEvents(cached.filter((event) => event.id !== rootId), localThreadEvents);
    const cachedRoot = cached.find((event) => event.id === rootId);
    if (cachedRoot && !rootEvent) rootEvent = cachedRoot;
    trimThreadReplyWindow('bottom');
    hydrateThreadProfiles(cached);
    refreshThreadStats(cached);
    saveCurrentThreadState();
  }

  async function fetchDirectThreadReplies(rootId: string, options: { limit?: number; since?: number; until?: number } = {}) {
    return fetchThreadReplies(rootId, $relays, options.limit ?? threadReplyPageLimit, {
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

  async function fetchThreadReplyWindow(options: { limit?: number; since?: number; until?: number } = {}) {
    if (!id) return { events: [], directCount: 0 };
    const rootId = id;
    const fetchedReplies = await fetchDirectThreadReplies(rootId, options);
    if (id !== rootId) return { events: [], directCount: 0 };
    const nestedReplies = await fetchNestedThreadReplies(fetchedReplies);
    if (id !== rootId) return { events: [], directCount: 0 };
    return { events: mergeThreadEvents(nestedReplies, fetchedReplies).filter((event) => event.id !== rootId), directCount: fetchedReplies.length };
  }

  async function fetchForwardThreadReplyBatch(cursorStart: number, limit: number) {
    const nextReplies: NostrEvent[] = [];
    let cursor = cursorStart;
    let scannedWindows = 0;
    const upperBound = nowSeconds();

    while (cursor < upperBound && nextReplies.length < limit && scannedWindows < threadReplyWindowScanLimit) {
      const windowUpper = Math.min(upperBound, cursor + threadReplyWindowSeconds);
      const requestLimit = limit - nextReplies.length;
      const { events: fetchedReplies, directCount } = await fetchThreadReplyWindow({
        limit: requestLimit,
        since: cursor + 1,
        until: windowUpper
      });
      nextReplies.push(...fetchedReplies);
      if (directCount >= requestLimit) {
        cursor = nextThreadForwardCursor(fetchedReplies, cursor);
        break;
      }
      cursor = windowUpper;
      scannedWindows += 1;
    }

    return { events: mergeThreadEvents(nextReplies, []), cursor, hasMore: cursor < upperBound };
  }

  async function fetchLatestThreadReplyBatch(rootId: string, limit: number) {
    const loadedReplies = threadReplyEvents(threadEventsForCache(), rootId);
    const newestLoadedReply = timelineCursor(loadedReplies, 'newest');
    return fetchThreadReplyWindow({
      limit,
      since: newestLoadedReply ? newestLoadedReply + 1 : rootEvent?.created_at
    });
  }

  async function loadOlderThreadReplies() {
    if (!id || loading || loadingOlderReplies || !hasOlderReplies) return;
    const cursorStart = olderThreadReplyCursor || timelineCursor(replies, 'newest') || rootEvent?.created_at;
    if (!cursorStart) return;
    loadingOlderReplies = true;
    try {
      const replyBatch = await fetchForwardThreadReplyBatch(cursorStart, threadReplyPageLimit);
      olderThreadReplyCursor = replyBatch.cursor;
      hasOlderReplies = replyBatch.hasMore;
      if (!replyBatch.events.length) {
        return;
      }
      localThreadEvents = mergeThreadEvents(replyBatch.events, localThreadEvents);
      trimThreadReplyWindow('bottom');
      hydrateThreadProfiles(replyBatch.events);
      refreshThreadStats(replyBatch.events);
      saveCurrentThreadState();
    } finally {
      loadingOlderReplies = false;
    }
  }

  function cachedThreadSeed(rootId: string, focusId: string) {
    const directSeed = readThreadSeed(rootId);
    const focusSeed = focusId && focusId !== rootId ? readThreadSeed(focusId) : null;
    const prefetchedReplies = readPrefetchedThreadReplies(rootId);
    return mergeThreadEvents(
      [
        ...(directSeed ? [directSeed] : []),
        ...(focusSeed ? [focusSeed] : []),
        ...prefetchedReplies,
        ...$events.filter((event) => event.id === rootId || (focusId && event.id === focusId))
      ],
      []
    );
  }

  function seedThreadFromCache(rootId: string, focusId: string) {
    seededId = rootId;
    localThreadEvents = cachedThreadSeed(rootId, focusId);
    rootEvent = localThreadEvents.find((event) => event.id === rootId);
  }

  function resetThreadRouteState(nextId: string, focusId: string) {
    activeRouteId = nextId;
    hydrationRunId += 1;
    hydratedId = '';
    seededId = '';
    restoredThreadRouteKey = '';
    focusedThreadRouteKey = '';
    rootEvent = undefined;
    localThreadEvents = [];
    loading = true;
    loadingOlderReplies = false;
    hasOlderReplies = true;
    olderThreadReplyCursor = 0;
    if (restoreHydratedThread(nextId)) {
      loading = false;
      return;
    }
    seedThreadFromCache(nextId, focusId);
    loading = !rootEvent;
  }

  function restoreHydratedThread(rootId: string) {
    const cached = readHydratedThread(rootId);
    if (!cached?.events.length) return false;
    const cachedRoot = cached.events.find((event) => event.id === rootId);
    if (!cachedRoot) return false;
    seededId = rootId;
    rootEvent = cachedRoot;
    localThreadEvents = mergeThreadEvents(
      cached.events.filter((event) => event.id !== rootId),
      localThreadEvents.filter((event) => event.id !== rootId)
    );
    hasOlderReplies = cached.hasOlderReplies;
    olderThreadReplyCursor = 0;
    hydrateThreadProfiles(cached.events);
    return true;
  }

  async function hydrateFocusedReplyContext(rootId: string, runId: number) {
    if (!focusedReplyId || focusedReplyId === rootId) return;
    const byId = new Map(threadEventsForCache().map((event) => [event.id, event]));
    let focus = byId.get(focusedReplyId) ?? readThreadSeed(focusedReplyId) ?? null;

    if (!focus) {
      [focus] = await fetchMissingEvents([focusedReplyId], $relays).catch(() => []);
      if (!isCurrentHydration(rootId, runId)) return;
    }
    if (!focus) return;

    const context = [focus];
    byId.set(focus.id, focus);
    let current = focus;
    for (let depth = 0; depth < 8; depth += 1) {
      const parentId = replyParentId(current, rootId);
      if (!parentId || parentId === rootId || byId.has(parentId)) break;
      const [parent] = await fetchMissingEvents([parentId], $relays).catch(() => []);
      if (!isCurrentHydration(rootId, runId)) return;
      if (!parent) break;
      context.push(parent);
      byId.set(parent.id, parent);
      current = parent;
    }

    localThreadEvents = mergeThreadEvents(context.filter((event) => event.id !== rootId), localThreadEvents);
    hydrateThreadProfiles(context);
    refreshThreadStats(context);
    saveCurrentThreadState();
  }

  function saveCurrentThreadState() {
    if (!rootEvent) return;
    const threadItems = threadEventsForCache();
    saveHydratedThread(rootEvent.id, threadItems, hasOlderReplies);
    saveThreadStateToReturnChain(rootEvent.id, threadItems);
  }

  function openThreadNote(event: NostrEvent) {
    if (!browser) return;
    const threadPath = appPath(`/thread/${event.id}`);
    if ($page.url.pathname === threadPath) return;
    const currentItems = threadEventsForCache();
    const childItems = threadEventsForRoot(event.id, mergeThreadEvents([event], currentItems));
    saveCurrentThreadState();
    saveCurrentThreadScrollPosition();
    saveThreadSeed(event);
    saveHydratedThread(event.id, childItems, true);
    saveThreadReturnTarget(event.id, currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash));
    void goto(threadPath);
  }

  function threadEventsForCache() {
    return mergeThreadEvents(rootEvent ? [rootEvent, ...localThreadEvents] : localThreadEvents, []);
  }

  function saveThreadStateToReturnChain(currentRootId: string, threadItems: NostrEvent[]) {
    let parentId = threadIdFromTarget(readThreadReturnTarget(currentRootId));
    const visited = new Set([currentRootId]);

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parentRoot = readThreadSeed(parentId) ?? readHydratedThread(parentId)?.events.find((event) => event.id === parentId);
      saveHydratedThread(parentId, mergeThreadEvents(parentRoot ? [parentRoot, ...threadItems] : threadItems, []), true);
      parentId = threadIdFromTarget(readThreadReturnTarget(parentId));
    }
  }

  function threadEventsForRoot(rootId: string, items: NostrEvent[]) {
    const rootItem = items.find((event) => event.id === rootId);
    return mergeThreadEvents([...(rootItem ? [rootItem] : []), ...threadReplyEvents(items, rootId)], []);
  }

  function sameThreadQuotedNoteIds(rootId: string, items: NostrEvent[]) {
    const ids = new Set(items.map((event) => event.id));
    ids.add(rootId);

    let parentId = threadIdFromTarget(readThreadReturnTarget(rootId));
    const visited = new Set([rootId]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      ids.add(parentId);
      for (const event of readHydratedThread(parentId)?.events ?? []) ids.add(event.id);
      parentId = threadIdFromTarget(readThreadReturnTarget(parentId));
    }

    return [...ids];
  }

  function threadIdFromTarget(target: string) {
    try {
      const parsed = new URL(target, 'http://local');
      const match = parsed.pathname.match(/\/thread\/([^/]+)/);
      const targetId = match?.[1] ? (eventPointerFromIdentifier(decodeURIComponent(match[1]))?.id ?? decodeURIComponent(match[1])) : '';
      return /^[0-9a-f]{64}$/i.test(targetId) ? targetId : '';
    } catch {
      return '';
    }
  }

  function nextThreadForwardCursor(nextEvents: NostrEvent[], fallback: number) {
    if (!nextEvents.length) return fallback;
    return Math.max(fallback, Math.max(...nextEvents.map((event) => event.created_at)));
  }

  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
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

  async function scrollFocusedReplyIntoView(nextRouteKey: string, replyId: string) {
    focusedThreadRouteKey = `${nextRouteKey}:${replyId}`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await tick();
      await nextAnimationFrame();
      if (`${routeKey}:${focusedReplyId}` !== focusedThreadRouteKey) return;
      const anchor = document.querySelector<HTMLElement>(`.thread-page [data-note-id="${replyId}"]`);
      if (!anchor) continue;
      anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      return;
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

  {#if root}
    <div class="feed-list">
      <NoteCard event={root} profile={$profiles[root.pubkey]} hiddenQuotedNoteIds={hiddenThreadQuoteIds} onOpen={openThreadNote} />
      {#if replies.length}
        {#each sortedReplies as reply (reply.id)}
          <NoteCard event={reply} profile={$profiles[reply.pubkey]} featured={reply.id === focusedReplyId} hiddenQuotedNoteIds={hiddenThreadQuoteIds} onOpen={openThreadNote} />
        {/each}
      {:else if loading}
        <div class="empty-state"><span>Loading replies</span></div>
      {:else}
        <div class="empty-state"><strong>No replies found yet</strong><span>Relays did not return replies for this thread.</span></div>
      {/if}
    </div>
    <div class="thread-load-sentinel" bind:this={bottomSentinel} aria-live="polite">
      {#if loadingOlderReplies}
        <span>Loading more replies</span>
      {:else if hasOlderReplies && replies.length}
        <span>Scroll down for more replies</span>
      {/if}
    </div>
  {:else if loading}
    <div class="empty-state"><span>Loading thread</span></div>
  {:else}
    <div class="empty-state"><span>Loading thread</span></div>
  {/if}
</section>
