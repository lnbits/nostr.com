<script lang="ts">
  import '../styles.css';
  import { onMount } from 'svelte';
  import { Bell, Home, Info, Settings, UserRound } from '@lucide/svelte';
  import { bootstrap, session } from '$lib/stores/app';
  import Composer from '$lib/components/Composer.svelte';
  import LeftNav from '$lib/components/LeftNav.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  const rightRailStorageKey = 'nostr-right-rail-collapsed';
  let rightRailCollapsed = false;

  onMount(() => {
    void bootstrap();
    rightRailCollapsed = localStorage.getItem(rightRailStorageKey) === 'true';
  });

  function toggleRightRail() {
    rightRailCollapsed = !rightRailCollapsed;
    localStorage.setItem(rightRailStorageKey, String(rightRailCollapsed));
  }
</script>

<svelte:head>
  <title>Nostr</title>
</svelte:head>

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
        <a class="brand" href="/" aria-label="Nostr home">
          <strong>Nostr</strong>
          <span>controlled by users, not platforms</span>
        </a>
        <a class="icon-button info-link" href="https://nostr.org" target="_blank" rel="noreferrer" aria-label="Learn about Nostr">
          <Info size={18} />
        </a>
      </div>
      <div class="topbar-actions">
        <ThemeToggle />
      </div>
    </header>

    <main>
      <slot />
    </main>
  {/if}

  <nav class="tabbar" aria-label="Primary">
    <a href="/" aria-label="Home"><Home size={22} /></a>
    <a href="/#notifications" aria-label="Notifications"><Bell size={22} /></a>
    <a href={$session ? `/profile/${$session.pubkey}` : '/#login'} aria-label="Profile"><UserRound size={22} /></a>
    <a href="/settings" aria-label="Settings"><Settings size={22} /></a>
  </nav>

  <LoginDialog />
  <Composer />
</div>
