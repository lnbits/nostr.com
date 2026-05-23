<script lang="ts">
  import {
    Bell,
    Compass,
    Home,
    Mail,
    MoreHorizontal,
    Settings,
    UserRound,
    Zap
  } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { session, startCompose } from '$lib/stores/app';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/#explore', label: 'Explore', icon: Compass },
    { href: '/#notifications', label: 'Notifications', icon: Bell },
    { href: '/#messages', label: 'Messages', icon: Mail },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '#more', label: 'More', icon: MoreHorizontal }
  ];

  $: profileHref = $session ? `/profile/${$session.pubkey}` : '/';
</script>

<aside class="left-nav" aria-label="Primary">
  <div class="left-nav-head">
    <a class="left-logo" href="/" aria-label="Nostr home">nostr</a>
    <ThemeToggle />
  </div>

  <nav class="left-nav-list">
    {#each navItems as item}
      <a class:active={$page.url.pathname === item.href} href={item.href}>
        <svelte:component this={item.icon} size={26} />
        <span>{item.label}</span>
      </a>
    {/each}
    <a class:active={$page.url.pathname.startsWith('/profile')} href={profileHref}>
      <UserRound size={26} />
      <span>Profile</span>
    </a>
  </nav>

  <button class="compose-wide" on:click={startCompose}><Zap size={21} /> Note</button>
</aside>
