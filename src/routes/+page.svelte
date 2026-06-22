<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { beforeNavigate, goto } from '$app/navigation';
  import { ArrowUp, Plus } from '@lucide/svelte';
  import FeedSearchBar from '$lib/components/FeedSearchBar.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import {
    events,
    feedMode,
    follows,
    hasMoreFeed,
    loadingFeed,
    loadingMoreFeed,
    loadNewerFeed,
    loadMoreFeed,
    pendingNewerEvents,
    profiles,
    revealNewerFeed,
    relays,
    session,
    startCompose,
    activeHashtag,
    customFeedSettings,
    displayEventsForFeedMode
  } from '$lib/stores/app';
  import { topLevelFeedEvents } from '$lib/nostr/client';
  import { appPath } from '$lib/paths';
  import { readFeedScrollState, saveFeedScrollState } from '$lib/stores/feedScroll';
  import { currentThreadReturnTarget, saveThreadReturnTarget } from '$lib/stores/threadNavigation';
  import { saveThreadSeed } from '$lib/stores/threadSeed';
  import type { NostrEvent } from '$lib/nostr/types';

  let loadMoreSentinel: HTMLDivElement;
  let observer: IntersectionObserver | undefined;
  let previousScrollY = 0;
  let loadOlderArmed = false;
  let pullStartY = 0;
  let pullDistance = 0;
  let wheelPullRaw = 0;
  let wheelPullTimeout: ReturnType<typeof setTimeout> | undefined;
  let pullingNewer = false;
  let requestingOlder = false;
  let pullStartedAtTop = false;
  let hideNewerBubble = false;
  let hideNewerBubbleTimeout: ReturnType<typeof setTimeout> | undefined;
  let restoredFeedPosition = false;
  let clickedFeedNoteSaved = false;
  let autoFillRunning = false;
  let autoFillQueued = false;
  let autoFillTimer: ReturnType<typeof setTimeout> | undefined;
  const pullThreshold = 78;
  const newerBubbleCooldownMs = 5000;
  const feedScrollStateMaxAgeMs = 30 * 60 * 1000;
  const autoFillMaxLoads = 5;
  $: hasReadRelays = $relays.some((relay) => relay.enabled && relay.read);
  $: feedEvents = hashtagFilteredEvents(displayEventsForFeedMode($feedMode, topLevelFeedEvents($events), $follows, $customFeedSettings), $activeHashtag);
  $: if (observer && loadMoreSentinel && feedEvents.length) {
    observer.unobserve(loadMoreSentinel);
    observer.observe(loadMoreSentinel);
  }
  $: if (browser) scheduleFeedAutoFill();
  $: pullProgress = Math.min(1, pullDistance / pullThreshold);
  $: showNewerBubble = canLoadNewerForFeed() && $pendingNewerEvents.length && !pullingNewer && !hideNewerBubble && !pullStartedAtTop && pullDistance <= 0;
  $: emptyMessage = !hasReadRelays
    ? 'Please connect to relays'
    : $session && ($feedMode === 'follow' || ($feedMode === 'custom' && !customFeedHasKeywords($customFeedSettings))) && !$follows.length
      ? 'Please follow someone'
      : 'Please connect to relays';

  beforeNavigate(() => {
    if (!clickedFeedNoteSaved) saveCurrentFeedScrollPosition();
  });

  onMount(() => {
    const hashRoutes: Record<string, string> = {
      '#messages': '/messages',
      '#notifications': '/notifications',
      '#info': '/info'
    };
    const legacyRoute = hashRoutes[$page.url.hash];
    if (legacyRoute) {
      void goto(appPath(legacyRoute), { replaceState: true });
      return;
    }

    previousScrollY = window.scrollY;
    void restoreFeedScrollPosition();
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && loadOlderArmed) {
          loadOlderArmed = false;
          void requestOlderFeed();
        }
      },
      { rootMargin: '320px 0px' }
    );
    if (loadMoreSentinel) observer.observe(loadMoreSentinel);

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      if (nextScrollY > previousScrollY) {
        loadOlderArmed = true;
        if (isNearPageBottom()) {
          loadOlderArmed = false;
          void requestOlderFeed();
        }
      }
      previousScrollY = nextScrollY;
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('touchstart', startPullForNewer, { passive: true });
    addEventListener('touchmove', updatePullForNewer, { passive: false });
    addEventListener('touchend', finishPullForNewer);
    addEventListener('touchcancel', finishPullForNewer);
    addEventListener('wheel', wheelPullForNewer, { passive: false });
    return () => {
      if (!clickedFeedNoteSaved) saveCurrentFeedScrollPosition();
      observer?.disconnect();
      clearTimeout(hideNewerBubbleTimeout);
      clearTimeout(wheelPullTimeout);
      clearTimeout(autoFillTimer);
      removeEventListener('scroll', onScroll);
      removeEventListener('touchstart', startPullForNewer);
      removeEventListener('touchmove', updatePullForNewer);
      removeEventListener('touchend', finishPullForNewer);
      removeEventListener('touchcancel', finishPullForNewer);
      removeEventListener('wheel', wheelPullForNewer);
    };
  });

  async function revealBufferedNewer(preservePosition = true) {
    const beforeHeight = document.documentElement.scrollHeight;
    revealNewerFeed();
    await tick();
    const heightDelta = document.documentElement.scrollHeight - beforeHeight;
    if (preservePosition && heightDelta > 0) window.scrollBy({ top: heightDelta, left: 0, behavior: 'instant' });
  }

  function startPullForNewer(event: TouchEvent) {
    if (isComposerGesture(event) || !canPullForNewer()) return;
    pullStartedAtTop = true;
    pullStartY = event.touches[0]?.clientY ?? 0;
    pullDistance = 0;
  }

  function updatePullForNewer(event: TouchEvent) {
    if (isComposerGesture(event)) {
      pullStartedAtTop = false;
      pullDistance = 0;
      return;
    }
    if (!pullStartedAtTop) return;
    const touch = event.touches[0];
    if (!touch) return;
    const distance = touch.clientY - pullStartY;
    if (distance <= 0 || window.scrollY > 2) {
      pullDistance = 0;
      return;
    }
    event.preventDefault();
    pullDistance = elasticPullDistance(distance);
  }

  function wheelPullForNewer(event: WheelEvent) {
    if (isComposerGesture(event) || !canPullForNewer() || event.deltaY >= 0) return;
    event.preventDefault();
    pullStartedAtTop = true;
    wheelPullRaw = Math.min(190, wheelPullRaw + Math.abs(event.deltaY));
    pullDistance = elasticPullDistance(wheelPullRaw);
    clearTimeout(wheelPullTimeout);
    wheelPullTimeout = setTimeout(() => void finishPullForNewer(), 150);
  }

  function isComposerGesture(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest('.composer-backdrop'));
  }

  async function finishPullForNewer() {
    if (!pullStartedAtTop) return;
    const shouldTrigger = pullDistance >= pullThreshold;
    pullStartedAtTop = false;
    pullDistance = 0;
    wheelPullRaw = 0;
    hideFloatingNewerBubble();
    if (!shouldTrigger || pullingNewer || !canLoadNewerForFeed()) return;

    pullingNewer = true;
    try {
      if ($pendingNewerEvents.length) {
        await revealBufferedNewer(false);
        return;
      }
      const loaded = await loadNewerFeed();
      if (loaded?.length) await revealBufferedNewer(false);
    } finally {
      pullingNewer = false;
    }
  }

  function canPullForNewer() {
    return canLoadNewerForFeed() && window.scrollY <= 2;
  }

  function canLoadNewerForFeed() {
    return $activeHashtag || $feedMode === 'global' || $feedMode === 'custom' || $feedMode === 'follow';
  }

  function elasticPullDistance(distance: number) {
    return Math.min(124, distance * 0.52 + Math.sqrt(distance) * 3.4);
  }

  function hideFloatingNewerBubble() {
    hideNewerBubble = true;
    clearTimeout(hideNewerBubbleTimeout);
    hideNewerBubbleTimeout = setTimeout(() => {
      hideNewerBubble = false;
    }, newerBubbleCooldownMs);
  }

  function isNearPageBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 360;
  }

  async function requestOlderFeed() {
    if (requestingOlder || $loadingFeed || $loadingMoreFeed || !$hasMoreFeed || !feedEvents.length) return;
    requestingOlder = true;
    try {
      await loadMoreFeed();
    } finally {
      requestingOlder = false;
    }
  }

  function scheduleFeedAutoFill() {
    if (!feedEvents.length || $loadingFeed || $loadingMoreFeed || !$hasMoreFeed || autoFillQueued || autoFillRunning) return;
    autoFillQueued = true;
    clearTimeout(autoFillTimer);
    autoFillTimer = setTimeout(() => {
      autoFillQueued = false;
      void autoFillFeedViewport();
    }, 80);
  }

  async function autoFillFeedViewport() {
    if (autoFillRunning) return;
    autoFillRunning = true;
    try {
      for (let attempt = 0; attempt < autoFillMaxLoads; attempt += 1) {
        await tick();
        if (!shouldAutoLoadOlderFeed()) return;
        const beforeCount = feedEvents.length;
        await requestOlderFeed();
        await tick();
        if (feedEvents.length <= beforeCount || !shouldAutoLoadOlderFeed()) return;
      }
    } finally {
      autoFillRunning = false;
    }
  }

  function shouldAutoLoadOlderFeed() {
    if (!feedEvents.length || $loadingFeed || $loadingMoreFeed || !$hasMoreFeed || requestingOlder) return false;
    const page = document.documentElement;
    return page.scrollHeight <= window.innerHeight + 180 || isNearPageBottom();
  }

  function saveCurrentFeedScrollPosition() {
    const anchor = firstVisibleFeedNote();
    saveFeedScrollPositionForAnchor(anchor);
  }

  function saveFeedScrollPositionForAnchor(anchor: HTMLElement | null | undefined) {
    saveFeedScrollState({
      scrollY: window.scrollY,
      anchorId: anchor?.dataset.noteId,
      anchorOffset: anchor?.getBoundingClientRect().top
    });
  }

  async function restoreFeedScrollPosition() {
    if (restoredFeedPosition) return;
    const state = readFeedScrollState();
    if (!state || Date.now() - state.savedAt > feedScrollStateMaxAgeMs) return;
    restoredFeedPosition = true;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await tick();
      await nextAnimationFrame();
      const anchor = state.anchorId ? document.querySelector<HTMLElement>(`[data-note-id="${state.anchorId}"]`) : null;
      if (anchor) {
        const top = window.scrollY + anchor.getBoundingClientRect().top - (state.anchorOffset ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
        break;
      } else if (attempt === 3) {
        window.scrollTo({ top: state.scrollY, left: 0, behavior: 'instant' });
      }
    }
    previousScrollY = window.scrollY;
  }

  function openFeedNote(event: NostrEvent) {
    const anchor = document.querySelector<HTMLElement>(`.feed-list [data-note-id="${event.id}"]`);
    saveFeedScrollPositionForAnchor(anchor);
    saveThreadSeed(event);
    saveThreadReturnTarget(event.id, currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash));
    clickedFeedNoteSaved = true;
    void goto(appPath(`/thread/${event.id}`));
  }

  function firstVisibleFeedNote() {
    return [...document.querySelectorAll<HTMLElement>('.feed-list [data-note-id]')].find((element) => element.getBoundingClientRect().bottom > 0);
  }

  function nextAnimationFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  function hashtagFilteredEvents(items: typeof $events, tag: string) {
    const normalized = tag.trim().replace(/^#/, '').toLowerCase();
    if (!normalized) return items;
    return items.filter((event) => {
      if (event.tags.some((item) => item[0] === 't' && item[1]?.replace(/^#/, '').toLowerCase() === normalized)) return true;
      return new RegExp(`(^|\\s)#${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(event.content);
    });
  }

  function customFeedHasKeywords(settings: typeof $customFeedSettings) {
    return settings.keywords.some((keyword) => keyword.trim());
  }

</script>

{@render Timeline()}

{#snippet Timeline()}
  <section
    class="timeline"
    class:pulling-newer={pullStartedAtTop}
    class:pull-ready={pullDistance >= pullThreshold}
    aria-label="Timeline"
    style={`--pull-progress: ${pullProgress}; --pull-distance: ${pullDistance}px;`}
  >
    {#if $session}
      <FeedSearchBar />
    {/if}
    <div class="pull-newer-zone" aria-hidden="true">
      <ArrowUp size={18} />
    </div>
    {#if showNewerBubble}
      <div class="newer-feed-bubble-wrap">
        <button class="newer-feed-bubble" on:click={() => void revealBufferedNewer()} title="Scroll up to reveal new notes" aria-label={`Scroll up to reveal ${$pendingNewerEvents.length} new notes`}>
          <ArrowUp size={20} />
        </button>
      </div>
    {/if}
    <section class="feed-list" aria-label="Feed">
      {#if feedEvents.length}
        {#each feedEvents as event (event.id)}
          <NoteCard {event} profile={$profiles[event.pubkey]} prefetchThread onOpen={openFeedNote} />
        {/each}
      {:else if $loadingFeed}
        <div class="empty-state">
          <span>Refreshing notes</span>
        </div>
      {:else}
        <div class="empty-state">
          <strong>No notes :(</strong>
          <span>{emptyMessage}</span>
        </div>
      {/if}
    </section>
    <div class="load-more-sentinel" bind:this={loadMoreSentinel}>
      {#if $loadingMoreFeed}
        <span>Loading more notes</span>
      {:else if $hasMoreFeed && feedEvents.length}
        <span>Scroll down for older notes</span>
      {/if}
    </div>
    {#if $session}
      <button class="fab mobile-compose-fab" on:click={startCompose} aria-label="Compose post">
        <Plus size={30} />
      </button>
    {/if}
  </section>
{/snippet}
