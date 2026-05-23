<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, mergeEvents, profiles, relays } from '$lib/stores/app';
  import { fetchMissingEvents, fetchProfiles } from '$lib/nostr/client';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

  let loading = true;
  let event: NostrEvent | undefined;
  let profile: Profile | undefined;
  let embedCard: HTMLElement;
  let resizeObserver: ResizeObserver | undefined;
  let previousTheme: string | undefined;

  $: id = $page.params.id;

  onMount(() => {
    previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'dark';
    void hydrateEmbed();
    resizeObserver = new ResizeObserver(() => postEmbedSize());
    if (embedCard) resizeObserver.observe(embedCard);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (!browser) return;
    if (previousTheme) document.documentElement.dataset.theme = previousTheme;
    else delete document.documentElement.dataset.theme;
  });

  async function hydrateEmbed() {
    if (!id) {
      loading = false;
      return;
    }
    loading = true;
    try {
      const cached = $events.find((item) => item.id === id);
      const [found] = cached ? [cached] : await fetchMissingEvents([id], $relays);
      event = found;
      if (found) {
        events.update((existing) => mergeEvents([found], existing));
        const cachedProfile = $profiles[found.pubkey];
        const [freshProfile] = cachedProfile ? [cachedProfile] : await fetchProfiles([found.pubkey], $relays).catch(() => []);
        profile = freshProfile;
        if (freshProfile) profiles.update((existing) => ({ ...existing, [freshProfile.pubkey]: freshProfile }));
      }
    } finally {
      loading = false;
      await tick();
      postEmbedSize();
    }
  }

  function postEmbedSize() {
    if (!id || typeof window === 'undefined' || !embedCard) return;
    const height = Math.ceil(embedCard.getBoundingClientRect().height);
    window.parent.postMessage({ type: 'nostr-embed-size', id, height }, '*');
  }
</script>

<svelte:head>
  <title>Nostr note embed</title>
</svelte:head>

<section class="embed-card" bind:this={embedCard}>
  {#if event}
    <NoteCard {event} {profile} embedded />
  {:else if loading}
    <div class="empty-state compact"><span>Loading note</span></div>
  {:else}
    <div class="empty-state compact"><strong>Note unavailable</strong><span>The event was not found on the connected relays.</span></div>
  {/if}
</section>
