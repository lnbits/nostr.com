<script lang="ts">
  import { Check, Copy, LogOut, Moon, Plus, QrCode, RefreshCw, Save, Sun, Trash2 } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { nip19 } from 'nostr-tools';
  import { relays, session, signOut } from '$lib/stores/app';
  import { normalizeRelayUrl } from '$lib/nostr/client';
  import {
    createPomegranateConnection,
    currentPomegranateAuth,
    listPomegranateConnections,
    renamePomegranateConnection,
    revokePomegranateConnection,
    rotatePomegranateConnection,
    type PomegranateProfile
  } from '$lib/nostr/pomegranateAuth';
  import { setThemeMode, themeMode, type ThemeMode } from '$lib/stores/theme';
  import AlgorithmPanel from '$lib/components/AlgorithmPanel.svelte';
  import { relayStatus } from '$lib/stores/relayStatus';

  const themes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon }
  ];

  let newRelay = 'wss://';
  let copiedPublicKey = false;
  let copiedPrivateKey = false;
  let connectionName = 'Connect another Nostr app';
  let connections: Array<PomegranateProfile & { bunker: string }> = [];
  let connectionError = '';
  let loadingConnections = false;
  let busyConnection = '';
  let copiedConnection = '';
  let qrFor = '';
  let qrImage = '';
  $: sessionNpub = $session ? encodeNpub($session.pubkey) : '';
  $: sessionNpubPreview = compactNpub(sessionNpub);
  $: pomegranateAuth = currentPomegranateAuth();

  onMount(() => {
    if ($session?.mode === 'pomegranate') void refreshConnections();
  });

  function addRelay() {
    const url = normalizeRelayUrl(newRelay);
    if (!url) return;
    relays.update((items) => {
      const existing = new Set(items.map((relay) => normalizeRelayUrl(relay.url) || relay.url));
      return existing.has(url) ? items : [...items, { url, enabled: true, read: true, write: true, score: 50 }];
    });
    newRelay = 'wss://';
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

  function compactNpub(value: string) {
    if (value.length <= 18) return value;
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  }

  async function copyPublicKey() {
    if (!sessionNpub) return;
    await navigator.clipboard.writeText(sessionNpub);
    copiedPublicKey = true;
    setTimeout(() => (copiedPublicKey = false), 1400);
  }

  async function copyPrivateKey() {
    if ($session?.mode !== 'private-key' || !$session.secret) return;
    const nsec = nsecFromHex($session.secret);
    if (!nsec) return;
    await navigator.clipboard.writeText(nsec);
    copiedPrivateKey = true;
    setTimeout(() => (copiedPrivateKey = false), 1400);
  }

  function nsecFromHex(hex: string) {
    if (!/^[0-9a-f]{64}$/i.test(hex)) return '';
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
    return nip19.nsecEncode(bytes);
  }

  async function refreshConnections() {
    connectionError = '';
    loadingConnections = true;
    try {
      connections = await listPomegranateConnections();
    } catch (err) {
      connectionError = err instanceof Error ? err.message : 'Could not load connected apps.';
    } finally {
      loadingConnections = false;
    }
  }

  async function createConnection() {
    connectionError = '';
    busyConnection = 'new';
    try {
      const next = await createPomegranateConnection(connectionName);
      connections = [...connections, next];
      connectionName = 'Connect another Nostr app';
    } catch (err) {
      connectionError = err instanceof Error ? err.message : 'Could not create a connection.';
    } finally {
      busyConnection = '';
    }
  }

  async function renameConnection(connection: PomegranateProfile & { bunker: string }) {
    connectionError = '';
    busyConnection = connection.handler_pubkey;
    try {
      const next = await renamePomegranateConnection(connection.handler_pubkey, connection.name);
      connections = connections.map((item) => (item.handler_pubkey === connection.handler_pubkey ? next : item));
    } catch (err) {
      connectionError = err instanceof Error ? err.message : 'Could not rename this connection.';
    } finally {
      busyConnection = '';
    }
  }

  async function rotateConnection(connection: PomegranateProfile & { bunker: string }) {
    connectionError = '';
    busyConnection = connection.handler_pubkey;
    try {
      const next = await rotatePomegranateConnection(connection);
      connections = connections.map((item) => (item.handler_pubkey === connection.handler_pubkey ? next : item));
      if (qrFor === connection.handler_pubkey) {
        qrFor = next.handler_pubkey;
        await showQr(next);
      }
    } catch (err) {
      connectionError = err instanceof Error ? err.message : 'Could not refresh this connection.';
    } finally {
      busyConnection = '';
    }
  }

  async function revokeConnection(connection: PomegranateProfile & { bunker: string }) {
    connectionError = '';
    busyConnection = connection.handler_pubkey;
    try {
      await revokePomegranateConnection(connection.handler_pubkey);
      connections = connections.filter((item) => item.handler_pubkey !== connection.handler_pubkey);
      if (qrFor === connection.handler_pubkey) {
        qrFor = '';
        qrImage = '';
      }
    } catch (err) {
      connectionError = err instanceof Error ? err.message : 'Could not revoke this connection.';
    } finally {
      busyConnection = '';
    }
  }

  async function copyConnection(connection: PomegranateProfile & { bunker: string }) {
    await navigator.clipboard.writeText(connection.bunker);
    copiedConnection = connection.handler_pubkey;
    setTimeout(() => (copiedConnection = ''), 1400);
  }

  async function showQr(connection: PomegranateProfile & { bunker: string }) {
    if (qrFor === connection.handler_pubkey) {
      qrFor = '';
      qrImage = '';
      return;
    }
    const { default: QRCode } = await import('qrcode');
    qrImage = await QRCode.toDataURL(connection.bunker, { margin: 1, width: 260, errorCorrectionLevel: 'M' });
    qrFor = connection.handler_pubkey;
  }

  function formatConnectionDate(value?: number) {
    if (!value) return 'Not available';
    return new Date(value * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

</script>

<div class="settings-page">
  {#if $session}
    <section class="panel account-settings">
      <h2>Profile / Nostr address</h2>
      <div class="setting-grid">
        <div class="account-field">
          <span>Signed in with</span>
          <span class="session-label-row">
            <strong>{sessionLabel($session.mode)}</strong>
            {#if $session.mode === 'private-key' && $session.secret}
              <button class="icon-button small local-key-copy" on:click={copyPrivateKey} aria-label="Copy private key">
                {#if copiedPrivateKey}<Check size={15} />{:else}<Copy size={15} />{/if}
              </button>
            {/if}
          </span>
        </div>
        <div class="account-field">
          <span>Public key</span>
          <button class="public-key-copy" on:click={copyPublicKey} aria-label="Copy public key">
            {#if copiedPublicKey}<Check size={16} /> Copied{:else}<Copy size={16} /> {sessionNpubPreview}{/if}
          </button>
        </div>
      </div>
      <button class="danger-button" on:click={() => void signOut()}><LogOut size={18} /> Log out</button>
    </section>
  {/if}

  {#if $session?.mode === 'pomegranate'}
    <section class="panel connected-apps">
      <h2>Connected Nostr apps</h2>
      <div class="add-row">
        <input bind:value={connectionName} aria-label="Connection name" />
        <button disabled={busyConnection === 'new'} on:click={() => void createConnection()}><Plus size={18} /> Connect another Nostr app</button>
      </div>
      {#if loadingConnections}
        <p>Loading connected apps...</p>
      {:else if connections.length}
        <div class="connection-list">
          {#each connections as connection (connection.handler_pubkey)}
            <article class="connection-row">
              <div class="connection-main">
                <input bind:value={connection.name} aria-label="Connection name" on:change={() => void renameConnection(connection)} />
                <div class="connection-dates">
                  <span>Created {formatConnectionDate(connection.created_at)}</span>
                  <span>Last used {formatConnectionDate(connection.last_used_at)}</span>
                </div>
                <p>Refreshing this connection creates a new connection code. Your npub stays the same.</p>
                <details>
                  <summary>Advanced details</summary>
                  <code>{connection.bunker}</code>
                </details>
              </div>
              <div class="connection-actions">
                <button class="icon-button" disabled={busyConnection === connection.handler_pubkey} on:click={() => void showQr(connection)} aria-label="Show QR code"><QrCode size={18} /></button>
                <button class="icon-button" on:click={() => void copyConnection(connection)} aria-label="Copy connection code">
                  {#if copiedConnection === connection.handler_pubkey}<Check size={18} />{:else}<Copy size={18} />{/if}
                </button>
                <button class="icon-button" disabled={busyConnection === connection.handler_pubkey} on:click={() => void rotateConnection(connection)} aria-label="Refresh connection"><RefreshCw size={18} /></button>
                <button class="icon-button danger-icon" disabled={busyConnection === connection.handler_pubkey} on:click={() => void revokeConnection(connection)} aria-label="Revoke connection"><Trash2 size={18} /></button>
              </div>
              {#if qrFor === connection.handler_pubkey && qrImage}
                <img class="connection-qr" src={qrImage} alt="Connection QR code" />
              {/if}
            </article>
          {/each}
        </div>
      {:else}
        <p>No connected apps yet.</p>
      {/if}
      {#if connectionError}<p class="error">{connectionError}</p>{/if}
    </section>

    <section class="panel">
      <h2>Login methods</h2>
      <div class="setting-grid">
        <span>Coordinator</span><strong>{pomegranateAuth?.centralUrl ?? $session.pomegranateCentral ?? 'auth.njump.me'}</strong>
        <span>Email</span><strong>{$session.pomegranateEmail ?? 'Connected through Pomegranate'}</strong>
        <span>Methods</span><strong>Email, Google</strong>
      </div>
    </section>

    <section class="panel">
      <h2>Recovery / export identity</h2>
      <p>Use Pomegranate recovery with your operators when you need to recover or export identity material.</p>
    </section>
  {/if}

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
