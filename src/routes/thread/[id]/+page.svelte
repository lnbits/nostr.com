<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, mergeEvents, profiles, relays, session } from '$lib/stores/app';
  import { fetchMissingEvents, fetchProfiles, fetchThreadReplies } from '$lib/nostr/client';
  import type { NostrEvent } from '$lib/nostr/types';

  $: id = $page.params.id;
  $: threadEvents = mergeThreadEvents(localThreadEvents, $events);
  $: root = rootEvent?.id === id ? rootEvent : threadEvents.find((event) => event.id === id);
  $: replies = threadEvents.filter((event) => event.id !== id && event.tags.some((tag) => tag[0] === 'e' && tag[1] === id));
  let focusedReplyId = '';
  let loading = true;
  let hydratedId = '';
  let rootEvent: NostrEvent | undefined;
  let localThreadEvents: NostrEvent[] = [];
  $: focusedReply = threadEvents.find((event) => event.id === focusedReplyId);
  $: focusedReplyReplies = focusedReplyId ? threadEvents.filter((event) => event.id !== focusedReplyId && event.tags.some((tag) => tag[0] === 'e' && tag[1] === focusedReplyId)) : [];

  onMount(() => {
    void hydrateThread();
  });

  $: if (browser && id && id !== hydratedId) void hydrateThread();

  function focusReply(event: typeof root) {
    if (!event) return;
    focusedReplyId = focusedReplyId === event.id ? '' : event.id;
  }

  function mergeThreadEvents(incoming: NostrEvent[], existing: NostrEvent[]) {
    const byId = new Map<string, NostrEvent>();
    [...existing, ...incoming].forEach((event) => byId.set(event.id, event));
    return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
  }

  async function hydrateThread() {
    if (!id || hydratedId === id) return;
    hydratedId = id;
    focusedReplyId = '';
    localThreadEvents = [];
    loading = true;
    try {
      const cached = $events.find((event) => event.id === id);
      const [found] = cached ? [cached] : await fetchMissingEvents([id], $relays).catch(() => []);
      if (found) {
        rootEvent = found;
        localThreadEvents = mergeThreadEvents([found], localThreadEvents);
        events.update((existing) => mergeEvents([found], existing));
      }
      const fetchedReplies = await fetchThreadReplies(id, $relays).catch(() => []);
      if (fetchedReplies.length) {
        localThreadEvents = mergeThreadEvents(fetchedReplies, localThreadEvents);
      }

      const pubkeys = [...(found ? [found.pubkey] : []), ...fetchedReplies.map((event) => event.pubkey)];
      const missingPubkeys = [...new Set(pubkeys.filter((pubkey) => !$profiles[pubkey]))];
      if (missingPubkeys.length) {
        const fetchedProfiles = await fetchProfiles(missingPubkeys, $relays).catch(() => []);
        if (fetchedProfiles.length) profiles.update((existing) => ({ ...existing, ...Object.fromEntries(fetchedProfiles.map((profile) => [profile.pubkey, profile])) }));
      }
    } finally {
      loading = false;
    }
  }
</script>

<section class="thread-page">
  {#if !$session}
    <a class="info-back" href="/">← Feed</a>
  {/if}

  {#if root}
    <div class="feed-list">
      <NoteCard event={root} profile={$profiles[root.pubkey]} />
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
        <div class="empty-state"><strong>No replies found yet</strong><span>Relays did not return replies for this thread.</span></div>
      {/each}
    </div>
  {:else if loading}
    <div class="empty-state"><span>Loading thread</span></div>
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
