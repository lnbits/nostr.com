<script lang="ts">
  import { LogOut, Moon, Plus, Save, SlidersHorizontal, Sun, Trash2 } from '@lucide/svelte';
  import { customFeedSettings, relays, session, signOut } from '$lib/stores/app';
  import { setThemeMode, themeMode, type ThemeMode } from '$lib/stores/theme';

  const themes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon }
  ];

  let newRelay = 'wss://';

  function addRelay() {
    if (!newRelay.startsWith('wss://')) return;
    relays.update((items) => [...items, { url: newRelay, enabled: true, read: true, write: true, score: 50 }]);
    newRelay = 'wss://';
  }
</script>

<div class="settings-page">
  <section class="page-head">
    <h1>Settings</h1>
    <p>Relay, cache, feed distance, mute, and report controls live here so the native apps inherit the same behavior.</p>
  </section>

  <section class="panel">
    <h2>Theme</h2>
    <div class="theme-grid" aria-label="Theme mode">
      {#each themes as theme}
        <button class:active={$themeMode === theme.mode} on:click={() => setThemeMode(theme.mode)} aria-label={`${theme.label} theme`}>
          <svelte:component this={theme.icon} size={18} />
          {theme.label}
        </button>
      {/each}
    </div>
  </section>

  {#if $session}
    <section class="panel account-settings">
      <h2>Account</h2>
      <div class="setting-grid">
        <span>Signed in with</span><strong>{$session.mode}</strong>
        <span>Public key</span><strong>{$session.pubkey.slice(0, 16)}...</strong>
      </div>
      <button class="danger-button" on:click={() => void signOut()}><LogOut size={18} /> Log out</button>
    </section>
  {/if}

  <section class="panel">
    <h2><SlidersHorizontal size={20} /> Custom feed</h2>
    <label class="switch-row">
      <span>Friends of friends</span>
      <input type="checkbox" bind:checked={$customFeedSettings.friendsOfFriends} />
    </label>
    <label>
      <span>Keywords</span>
      <input
        value={$customFeedSettings.keywords.join(', ')}
        on:change={(event) =>
          customFeedSettings.update((settings) => ({
            ...settings,
            keywords: event.currentTarget.value
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean)
          }))}
        placeholder="bitcoin, svelte, lightning"
      />
    </label>
  </section>

  <section class="panel">
    <h2>Relays</h2>
    {#each $relays as relay, index}
      <div class="relay-editor">
        <input bind:value={relay.url} />
        <label><input type="checkbox" bind:checked={relay.enabled} /> Enabled</label>
        <label><input type="checkbox" bind:checked={relay.read} /> Read</label>
        <label><input type="checkbox" bind:checked={relay.write} /> Write</label>
        <button class="icon-button" on:click={() => relays.update((items) => items.filter((_, i) => i !== index))} aria-label="Remove relay"><Trash2 size={18} /></button>
      </div>
    {/each}
    <div class="add-row">
      <input bind:value={newRelay} />
      <button on:click={addRelay}><Plus size={18} /> Add</button>
    </div>
  </section>

  <section class="panel">
    <h2>Offline cache</h2>
    <div class="setting-grid">
      <span>IndexedDB event cache</span><strong>Enabled</strong>
      <span>Contact list cache</span><strong>Enabled</strong>
      <span>Media handling</span><strong>Lazy image loading</strong>
      <span>Missing event fetching</span><strong>Thread hydration</strong>
    </div>
    <button class="primary"><Save size={18} /> Saved locally</button>
  </section>
</div>
