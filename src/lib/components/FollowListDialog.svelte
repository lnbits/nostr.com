<script lang="ts">
  import { nip19 } from 'nostr-tools';
  import { Save, Trash2, UserPlus, X } from '@lucide/svelte';
  import { follows, saveFollowList } from '$lib/stores/app';

  export let open = false;

  let entries: string[] = [];
  let newFollow = '';
  let saving = false;
  let error = '';

  $: if (open) {
    entries = [...$follows];
    error = '';
  }

  function close() {
    open = false;
  }

  function normalizePubkey(value: string) {
    const trimmed = value.trim();
    if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (!trimmed.startsWith('npub')) return null;
    try {
      const decoded = nip19.decode(trimmed);
      return decoded.type === 'npub' ? decoded.data : null;
    } catch {
      return null;
    }
  }

  function addFollow() {
    const pubkey = normalizePubkey(newFollow);
    if (!pubkey) {
      error = 'Use a valid npub or hex public key.';
      return;
    }
    entries = [...new Set([...entries, pubkey])];
    newFollow = '';
    error = '';
  }

  function removeFollow(pubkey: string) {
    entries = entries.filter((entry) => entry !== pubkey);
  }

  function shortKey(pubkey: string) {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return pubkey.slice(0, 16);
    }
  }

  async function save() {
    saving = true;
    error = '';
    try {
      await saveFollowList(entries);
      close();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update follow list.';
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && close()}>
    <div class="dialog-panel compact" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
      <div class="dialog-head">
        <h2 id="follow-list-title">Following</h2>
        <button class="icon-button" on:click={close} aria-label="Close follow list"><X size={20} /></button>
      </div>

      <div class="follow-add-row">
        <input bind:value={newFollow} placeholder="npub1... or hex public key" on:keydown={(event) => event.key === 'Enter' && addFollow()} />
        <button on:click={addFollow}><UserPlus size={18} /> Add</button>
      </div>

      <div class="follow-list-manager" aria-label="Follow list">
        {#each entries as pubkey}
          <div class="follow-list-row">
            <span>{shortKey(pubkey)}</span>
            <button class="icon-button" on:click={() => removeFollow(pubkey)} aria-label="Remove follow"><Trash2 size={17} /></button>
          </div>
        {:else}
          <p class="muted-copy">No follows yet.</p>
        {/each}
      </div>

      {#if error}<p class="error">{error}</p>{/if}
      <div class="dialog-actions">
        <button on:click={close}>Cancel</button>
        <button class="primary" disabled={saving} on:click={save}><Save size={18} /> {saving ? 'Saving' : 'Save'}</button>
      </div>
    </div>
  </div>
{/if}
