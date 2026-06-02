<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { MessageSquareText } from '@lucide/svelte';
  import { events, mergeProfileRecords, profiles, relays } from '$lib/stores/app';
  import { fetchMissingEvents, fetchProfiles } from '$lib/nostr/client';
  import { appPath } from '$lib/paths';
  import { saveRouteScrollState } from '$lib/stores/routeScroll';
  import { currentThreadReturnTarget, saveThreadReturnTarget } from '$lib/stores/threadNavigation';
  import { saveThreadSeed } from '$lib/stores/threadSeed';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

  export let ids: string[] = [];
  export let compact = false;

  let loadingIds = new Set<string>();
  let fetchedEvents: Record<string, NostrEvent> = {};
  $: cleanIds = [...new Set(ids.filter((id) => /^[0-9a-f]{64}$/i.test(id)))].slice(0, 3);
  $: quotedEvents = cleanIds.map((id) => $events.find((event) => event.id === id) ?? fetchedEvents[id]).filter((event): event is NostrEvent => Boolean(event));

  onMount(() => {
    void hydrateQuotes();
  });

  $: if (cleanIds.length) void hydrateQuotes();

  async function hydrateQuotes() {
    const missing = cleanIds.filter((id) => !$events.some((event) => event.id === id) && !fetchedEvents[id] && !loadingIds.has(id));
    if (!missing.length) return;
    loadingIds = new Set([...loadingIds, ...missing]);
    try {
      const found = await fetchMissingEvents(missing, $relays).catch(() => []);
      if (found.length) {
        fetchedEvents = { ...fetchedEvents, ...Object.fromEntries(found.map((event) => [event.id, event])) };
        const missingProfiles = [...new Set(found.map((event) => event.pubkey).filter((pubkey) => !$profiles[pubkey]))];
        const foundProfiles = missingProfiles.length ? await fetchProfiles(missingProfiles, $relays).catch(() => []) : [];
        if (foundProfiles.length) profiles.update((existing) => mergeProfileRecords(existing, foundProfiles));
      }
    } finally {
      loadingIds = new Set([...loadingIds].filter((id) => !missing.includes(id)));
    }
  }

  function profileName(pubkey: string, profile?: Profile) {
    return profile?.display_name || profile?.name || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  }

  function preview(content: string) {
    return content.replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function openQuotedNote(clickEvent: MouseEvent, event: NostrEvent) {
    if (clickEvent.button !== 0 || clickEvent.metaKey || clickEvent.ctrlKey || clickEvent.shiftKey || clickEvent.altKey) return;
    clickEvent.preventDefault();
    const threadPath = appPath(`/thread/${event.id}`);
    if ($page.url.pathname === threadPath) return;
    saveCurrentRoutePosition(clickEvent.currentTarget);
    saveThreadSeed(event);
    saveThreadReturnTarget(event.id, currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash));
    void goto(threadPath);
  }

  function saveCurrentRoutePosition(target: EventTarget | null) {
    const anchor = target instanceof Element ? target.closest<HTMLElement>('[data-note-id]') : null;
    if (!anchor?.dataset.noteId) return;
    saveRouteScrollState(
      currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash),
      {
        scrollY: window.scrollY,
        anchorId: anchor.dataset.noteId,
        anchorOffset: anchor.getBoundingClientRect().top
      },
      { exact: true }
    );
  }
</script>

{#if quotedEvents.length}
  <div class="quoted-note-list" class:compact>
    {#each quotedEvents as event (event.id)}
      {@const profile = $profiles[event.pubkey]}
      <a
        class="quoted-note"
        href={appPath(`/thread/${event.id}`)}
        aria-label="Open quoted note"
        on:click={(clickEvent) => openQuotedNote(clickEvent, event)}
      >
        <span class="avatar mini">
          {#if profile?.picture}
            <img src={profile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
          {:else}
            <span>{profileName(event.pubkey, profile).slice(0, 1).toUpperCase()}</span>
          {/if}
        </span>
        <span class="quoted-note-body">
          <strong>{profileName(event.pubkey, profile)}</strong>
          <span>{preview(event.content) || 'Open quoted note'}</span>
        </span>
      </a>
    {/each}
  </div>
{:else if cleanIds.length}
  <div class="quoted-note-list" class:compact>
    {#each cleanIds as id (id)}
      <a class="quoted-note loading" href={appPath(`/thread/${id}`)}>
        <MessageSquareText size={18} />
        <span class="quoted-note-body">
          <strong>Quoted note</strong>
          <span>Loading note preview</span>
        </span>
      </a>
    {/each}
  </div>
{/if}
