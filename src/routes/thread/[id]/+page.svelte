<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, mergeEvents, profiles, relays } from '$lib/stores/app';
  import { fetchMissingEvents, fetchProfiles } from '$lib/nostr/client';
  import type { NostrEvent } from '$lib/nostr/types';

  $: id = $page.params.id;
  $: root = rootEvent?.id === id ? rootEvent : $events.find((event) => event.id === id);
  $: replies = $events.filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === id));
  let focusedReplyId = '';
  let loading = true;
  let hydratedId = '';
  let rootEvent: NostrEvent | undefined;
  $: focusedReply = $events.find((event) => event.id === focusedReplyId);
  $: focusedReplyReplies = focusedReplyId ? $events.filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === focusedReplyId)) : [];

  onMount(() => {
    void hydrateThread();
  });

  $: if (browser && id && id !== hydratedId) void hydrateThread();

  function backToFeed() {
    if (history.length > 1) history.back();
    else void goto('/');
  }

  function focusReply(event: typeof root) {
    if (!event) return;
    focusedReplyId = focusedReplyId === event.id ? '' : event.id;
  }

  async function hydrateThread() {
    if (!id || hydratedId === id) return;
    hydratedId = id;
    loading = true;
    try {
      const cached = $events.find((event) => event.id === id);
      const [found] = cached ? [cached] : await fetchMissingEvents([id], $relays).catch(() => []);
      if (found) {
        rootEvent = found;
        events.update((existing) => mergeEvents([found], existing));
        if (!$profiles[found.pubkey]) {
          const [profile] = await fetchProfiles([found.pubkey], $relays).catch(() => []);
          if (profile) profiles.update((existing) => ({ ...existing, [profile.pubkey]: profile }));
        }
      }
    } finally {
      loading = false;
    }
  }
</script>

<section class="thread-page">
  <button class="thread-back" on:click={backToFeed}><ArrowLeft size={18} /> Feed</button>

  {#if root}
    <NoteCard event={root} profile={$profiles[root.pubkey]} />
    <div class="feed-list">
      {#each replies as event (event.id)}
        <NoteCard {event} profile={$profiles[event.pubkey]} featured={focusedReplyId === event.id} onOpen={focusReply} />
        {#if focusedReply?.id === event.id}
          <div class="nested-replies">
            {#each focusedReplyReplies as reply (reply.id)}
              <NoteCard event={reply} profile={$profiles[reply.pubkey]} />
            {:else}
              <div class="empty-state compact"><strong>No cached replies to this note yet</strong><span>Try refreshing the feed to hydrate more of the conversation.</span></div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="empty-state"><strong>No cached replies yet</strong><span>Missing event fetching is ready in the Nostr client layer.</span></div>
      {/each}
    </div>
  {:else if loading}
    <div class="empty-state"><span>Loading thread</span></div>
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
