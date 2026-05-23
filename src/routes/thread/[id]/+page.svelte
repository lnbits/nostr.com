<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, profiles } from '$lib/stores/app';

  $: id = $page.params.id;
  $: root = $events.find((event) => event.id === id);
  $: replies = $events.filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === id));
  let focusedReplyId = '';
  $: focusedReply = $events.find((event) => event.id === focusedReplyId);
  $: focusedReplyReplies = focusedReplyId ? $events.filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === focusedReplyId)) : [];

  function backToFeed() {
    if (history.length > 1) history.back();
    else void goto('/');
  }

  function focusReply(event: typeof root) {
    if (!event) return;
    focusedReplyId = focusedReplyId === event.id ? '' : event.id;
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
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
