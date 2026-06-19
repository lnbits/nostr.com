<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Loader2, Plus, Save, Trash2, X } from '@lucide/svelte';
  import { defaultProfileRelays } from '$lib/nostr/config';
  import { normalizeRelayUrl } from '$lib/nostr/client';
  import { loadPublishedRelayList, relays, savePublishedRelayList } from '$lib/stores/app';
  import type { RelayState } from '$lib/nostr/types';

  const dispatch = createEventDispatcher<{ close: void }>();

  let draftRelays: RelayState[] = [];
  let newRelay = 'wss://';
  let loading = true;
  let saving = false;
  let addToAppRelays = true;
  let error = '';
  let saved = false;
  let addFocused = false;

  $: knownSuggestions = $relays
    .map((relay) => normalizeRelayUrl(relay.url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => !draftRelays.some((relay) => normalizeRelayUrl(relay.url) === url))
    .filter((url) => {
      const clean = newRelay.trim().toLowerCase();
      return clean === 'wss://' || clean.length < 7 || url.toLowerCase().includes(clean.replace(/^wss?:\/\//, ''));
    })
    .slice(0, 6);

  onMount(() => {
    void loadRelays();
  });

  async function loadRelays() {
    loading = true;
    error = '';
    try {
      const published = await loadPublishedRelayList();
      draftRelays = published.length ? published : cloneRelays(defaultProfileRelays);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load your published relays.';
      draftRelays = cloneRelays(defaultProfileRelays);
    } finally {
      loading = false;
    }
  }

  function addRelay(url = newRelay) {
    const normalized = normalizeRelayUrl(url);
    if (!normalized) return;
    if (!draftRelays.some((relay) => normalizeRelayUrl(relay.url) === normalized)) {
      draftRelays = [...draftRelays, { url: normalized, enabled: true, read: true, write: true, score: 75 }];
    }
    newRelay = 'wss://';
    addFocused = false;
  }

  function removeRelay(index: number) {
    draftRelays = draftRelays.filter((_, itemIndex) => itemIndex !== index);
  }

  async function saveRelays() {
    saving = true;
    error = '';
    saved = false;
    try {
      draftRelays = await savePublishedRelayList(draftRelays, { addToAppRelays });
      saved = true;
      setTimeout(() => (saved = false), 1400);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not publish your relay list.';
    } finally {
      saving = false;
    }
  }

  function cloneRelays(items: RelayState[]) {
    return items.map((relay) => ({ ...relay }));
  }
</script>

<div
  class="dialog-backdrop"
  role="presentation"
  on:click={(event) => {
    if (event.target === event.currentTarget) dispatch('close');
  }}
>
  <div class="dialog-panel profile-relays-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-relays-title">
    <div class="dialog-head">
      <div>
        <h2 id="profile-relays-title">Edit relays</h2>
        <p>Publish where other Nostr apps should find your profile and notes.</p>
      </div>
      <button class="icon-button" type="button" on:click={() => dispatch('close')} aria-label="Close relay editor"><X size={19} /></button>
    </div>

    {#if loading}
      <div class="empty-state compact"><Loader2 size={17} class="spin" /> Loading relays</div>
    {:else}
      <div class="profile-relay-list">
        {#each draftRelays as relay, index}
          <div class="relay-editor profile-relay-editor">
            <span class="relay-status settings-relay-status online" aria-hidden="true"></span>
            <input bind:value={relay.url} aria-label="Relay URL" />
            <label><input type="checkbox" bind:checked={relay.enabled} /> Enabled</label>
            <label><input type="checkbox" bind:checked={relay.read} /> Read</label>
            <label><input type="checkbox" bind:checked={relay.write} /> Write</label>
            <button class="icon-button" type="button" on:click={() => removeRelay(index)} aria-label="Remove relay"><Trash2 size={18} /></button>
          </div>
        {/each}
      </div>

      <div class="relay-add-wrap">
        <div class="add-row">
          <input
            bind:value={newRelay}
            on:focus={() => (addFocused = true)}
            on:blur={() => setTimeout(() => (addFocused = false), 120)}
            on:keydown={(event) => event.key === 'Enter' && (event.preventDefault(), addRelay())}
            placeholder="wss://relay.example.com"
            aria-label="Relay URL to add"
          />
          <button type="button" on:mousedown|preventDefault on:click={() => addRelay()}><Plus size={18} /> Add</button>
        </div>
        {#if addFocused && knownSuggestions.length}
          <div class="relay-suggestions" aria-label="Relay suggestions">
            {#each knownSuggestions as relayUrl}
              <button type="button" on:mousedown|preventDefault on:click={() => addRelay(relayUrl)}>{relayUrl}</button>
            {/each}
          </div>
        {/if}
      </div>

      <label class="relay-sync-option"><input type="checkbox" bind:checked={addToAppRelays} /> Also add these to this app's relay settings</label>

      {#if error}<p class="error">{error}</p>{/if}
      {#if saved}<p class="muted-copy">Relay list published.</p>{/if}

      <div class="dialog-actions">
        <button type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="primary" type="button" disabled={saving || !draftRelays.length} on:click={saveRelays}>
          <Save size={18} /> {saving ? 'Saving' : 'Save relays'}
        </button>
      </div>
    {/if}
  </div>
</div>
