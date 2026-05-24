<script lang="ts">
  import '../styles.css';
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Bell, Home, Info, LogIn, Mail, Settings, UserRound } from '@lucide/svelte';
  import { bootstrap, goHome, loginDialogOpen, relays, selectMessagePeer, session } from '$lib/stores/app';
  import Composer from '$lib/components/Composer.svelte';
  import LeftNav from '$lib/components/LeftNav.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { startRelayStatusChecks } from '$lib/stores/relayStatus';

  const rightRailStorageKey = 'nostr-right-rail-collapsed';
  let rightRailCollapsed = false;
  let stopRelayStatusChecks = () => {};
  $: embeddedPage = $page.url.pathname.startsWith('/embed/');

  onMount(() => {
    if (!embeddedPage) {
      void bootstrap();
      stopRelayStatusChecks = startRelayStatusChecks(relays);
      rightRailCollapsed = localStorage.getItem(rightRailStorageKey) === 'true';
    }
  });

  onDestroy(() => {
    stopRelayStatusChecks();
  });

  function toggleRightRail() {
    rightRailCollapsed = !rightRailCollapsed;
    localStorage.setItem(rightRailStorageKey, String(rightRailCollapsed));
  }
</script>

<svelte:head>
  <title>Nostr</title>
</svelte:head>

{#if embeddedPage}
  <main class="embed-shell">
    <slot />
  </main>
{:else}
  <div class="app-frame">
    {#if $session}
    <div class="authed-shell" class:rail-collapsed={rightRailCollapsed}>
      <LeftNav />
      <main class="authed-main">
        <slot />
      </main>
      <RightRail collapsible collapsed={rightRailCollapsed} onToggle={toggleRightRail} />
    </div>
  {:else}
    <header class="topbar">
      <div class="brand-row">
        <a class="brand" href="/" aria-label="Nostr home" on:click={goHome}>
          <strong>Nostr</strong>
          <span>controlled by users, not platforms</span>
        </a>
        <a class="icon-button info-link" href="/#info" aria-label="Learn about Nostr">
          <Info size={18} />
        </a>
      </div>
      <div class="topbar-actions">
        <ThemeToggle />
      </div>
    </header>

    <main class="guest-main">
      <div class="shell">
        <slot />
        <RightRail />
      </div>
    </main>
  {/if}

  <nav class="tabbar" class:guest={!$session} aria-label="Primary">
    {#if $session}
      <a href="/" aria-label="Home" on:click={goHome}><Home size={22} /></a>
      <a href="/#notifications" aria-label="Notifications"><Bell size={22} /></a>
      <a href="/#messages" aria-label="Messages" on:click={() => selectMessagePeer('')}><Mail size={22} /></a>
      <a href="/settings" aria-label="Settings"><Settings size={22} /></a>
      <a href={`/profile/${$session.pubkey}`} aria-label="Profile"><UserRound size={22} /></a>
    {:else}
      <button class="tabbar-signin" on:click={() => loginDialogOpen.set(true)}><LogIn size={19} /> Sign in</button>
      <a class="tabbar-info" href="/#info" aria-label="Info">i</a>
    {/if}
  </nav>

  <LoginDialog />
  <Composer />
  </div>
{/if}
