<script lang="ts">
  import { tick } from 'svelte';
  import { page } from '$app/stores';
  import { Download, RefreshCw } from '@lucide/svelte';
  import { clearFeedState, feedMode, loadNewerFeed, loadingFeed, pendingNewerEvents, refreshFeed, revealNewerFeed, session } from '$lib/stores/app';
  import FeedTabs from './FeedTabs.svelte';

  export let title = 'Your algorithm';
  export let labelledBy = '';

  function dispatchPageFeedAction(action: 'pull' | 'refresh') {
    if (!$page.route.id?.startsWith('/profile/')) return false;
    window.dispatchEvent(new CustomEvent('nostr-profile-feed-action', { detail: { action } }));
    return true;
  }

  async function refreshActiveFeed() {
    if (!$session) return;
    if (dispatchPageFeedAction('pull')) return;
    if ($pendingNewerEvents.length) {
      await revealBufferedNewer();
      return;
    }
    const loaded = await loadNewerFeed();
    if (loaded?.length) {
      await revealBufferedNewer();
      return;
    }
    await refreshFeed($feedMode);
  }

  async function resetActiveFeed() {
    if (!$session) return;
    if (dispatchPageFeedAction('refresh')) return;
    loadingFeed.set(true);
    clearFeedState();
    await tick();
    await refreshFeed($feedMode, { reset: true });
  }

  async function revealBufferedNewer() {
    const beforeHeight = document.documentElement.scrollHeight;
    revealNewerFeed();
    await tick();
    const heightDelta = document.documentElement.scrollHeight - beforeHeight;
    if (heightDelta > 0) window.scrollBy({ top: heightDelta, left: 0, behavior: 'instant' });
  }
</script>

<section class="algorithm-panel-content" aria-labelledby={labelledBy || undefined}>
  {#if title}
    <h2 id={labelledBy || undefined}>{title}</h2>
  {/if}
  <FeedTabs layout="vertical" disabled={!$session} />
  <div class="algorithm-refresh-row">
    <button type="button" disabled={!$session} on:click={refreshActiveFeed} aria-label="Pull feed updates">
      <Download size={18} /> Pull
    </button>
    <button type="button" disabled={!$session} on:click={resetActiveFeed} aria-label="Refresh feed from scratch">
      <RefreshCw size={18} /> Refresh
    </button>
  </div>
</section>
