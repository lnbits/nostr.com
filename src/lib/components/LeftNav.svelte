<script lang="ts">
  import {
    Bell,
    Home,
    Mail,
    MoreHorizontal,
    Settings,
    UserRound,
    Zap
  } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goHome, session, startCompose } from '$lib/stores/app';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/#notifications', label: 'Notifications', icon: Bell },
    { href: '/#messages', label: 'Messages', icon: Mail },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  $: profileHref = $session ? `/profile/${$session.pubkey}` : '/';
  $: currentHref = `${$page.url.pathname}${$page.url.hash}`;

  function isActive(href: string) {
    if (href === '/') return $page.url.pathname === '/' && !$page.url.hash;
    if (href.startsWith('/#')) return currentHref === href;
    return $page.url.pathname === href;
  }
</script>

<aside class="left-nav" aria-label="Primary">
  <div class="left-nav-head">
    <a class="left-logo" href="/" aria-label="Nostr home" on:click={goHome}>nostr</a>
    <div class="nav-tools">
      <ThemeToggle />
    </div>
  </div>

  <nav class="left-nav-list">
    {#each navItems as item}
      <a class:active={isActive(item.href)} href={item.href} on:click={item.href === '/' ? goHome : undefined}>
        <svelte:component this={item.icon} size={26} />
        <span>{item.label}</span>
      </a>
    {/each}
    <a class:active={$page.url.pathname.startsWith('/profile')} href={profileHref}>
      <UserRound size={26} />
      <span>Profile</span>
    </a>
    <a class:active={isActive('/#info')} href="/#info">
      <MoreHorizontal size={26} />
      <span>info</span>
    </a>
  </nav>

  <button class="compose-wide" on:click={startCompose}><Zap size={21} /> Note</button>
</aside>
