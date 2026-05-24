<script lang="ts">
  import {
    Bell,
    Home,
    Mail,
    MoreHorizontal,
    PencilLine,
    Settings,
    UserRound
  } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goHome, selectMessagePeer, session, startCompose } from '$lib/stores/app';
  import { appPath } from '$lib/paths';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/messages', label: 'Messages', icon: Mail }
  ];

  $: profileHref = $session ? `/profile/${$session.pubkey}` : '/';

  function isActive(href: string) {
    if (href === '/') return $page.route.id === '/';
    return $page.route.id === href;
  }
</script>

<aside class="left-nav" aria-label="Primary">
  <div class="left-nav-head">
    <a class="left-logo" href={appPath('/')} aria-label="Nostr home" on:click={goHome}>nostr</a>
    <div class="nav-tools">
      <ThemeToggle />
    </div>
  </div>

  <nav class="left-nav-list">
    {#each navItems as item}
      <a
        class:active={isActive(item.href)}
        href={appPath(item.href)}
        on:click={item.href === '/' ? goHome : item.href === '/messages' ? () => selectMessagePeer('') : undefined}
      >
        <svelte:component this={item.icon} size={26} />
        <span>{item.label}</span>
      </a>
    {/each}
    <a class:active={$page.route.id?.startsWith('/profile/')} href={appPath(profileHref)}>
      <UserRound size={26} />
      <span>Profile</span>
    </a>
    <a class:active={isActive('/settings')} href={appPath('/settings')}>
      <Settings size={26} />
      <span>Settings</span>
    </a>
    <a class:active={isActive('/info')} href={appPath('/info')}>
      <MoreHorizontal size={26} />
      <span>info</span>
    </a>
    <button class="nav-compose" on:click={startCompose}>
      <PencilLine size={26} />
      <span>Note</span>
    </button>
  </nav>
</aside>
