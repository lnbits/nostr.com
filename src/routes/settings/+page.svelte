<script lang="ts">
  import { Check, Copy, LogOut, Moon, Plus, Save, SlidersHorizontal, Sun, Trash2 } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import { customFeedSettings, feedMode, refreshFeed, relays, session, signOut } from '$lib/stores/app';
  import { normalizeRelayUrl } from '$lib/nostr/client';
  import { parseKeywordInput } from '$lib/nostr/keywords';
  import { setThemeMode, themeMode, type ThemeMode } from '$lib/stores/theme';
  import AlgorithmPanel from '$lib/components/AlgorithmPanel.svelte';
  import { relayStatus } from '$lib/stores/relayStatus';

  const themes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon }
  ];

  let newRelay = 'wss://';
  let copiedPublicKey = false;
  $: sessionNpub = $session ? encodeNpub($session.pubkey) : '';

  function addRelay() {
    const url = normalizeRelayUrl(newRelay);
    if (!url) return;
    relays.update((items) => {
      const existing = new Set(items.map((relay) => normalizeRelayUrl(relay.url) || relay.url));
      return existing.has(url) ? items : [...items, { url, enabled: true, read: true, write: true, score: 50 }];
    });
    newRelay = 'wss://';
  }

  function updateKeywords(value: string) {
    customFeedSettings.update((settings) => ({
      ...settings,
      keywords: parseKeywords(value)
    }));
    refreshActiveFilteredFeed();
  }

  function updateFriendsOfFriends(value: boolean) {
    customFeedSettings.update((settings) => ({
      ...settings,
      friendsOfFriends: value
    }));
    refreshActiveFilteredFeed();
  }

  function refreshActiveFilteredFeed() {
    if ($feedMode === 'global' || $feedMode === 'custom') void refreshFeed($feedMode, { replaceVisible: true });
  }

  function parseKeywords(value: string) {
    return parseKeywordInput(value);
  }

  function sessionLabel(mode: string) {
    if (mode === 'private-key') return 'Local key';
    if (mode === 'nip07') return 'Browser extension';
    if (mode === 'bunker') return 'Remote signer';
    if (mode === 'pomegranate') return 'Pomegranate';
    return 'Signed in';
  }

  function encodeNpub(pubkey: string) {
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return pubkey;
    }
  }

  async function copyPublicKey() {
    if (!sessionNpub) return;
    await navigator.clipboard.writeText(sessionNpub);
    copiedPublicKey = true;
    setTimeout(() => (copiedPublicKey = false), 1400);
  }

</script>

<div class="settings-page">
  <section class="page-head">
    <h1>Settings</h1>
    <p>Relay, cache, feed distance, mute, and report controls live here so the native apps inherit the same behavior.</p>
  </section>

  <section class="panel settings-feed-card">
    <AlgorithmPanel />
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
        <span>Signed in with</span><strong>{sessionLabel($session.mode)}</strong>
        <span>Public key</span>
        <button class="public-key-copy" on:click={copyPublicKey} aria-label="Copy public key">
          {#if copiedPublicKey}<Check size={16} /> Copied{:else}<Copy size={16} /> {sessionNpub.slice(0, 18)}...{sessionNpub.slice(-8)}{/if}
        </button>
      </div>
      <button class="danger-button" on:click={() => void signOut()}><LogOut size={18} /> Log out</button>
    </section>
  {/if}

  <section class="panel">
    <h2><SlidersHorizontal size={20} /> Filters</h2>
    <div class="filter-card-form">
      <label>
        <span>Feed keywords</span>
        <input value={$customFeedSettings.keywords.join(', ')} on:change={(event) => updateKeywords(event.currentTarget.value)} placeholder="bitcoin, svelte, lightning" />
      </label>
    </div>

    <label class="switch-row">
      <span>Friends of friends for custom feed</span>
      <input type="checkbox" checked={$customFeedSettings.friendsOfFriends} on:change={(event) => updateFriendsOfFriends(event.currentTarget.checked)} />
    </label>
  </section>

  <section class="panel">
    <h2>Relays</h2>
    {#each $relays as relay, index}
      <div class="relay-editor">
        <span
          class:online={relay.enabled && $relayStatus[relay.url] === 'online'}
          class:offline={relay.enabled && $relayStatus[relay.url] === 'offline'}
          class="relay-status settings-relay-status"
          aria-label={`${relay.url} ${relay.enabled ? $relayStatus[relay.url] ?? 'checking' : 'disabled'}`}
        ></span>
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
