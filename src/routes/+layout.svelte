<script lang="ts">
  import '../styles.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Bell, Home, Info, LogIn, Mail, Settings, UserRound } from '@lucide/svelte';
  import { bootstrap, directMessages, goHome, loginDialogOpen, markMessagesSeen, markNotificationsSeen, notifications, selectMessagePeer, session, unreadMessageCount, unreadNotificationCount } from '$lib/stores/app';
  import Composer from '$lib/components/Composer.svelte';
  import LeftNav from '$lib/components/LeftNav.svelte';
  import LoginDialog from '$lib/components/LoginDialog.svelte';
  import OnboardingDialog from '$lib/components/OnboardingDialog.svelte';
  import RightRail from '$lib/components/RightRail.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { appPath } from '$lib/paths';
  import { themeMode, type ThemeMode } from '$lib/stores/theme';

  const rightRailStorageKey = 'nostr-right-rail-collapsed';
  const siteUrl = 'https://nostr.com';
  const homeDescription = 'Nostr is a free and open-source protocol for social media and other things - controlled by users, not platforms.';
  const infoDescription =
    'Learn how Nostr (Notes and Other Stuff Transmitted by Relays) enables social media and applications without centralized platforms or walled gardens.';
  const homeSeo = {
    title: 'nostr - controlled by users, not platforms',
    description: homeDescription,
    path: '/',
    image: '/screenshot-feed-dark.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'nostr',
      url: siteUrl,
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Web',
      description: homeDescription
    }
  };
  const infoSeo = {
    title: 'What is Nostr? Notes and Other Stuff Transmitted by Relays',
    description: infoDescription,
    path: '/info',
    image: '/banner.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'What is Nostr?',
      description: infoDescription,
      url: `${siteUrl}/info`,
      mainEntityOfPage: `${siteUrl}/info`,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      }
    }
  };
  let rightRailCollapsed = false;
  $: embeddedPage = $page.route.id?.startsWith('/embed/') ?? false;
  $: seo = $page.route.id === '/info' ? infoSeo : $page.route.id === '/' ? homeSeo : null;
  $: canonicalUrl = seo ? `${siteUrl}${seo.path}` : siteUrl;
  $: previewImageUrl = seo ? `${siteUrl}${seo.image}` : `${siteUrl}/screenshot-feed-dark.png`;
  $: seoJsonLd = seo ? JSON.stringify(seo.schema) : '';
  $: notificationCount = badgeCount($unreadNotificationCount);
  $: messageCount = badgeCount($unreadMessageCount);
  $: if ($session && $page.route.id === '/notifications') markNotificationsSeen();
  $: if ($session && $page.route.id === '/messages') markMessagesSeen();

  function badgeCount(count: number) {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
  }

  onMount(() => {
    let stopNativeChrome: (() => void) | undefined;
    if (!embeddedPage) {
      void bootstrap();
      rightRailCollapsed = localStorage.getItem(rightRailStorageKey) === 'true';
      void configureNativeChrome().then((cleanup) => (stopNativeChrome = cleanup));
    }
    return () => stopNativeChrome?.();
  });

  function toggleRightRail() {
    rightRailCollapsed = !rightRailCollapsed;
    localStorage.setItem(rightRailStorageKey, String(rightRailCollapsed));
  }

  async function configureNativeChrome() {
    const [{ Capacitor, registerPlugin }, { StatusBar, Style }] = await Promise.all([import('@capacitor/core'), import('@capacitor/status-bar')]);
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add('native-shell');
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    const NavigationBar = registerPlugin('NavigationBar') as {
      setColor?: (options: { color: string; darkButtons?: boolean }) => Promise<void>;
      setNavigationBarColor?: (options: { color: string; darkButtons?: boolean }) => Promise<void>;
    };

    return themeMode.subscribe((mode) => {
      const color = mode === 'dark' ? '#0f172a' : '#fffdf8';
      void StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
      void (NavigationBar.setColor?.({ color, darkButtons: mode === 'light' }) ?? NavigationBar.setNavigationBarColor?.({ color, darkButtons: mode === 'light' }))?.catch(
        () => undefined
      );
    });
  }
</script>

<svelte:head>
  {#if seo}
    <title>{seo.title}</title>
    <meta name="description" content={seo.description} />
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:type" content={$page.route.id === '/info' ? 'article' : 'website'} />
    <meta property="og:site_name" content="nostr" />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:image" content={previewImageUrl} />
    <meta property="og:image:alt" content={$page.route.id === '/info' ? 'nostr information banner' : 'nostr social client feed preview'} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={seo.title} />
    <meta name="twitter:description" content={seo.description} />
    <meta name="twitter:image" content={previewImageUrl} />
    {@html `<script type="application/ld+json">${seoJsonLd}</script>`}
  {:else}
    <title>Nostr</title>
  {/if}
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
          <strong>nostr</strong>
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
      <a class="tabbar-badge-link" href={appPath('/notifications')} aria-label={notificationCount ? `${notificationCount} notifications` : 'Notifications'} on:click={markNotificationsSeen}>
        <Bell size={22} />
        {#if notificationCount}
          <span class="tabbar-badge">{notificationCount}</span>
        {/if}
      </a>
      <a class="tabbar-badge-link" href={appPath('/messages')} aria-label={messageCount ? `${messageCount} messages` : 'Messages'} on:click={() => { markMessagesSeen(); selectMessagePeer(''); }}>
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
  <OnboardingDialog />
  <Composer />
  </div>
{/if}
