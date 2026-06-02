<script lang="ts">
  import { X } from '@lucide/svelte';
  import { customFeedSettings } from '$lib/stores/app';
  import { parseKeywordInput } from '$lib/nostr/keywords';

  export let open = false;
  export let embedded = false;
  export let onClose = () => {};

  let keywordText = '';

  $: if (open || embedded) {
    keywordText = $customFeedSettings.keywords.join(', ');
  }

  function close() {
    open = false;
    onClose();
  }

  function save() {
    customFeedSettings.update((settings) => ({
      ...settings,
      keywords: parseKeywordInput(keywordText)
    }));
    close();
  }

</script>

{#if embedded}
  <div class="custom-feed-form algorithm-editor-body">
    <label class="custom-feed-toggle">
      <span>
        <strong>Friends of friends</strong>
        <small>Mix in posts from people followed by your follows.</small>
      </span>
      <input type="checkbox" bind:checked={$customFeedSettings.friendsOfFriends} />
    </label>

    <label class="custom-feed-field">
      <span>Feed keywords</span>
      <input bind:value={keywordText} placeholder="bitcoin, svelte, lightning" />
    </label>
  </div>

  <div class="dialog-actions algorithm-editor-actions">
    <button on:click={close}>Cancel</button>
    <button class="primary" on:click={save}>Save</button>
  </div>
{:else if open}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && close()}>
    <div class="dialog-panel compact" role="dialog" aria-modal="true" aria-labelledby="custom-feed-title">
      <div class="dialog-head">
        <h2 id="custom-feed-title">Custom feed</h2>
        <button class="icon-button" on:click={close} aria-label="Close custom feed settings"><X size={20} /></button>
      </div>

      <div class="custom-feed-form">
        <label class="custom-feed-toggle">
          <span>
            <strong>Friends of friends</strong>
            <small>Mix in posts from people followed by your follows.</small>
          </span>
          <input type="checkbox" bind:checked={$customFeedSettings.friendsOfFriends} />
        </label>

        <label class="custom-feed-field">
          <span>Feed keywords</span>
          <input bind:value={keywordText} placeholder="bitcoin, svelte, lightning" />
        </label>
      </div>

      <div class="dialog-actions">
        <button on:click={close}>Cancel</button>
        <button class="primary" on:click={save}>Save</button>
      </div>
    </div>
  </div>
{/if}
