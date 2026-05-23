<script lang="ts">
  import { SlidersHorizontal } from '@lucide/svelte';
  import { feedMode, refreshFeed } from '$lib/stores/app';
  import type { FeedMode } from '$lib/nostr/types';
  import CustomFeedDialog from './CustomFeedDialog.svelte';

  export let layout: 'horizontal' | 'vertical' = 'horizontal';
  export let disabled = false;

  const tabs: { key: FeedMode; label: string }[] = [
    { key: 'follow', label: 'Following' },
    { key: 'global', label: 'Global' },
    { key: 'custom', label: 'Custom' }
  ];

  function select(key: FeedMode) {
    if (disabled) return;
    feedMode.set(key);
    void refreshFeed(key);
  }

  let customDialogOpen = false;
</script>

{#if layout === 'vertical'}
  <div class="algorithm-buttons">
    <button class:active={$feedMode === 'follow'} {disabled} on:click={() => select('follow')}>Following</button>
    <button class:active={$feedMode === 'global'} {disabled} on:click={() => select('global')}>Global</button>
    <div class="algorithm-custom-row">
      <button class:active={$feedMode === 'custom'} {disabled} on:click={() => select('custom')}>Custom</button>
      <button class="icon-button custom-feed-edit" disabled={disabled || $feedMode !== 'custom'} on:click={() => (customDialogOpen = true)} aria-label="Edit custom feed">
        <SlidersHorizontal size={18} />
      </button>
    </div>
  </div>
{:else}
  <div class="segmented">
    {#each tabs as tab}
      <button class:active={$feedMode === tab.key} {disabled} on:click={() => select(tab.key)}>{tab.label}</button>
    {/each}
    <button class="custom-feed-edit" disabled={disabled || $feedMode !== 'custom'} on:click={() => (customDialogOpen = true)} aria-label="Edit custom feed">
      <SlidersHorizontal size={19} />
    </button>
  </div>
{/if}

<CustomFeedDialog bind:open={customDialogOpen} />
