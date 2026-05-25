<script lang="ts">
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
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
    activeHashtag
  } from '$lib/stores/app';
  import { topLevelFeedEvents } from '$lib/nostr/client';
  import { appPath } from '$lib/paths';

  let loadMoreSentinel: HTMLDivElement;
  let observer: IntersectionObserver | undefined;
  let previousScrollY = 0;
  let loadOlderArmed = false;
  let pullStartY = 0;
  let pullDistance = 0;
  let wheelPullRaw = 0;
  let wheelPullTimeout: ReturnType<typeof setTimeout> | undefined;
  let pullingNewer = false;
  let pullStartedAtTop = false;
  let hideNewerBubble = false;
  let hideNewerBubbleTimeout: ReturnType<typeof setTimeout> | undefined;
  const pullThreshold = 78;
  const newerBubbleCooldownMs = 5000;
  $: hasReadRelays = $relays.some((relay) => relay.enabled && relay.read);
  $: feedEvents = hashtagFilteredEvents(topLevelFeedEvents($events), $activeHashtag);
  $: pullProgress = Math.min(1, pullDistance / pullThreshold);
  $: showNewerBubble = canLoadNewerForFeed() && $pendingNewerEvents.length && !pullingNewer && !hideNewerBubble && !pullStartedAtTop && pullDistance <= 0;
  $: emptyMessage = !hasReadRelays
    ? 'Please connect to relays'
    : $session && ($feedMode === 'follow' || $feedMode === 'custom') && !$follows.length
      ? 'Please follow someone'
      : 'Please connect to relays';

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
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && loadOlderArmed) {
          loadOlderArmed = false;
          void loadMoreFeed();
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
          void loadMoreFeed();
        }
      }
      previousScrollY = nextScrollY;
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      clearTimeout(hideNewerBubbleTimeout);
      clearTimeout(wheelPullTimeout);
      removeEventListener('scroll', onScroll);
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
    if (!canPullForNewer()) return;
    pullStartedAtTop = true;
    pullStartY = event.touches[0]?.clientY ?? 0;
    pullDistance = 0;
  }

  function updatePullForNewer(event: TouchEvent) {
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
    if (!canPullForNewer() || event.deltaY >= 0) return;
    event.preventDefault();
    pullStartedAtTop = true;
    wheelPullRaw = Math.min(190, wheelPullRaw + Math.abs(event.deltaY));
    pullDistance = elasticPullDistance(wheelPullRaw);
    clearTimeout(wheelPullTimeout);
    wheelPullTimeout = setTimeout(() => void finishPullForNewer(), 150);
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

  function hashtagFilteredEvents(items: typeof $events, tag: string) {
    const normalized = tag.trim().replace(/^#/, '').toLowerCase();
    if (!normalized) return items;
    return items.filter((event) => {
      if (event.tags.some((item) => item[0] === 't' && item[1]?.replace(/^#/, '').toLowerCase() === normalized)) return true;
      return new RegExp(`(^|\\s)#${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(event.content);
    });
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
    on:touchstart={startPullForNewer}
    on:touchmove={updatePullForNewer}
    on:touchend={finishPullForNewer}
    on:touchcancel={finishPullForNewer}
    on:wheel={wheelPullForNewer}
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
          <NoteCard {event} profile={$profiles[event.pubkey]} />
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
