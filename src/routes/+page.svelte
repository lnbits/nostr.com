<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import InfoView from '$lib/components/InfoView.svelte';
  import MessagesView from '$lib/components/MessagesView.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import {
    events,
    feedMode,
    follows,
    hasMoreFeed,
    loadingFeed,
    loadingMoreFeed,
    loadNewerFeed,
    loadMoreFeed,
    profiles,
    relays,
    session
  } from '$lib/stores/app';

  let loadMoreSentinel: HTMLDivElement;
  let observer: IntersectionObserver | undefined;
  let previousScrollY = 0;
  let loadOlderArmed = false;
  let lastNewerLoadAt = 0;
  $: activeHash = $page.url.hash;
  $: hasReadRelays = $relays.some((relay) => relay.enabled && relay.read);
  $: emptyMessage = !hasReadRelays
    ? 'Please connect to relays'
    : $session && ($feedMode === 'follow' || $feedMode === 'custom') && !$follows.length
      ? 'Please follow someone'
      : 'Please connect to relays';

  onMount(() => {
    previousScrollY = window.scrollY;
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && loadOlderArmed && !activeHash) {
          loadOlderArmed = false;
          void loadMoreFeed(true);
        }
      },
      { rootMargin: '320px 0px' }
    );
    if (loadMoreSentinel) observer.observe(loadMoreSentinel);

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const scrollingUp = nextScrollY < previousScrollY;
      if (nextScrollY > previousScrollY) loadOlderArmed = true;
      previousScrollY = nextScrollY;
      if (scrollingUp && nextScrollY < 140 && $feedMode === 'global' && !activeHash) {
        const now = Date.now();
        if (now - lastNewerLoadAt > 1200) {
          lastNewerLoadAt = now;
          void loadNewerFeed();
        }
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      removeEventListener('scroll', onScroll);
    };
  });
</script>

{#if $session}
  {#if activeHash === '#messages'}
    <MessagesView />
  {:else if activeHash === '#info'}
    <InfoView />
  {:else}
    {@render Timeline()}
  {/if}
{:else}
  <div class="shell">
    {#if activeHash === '#messages'}
      <MessagesView />
    {:else if activeHash === '#info'}
      <InfoView />
    {:else}
      {@render Timeline()}
    {/if}
    <RightRail />
  </div>
{/if}

{#snippet Timeline()}
  <section class="timeline">
    <section class="feed-list" aria-label="Feed">
      {#if $events.length}
        {#each $events as event (event.id)}
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
      {:else if !$hasMoreFeed && $events.length}
        <span>End of cached relay results</span>
      {/if}
    </div>
  </section>
{/snippet}
