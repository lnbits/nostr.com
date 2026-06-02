<script lang="ts">
  import { RefreshCw } from '@lucide/svelte';
  import { feedMode, loadingFeed, refreshFeed, session } from '$lib/stores/app';
  import FeedTabs from './FeedTabs.svelte';

  export let title = 'Your algorithm';
  export let labelledBy = '';

  async function refreshActiveFeed() {
    if (!$session) return;
    await refreshFeed($feedMode, { replaceVisible: true });
  }
</script>

<section class="algorithm-panel-content" aria-labelledby={labelledBy || undefined}>
  {#if title}
    <h2 id={labelledBy || undefined}>{title}</h2>
  {/if}
  <FeedTabs layout="vertical" disabled={!$session} />
  <button type="button" disabled={!$session} on:click={refreshActiveFeed} aria-label="Refresh feed">
    <RefreshCw size={18} class={$loadingFeed ? 'spin' : ''} /> Refresh
  </button>
</section>
