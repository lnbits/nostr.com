<script lang="ts">
  import '../styles.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Bell, Home, Info, LogIn, Mail, Settings, SlidersHorizontal, UserRound, X } from '@lucide/svelte';
  import { bootstrap, directMessages, goHome, loginDialogOpen, markMessagesSeen, markNotificationsSeen, notifications, selectMessagePeer, session, unreadMessageCount, unreadNotificationCount } from '$lib/stores/app';
  import Composer from '$lib/components/Composer.svelte';
  import AlgorithmPanel from '$lib/components/AlgorithmPanel.svelte';
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
  const clientsDescription =
    'Learn what Nostr clients are, why there are many different clients, how switching apps works, and how to protect your private key.';
  const nostrKeysDescription =
    'Learn the difference between Nostr public keys and private keys, how signed notes work, and why protecting your private key matters.';
  const pomegranateDescription =
    'Learn how Pomegranate helps you use Nostr without giving every app your private key, by splitting key control across operators and using Google sign-in.';
  const relaysDescription =
    'Learn what Nostr relays are, why they matter, how to choose reliable relays, and what happens when relays go offline.';
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
  const clientsSeo = {
    title: 'Nostr Clients: Apps for using the Nostr network',
    description: clientsDescription,
    path: '/clients',
    image: '/banner.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Nostr Clients',
      description: clientsDescription,
      url: `${siteUrl}/clients`,
      mainEntityOfPage: `${siteUrl}/clients`,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      }
    }
  };
  const nostrKeysSeo = {
    title: 'Nostr Keys: Public keys, private keys, and signed notes',
    description: nostrKeysDescription,
    path: '/nostr-keys',
    image: '/banner.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Nostr Keys',
      description: nostrKeysDescription,
      url: `${siteUrl}/nostr-keys`,
      mainEntityOfPage: `${siteUrl}/nostr-keys`,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      }
    }
  };
  const pomegranateSeo = {
    title: 'Pomegranate / Google-Auth: Safer Nostr login with split key signing',
    description: pomegranateDescription,
    path: '/pomegranate',
    image: '/banner.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Pomegranate / Google-Auth',
      description: pomegranateDescription,
      url: `${siteUrl}/pomegranate`,
      mainEntityOfPage: `${siteUrl}/pomegranate`,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      }
    }
  };
  const relaysSeo = {
    title: 'Nostr Relays: What they are and why they matter',
    description: relaysDescription,
    path: '/relays',
    image: '/banner.png',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Nostr Relays',
      description: relaysDescription,
      url: `${siteUrl}/relays`,
      mainEntityOfPage: `${siteUrl}/relays`,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      }
    }
  };
  let rightRailCollapsed = false;
  let guestAlgorithmDialogOpen = false;
  $: embeddedPage = $page.route.id?.startsWith('/embed/') ?? false;
  $: seo =
    $page.route.id === '/clients'
      ? clientsSeo
      : $page.route.id === '/nostr-keys'
        ? nostrKeysSeo
        : $page.route.id === '/pomegranate'
          ? pomegranateSeo
          : $page.route.id === '/relays'
            ? relaysSeo
            : $page.route.id === '/info'
              ? infoSeo
              : $page.route.id === '/'
                ? homeSeo
                : null;
  $: canonicalUrl = seo ? `${siteUrl}${seo.path}` : siteUrl;
  $: previewImageUrl = seo ? `${siteUrl}${seo.image}` : `${siteUrl}/screenshot-feed-dark.png`;
  $: seoJsonLd = seo ? JSON.stringify([seo.schema, breadcrumbSchema(seo.path, pageNameForSeo(seo))]) : '';
  $: notificationCount = badgeCount($unreadNotificationCount);
  $: messageCount = badgeCount($unreadMessageCount);
  $: if ($session && $page.route.id === '/notifications') markNotificationsSeen();
  $: if ($session && $page.route.id === '/messages') markMessagesSeen();

  function badgeCount(count: number) {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
  }

  function pageNameForSeo(selectedSeo: { title: string; schema: Record<string, unknown> }) {
    return String(selectedSeo.schema.headline ?? selectedSeo.schema.name ?? selectedSeo.title);
  }

  function breadcrumbSchema(path: string, name: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'nostr',
          item: siteUrl
        },
        {
          '@type': 'ListItem',
          position: 2,
          name,
          item: `${siteUrl}${path}`
        }
      ]
    };
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
      const color = mode === 'dark' ? '#000000' : '#fffdf8';
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
    <meta property="og:type" content={$page.route.id === '/info' || $page.route.id === '/clients' || $page.route.id === '/nostr-keys' || $page.route.id === '/pomegranate' || $page.route.id === '/relays' ? 'article' : 'website'} />
    <meta property="og:site_name" content="nostr" />
    <meta property="og:title" content={seo.title} />
    <meta property="og:description" content={seo.description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:image" content={previewImageUrl} />
    <meta property="og:image:alt" content={$page.route.id === '/info' || $page.route.id === '/clients' || $page.route.id === '/nostr-keys' || $page.route.id === '/pomegranate' || $page.route.id === '/relays' ? 'nostr information banner' : 'nostr social client feed preview'} />
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
        <span class="guest-theme-toggle"><ThemeToggle /></span>
        <button class="topbar-algo-button" type="button" on:click={() => (guestAlgorithmDialogOpen = true)} aria-label="Open algorithm settings"><SlidersHorizontal size={17} /> Algo</button>
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
  {#if guestAlgorithmDialogOpen}
    <div class="dialog-backdrop algorithm-dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && (guestAlgorithmDialogOpen = false)}>
      <div class="dialog-panel compact algorithm-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-algorithm-title">
        <div class="dialog-head">
          <h2 id="guest-algorithm-title">Your algorithm</h2>
          <button class="icon-button" on:click={() => (guestAlgorithmDialogOpen = false)} aria-label="Close algorithm settings"><X size={20} /></button>
        </div>
        <AlgorithmPanel title="" labelledBy="guest-algorithm-title" />
      </div>
    </div>
  {/if}
  <OnboardingDialog />
  <Composer />
  </div>
{/if}
