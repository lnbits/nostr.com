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
  import { appPath } from '$lib/paths';

  const rightRailStorageKey = 'nostr-right-rail-collapsed';
  let rightRailCollapsed = false;
  let stopRelayStatusChecks = () => {};
  let relayStatusTimer: ReturnType<typeof setTimeout> | undefined;
  $: embeddedPage = $page.route.id?.startsWith('/embed/') ?? false;

  onMount(() => {
    if (!embeddedPage) {
      void bootstrap();
      relayStatusTimer = setTimeout(() => {
        stopRelayStatusChecks = startRelayStatusChecks(relays);
      }, 1500);
      rightRailCollapsed = localStorage.getItem(rightRailStorageKey) === 'true';
    }
  });

  onDestroy(() => {
    clearTimeout(relayStatusTimer);
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
        <a class="brand" href={appPath('/')} aria-label="Nostr home" on:click={goHome}>
          <strong>Nostr</strong>
          <span>controlled by users, not platforms</span>
        </a>
        <a class="icon-button info-link" href={appPath('/#info')} aria-label="Learn about Nostr">
          <Info size={18} />
        </a>
      </div>
      <div class="topbar-actions">
        <ThemeToggle />
      </div>
    </header>

    <main class="guest-main">
      <div class="shell">
        <div class="guest-content">
          <slot />
        </div>
        <RightRail />
      </div>
    </main>
  {/if}

  <nav class="tabbar" class:guest={!$session} aria-label="Primary">
    {#if $session}
      <a href={appPath('/')} aria-label="Home" on:click={goHome}><Home size={22} /></a>
      <a href={appPath('/#notifications')} aria-label="Notifications"><Bell size={22} /></a>
      <a href={appPath('/#messages')} aria-label="Messages" on:click={() => selectMessagePeer('')}><Mail size={22} /></a>
      <a href={appPath('/settings')} aria-label="Settings"><Settings size={22} /></a>
      <a href={appPath(`/profile/${$session.pubkey}`)} aria-label="Profile"><UserRound size={22} /></a>
    {:else}
      <button class="tabbar-signin" on:click={() => loginDialogOpen.set(true)}><LogIn size={19} /> Sign in</button>
      <a class="tabbar-info" href={appPath('/#info')} aria-label="Info">i</a>
    {/if}
  </nav>

  <LoginDialog />
  <Composer />
  </div>
{/if}
