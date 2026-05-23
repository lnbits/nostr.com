<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { ChevronsLeft, ChevronsRight, LogIn, Radio, RefreshCw } from '@lucide/svelte';
  import FeedTabs from './FeedTabs.svelte';
  import { loadingFeed, loginDialogOpen, refreshFeed, relays, session } from '$lib/stores/app';

  export let collapsible = false;
  export let collapsed = false;
  export let onToggle = () => {};

  let mounted = false;
  let relayStatus: Record<string, 'checking' | 'online' | 'offline'> = {};
  let cleanupChecks: Array<() => void> = [];

  $: enabledRelayUrls = $relays.filter((relay) => relay.enabled).map((relay) => relay.url);
  $: if (mounted) checkRelays(enabledRelayUrls);

  onMount(() => {
    mounted = true;
    checkRelays(enabledRelayUrls);
  });

  onDestroy(() => {
    cleanupChecks.forEach((cleanup) => cleanup());
  });

  function checkRelays(urls: string[]) {
    cleanupChecks.forEach((cleanup) => cleanup());
    cleanupChecks = [];
    relayStatus = Object.fromEntries(urls.map((url) => [url, 'checking']));

    for (const url of urls) {
      try {
        const socket = new WebSocket(url);
        let opened = false;
        const timeout = setTimeout(() => {
          if (!opened) relayStatus = { ...relayStatus, [url]: 'offline' };
          socket.close();
        }, 3500);

        socket.onopen = () => {
          opened = true;
          relayStatus = { ...relayStatus, [url]: 'online' };
          socket.close();
        };
        socket.onerror = () => {
          if (!opened) relayStatus = { ...relayStatus, [url]: 'offline' };
        };
        socket.onclose = () => {
          clearTimeout(timeout);
          if (!opened) relayStatus = { ...relayStatus, [url]: 'offline' };
        };
        cleanupChecks.push(() => {
          clearTimeout(timeout);
          socket.close();
        });
      } catch {
        relayStatus = { ...relayStatus, [url]: 'offline' };
      }
    }
  }
</script>

<aside class="rail" class:collapsed>
  {#if collapsible}
    <button class="icon-button rail-toggle" on:click={onToggle} aria-label={collapsed ? 'Show right menu' : 'Collapse right menu'}>
      {#if collapsed}<ChevronsLeft size={20} />{:else}<ChevronsRight size={20} />{/if}
    </button>
  {/if}

  {#if !collapsed}
    {#if !$session}
      <section class="panel account-panel">
        <button class="primary" on:click={() => loginDialogOpen.set(true)}><LogIn size={18} /> Sign in</button>
      </section>
    {/if}

    <section class="panel algorithm-panel">
      <h2>Your algorythm</h2>
      <FeedTabs layout="vertical" disabled={!$session} />
      <button disabled={!$session} on:click={() => refreshFeed()} aria-label="Refresh feed"><RefreshCw size={18} class={$loadingFeed ? 'spin' : ''} /> Refresh</button>
    </section>

    <section class="panel">
      <h2>Connected relays</h2>
      {#each $relays.filter((relay) => relay.enabled) as relay}
        <div class="relay-row">
          <span class:online={relayStatus[relay.url] === 'online'} class:offline={relayStatus[relay.url] === 'offline'} class="relay-status" aria-label={`${relay.url} ${relayStatus[relay.url] ?? 'checking'}`}></span>
          <Radio size={17} />
          <span>{relay.url.replace('wss://', '')}</span>
          <strong>{relay.read && relay.write ? 'read/write' : relay.read ? 'read' : 'write'}</strong>
        </div>
      {/each}
    </section>
  {/if}
</aside>
