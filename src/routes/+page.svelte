<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Edit3 } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import { events, hasMoreFeed, loadingMoreFeed, loadMoreFeed, profiles, session, startCompose } from '$lib/stores/app';

  let loadMoreSentinel: HTMLDivElement;
  let observer: IntersectionObserver | undefined;

  onMount(() => {
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMoreFeed();
      },
      { rootMargin: '700px 0px' }
    );
    if (loadMoreSentinel) observer.observe(loadMoreSentinel);
  });

  onDestroy(() => observer?.disconnect());
</script>

{#if $session}
  {@render Timeline()}
{:else}
  <div class="shell">
    {@render Timeline()}
    <RightRail />
  </div>
{/if}

{#if !$session}
  <button class="fab" on:click={startCompose} aria-label="Compose note"><Edit3 size={23} /></button>
{/if}

{#snippet Timeline()}
  <section class="timeline">
    <section class="feed-list" aria-label="Feed">
      {#if $events.length}
        {#each $events as event (event.id)}
          <NoteCard {event} profile={$profiles[event.pubkey]} />
        {/each}
      {:else}
        <div class="empty-state">
          <strong>No notes cached yet</strong>
          <span>Connect to relays or sign in to hydrate your follow graph.</span>
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
