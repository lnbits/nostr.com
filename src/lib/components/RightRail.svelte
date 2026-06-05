<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Apple, ChevronsLeft, ChevronsRight, Download, Globe, LogIn, Monitor, Smartphone, Terminal, X } from '@lucide/svelte';
  import AlgorithmPanel from './AlgorithmPanel.svelte';
  import { loginDialogOpen, relays, session } from '$lib/stores/app';
  import { relayStatus } from '$lib/stores/relayStatus';

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  export let collapsible = false;
  export let collapsed = false;
  export let onToggle = () => {};

  const releaseBase = 'https://github.com/lnbits/nostr_social/releases/latest/download';
  const desktopDownloads = [
    { label: 'macOS', detail: 'DMG · Apple Silicon', href: `${releaseBase}/Nostr-Social-macOS-arm64.dmg`, icon: Apple },
    { label: 'Windows', detail: 'Installer (.exe) · x64', href: `${releaseBase}/Nostr-Social-Windows-x64.exe`, icon: Monitor },
    { label: 'Linux', detail: 'AppImage · x86_64', href: `${releaseBase}/Nostr-Social-Linux-x86_64.AppImage`, icon: Terminal },
    { label: 'Android', detail: 'APK · universal debug build', href: `${releaseBase}/Nostr-Social-Android.apk`, icon: Smartphone }
  ];

  let installPrompt: BeforeInstallPromptEvent | null = null;
  let canInstall = false;
  let installed = false;
  let installBusy = false;
  let installDialogOpen = false;

  $: showInstallButton = !installed;

  onMount(() => {
    installed = isStandalone();
    const beforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt = event as BeforeInstallPromptEvent;
      canInstall = !installed;
    };
    const appInstalled = () => {
      installed = true;
      canInstall = false;
      installPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', beforeInstallPrompt);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPrompt);
      window.removeEventListener('appinstalled', appInstalled);
    };
  });

  onDestroy(() => {
    installPrompt = null;
  });

  async function installPwa() {
    if (!installPrompt) return;
    installBusy = true;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } finally {
      installPrompt = null;
      canInstall = false;
      installBusy = false;
    }
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches;
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
      <AlgorithmPanel />
    </section>

    <section class="panel">
      <h2>Connected relays</h2>
      {#each $relays.filter((relay) => relay.enabled) as relay}
        <div class="relay-row">
          <span class:online={$relayStatus[relay.url] === 'online'} class:offline={$relayStatus[relay.url] === 'offline'} class="relay-status" aria-label={`${relay.url} ${$relayStatus[relay.url] ?? 'checking'}`}></span>
          <span>{relay.url.replace('wss://', '')}</span>
          <strong>{relay.read && relay.write ? 'read/write' : relay.read ? 'read' : 'write'}</strong>
        </div>
      {/each}
    </section>

    {#if showInstallButton}
      <section class="panel install-panel">
        <button class="primary" on:click={() => (installDialogOpen = true)}>
          <Download size={18} /> Install
        </button>
      </section>
    {/if}
  {/if}
</aside>

{#if installDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && (installDialogOpen = false)}>
    <div class="dialog-panel compact desktop-install-dialog" role="dialog" aria-modal="true" aria-labelledby="desktop-install-title">
      <div class="dialog-head">
        <div>
          <h2 id="desktop-install-title">Install Nostr</h2>
          <p>Choose a desktop build from the latest release.</p>
        </div>
        <button class="icon-button" on:click={() => (installDialogOpen = false)} aria-label="Close install dialog"><X size={20} /></button>
      </div>

      <div class="desktop-install-list">
        {#each desktopDownloads as item}
          <a class="desktop-install-option" href={item.href} target="_blank" rel="noreferrer">
            <svelte:component this={item.icon} size={34} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
            <Download size={18} />
          </a>
        {/each}

        {#if canInstall}
          <button class="desktop-install-option" disabled={installBusy} on:click={installPwa}>
            <Globe size={34} />
            <span>
              <strong>Install as PWA</strong>
              <small>{installBusy ? 'Opening browser install prompt' : 'Browser app · no download'}</small>
            </span>
            <Download size={18} />
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
