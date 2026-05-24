<script lang="ts">
  import { goto } from '$app/navigation';
  import { SlidersHorizontal } from '@lucide/svelte';
  import { feedMode, selectFeedMode } from '$lib/stores/app';
  import { appPath } from '$lib/paths';
  import type { FeedMode } from '$lib/nostr/types';
  import CustomFeedDialog from './CustomFeedDialog.svelte';
  import FollowListDialog from './FollowListDialog.svelte';

  export let layout: 'horizontal' | 'vertical' = 'horizontal';
  export let disabled = false;

  const tabs: { key: FeedMode; label: string }[] = [
    { key: 'follow', label: 'Following' },
    { key: 'global', label: 'Global' },
    { key: 'custom', label: 'Custom' }
  ];

  function select(key: FeedMode) {
    if (disabled) return;
    selectFeedMode(key);
    void goto(appPath('/'));
  }

  let customDialogOpen = false;
  let followDialogOpen = false;
</script>

{#if layout === 'vertical'}
  <div class="algorithm-buttons">
    <div class="algorithm-edit-row">
      <button class:active={$feedMode === 'follow'} {disabled} on:click={() => select('follow')}>Following</button>
      <button class="icon-button custom-feed-edit" disabled={disabled || $feedMode !== 'follow'} on:click={() => (followDialogOpen = true)} aria-label="Edit follow list">
        <SlidersHorizontal size={18} />
      </button>
    </div>
    <button class:active={$feedMode === 'global'} {disabled} on:click={() => select('global')}>Global</button>
    <div class="algorithm-edit-row">
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

<FollowListDialog bind:open={followDialogOpen} />
<CustomFeedDialog bind:open={customDialogOpen} />
