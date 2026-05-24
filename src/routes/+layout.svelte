<script lang="ts">
  import '../styles.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Bell, Home, Info, LogIn, Mail, Settings, UserRound } from '@lucide/svelte';
  import { bootstrap, directMessages, goHome, loginDialogOpen, markMessagesSeen, markNotificationsSeen, notifications, selectMessagePeer, session, unreadMessageCount, unreadNotificationCount } from '$lib/stores/app';
  import Composer from '$lib/components/Composer.svelte';
  import LeftNav from '$lib/components/LeftNav.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { appPath } from '$lib/paths';

  const rightRailStorageKey = 'nostr-right-rail-collapsed';
  let rightRailCollapsed = false;
  $: embeddedPage = $page.route.id?.startsWith('/embed/') ?? false;
  $: notificationCount = badgeCount($unreadNotificationCount);
  $: messageCount = badgeCount($unreadMessageCount);
  $: if ($session && $page.route.id === '/notifications' && $notifications.length) markNotificationsSeen();
  $: if ($session && $page.route.id === '/messages' && $directMessages.length) markMessagesSeen();

  function badgeCount(count: number) {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
  }

  onMount(() => {
    if (!embeddedPage) {
      void bootstrap();
      rightRailCollapsed = localStorage.getItem(rightRailStorageKey) === 'true';
      void configureNativeChrome();
    }
  });

  function toggleRightRail() {
    rightRailCollapsed = !rightRailCollapsed;
    localStorage.setItem(rightRailStorageKey, String(rightRailCollapsed));
  }

  async function configureNativeChrome() {
    const [{ Capacitor }, { StatusBar, Style }] = await Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')]);
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add('native-shell');
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    await StatusBar.setStyle({ style: Style.Default }).catch(() => undefined);
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
        <a class="icon-button info-link" href={appPath('/info')} aria-label="Learn about Nostr">
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
      <a class="tabbar-badge-link" href={appPath('/notifications')} aria-label={notificationCount ? `${notificationCount} notifications` : 'Notifications'}>
        <Bell size={22} />
        {#if notificationCount}
          <span class="tabbar-badge">{notificationCount}</span>
        {/if}
      </a>
      <a class="tabbar-badge-link" href={appPath('/messages')} aria-label={messageCount ? `${messageCount} messages` : 'Messages'} on:click={() => selectMessagePeer('')}>
        <Mail size={22} />
        {#if messageCount}
          <span class="tabbar-badge">{messageCount}</span>
        {/if}
      </a>
      <a href={appPath('/settings')} aria-label="Settings"><Settings size={22} /></a>
      <a href={appPath(`/profile/${$session.pubkey}`)} aria-label="Profile"><UserRound size={22} /></a>
    {:else}
      <button class="tabbar-signin" on:click={() => loginDialogOpen.set(true)}><LogIn size={19} /> Sign in</button>
      <a class="tabbar-info" href={appPath('/info')} aria-label="Info">i</a>
    {/if}
  </nav>

  <LoginDialog />
  <Composer />
  </div>
{/if}
