<script lang="ts">
  import { page } from '$app/stores';
  import Composer from '$lib/components/Composer.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, profiles } from '$lib/stores/app';

  $: id = $page.params.id;
  $: root = $events.find((event) => event.id === id);
  $: replies = $events.filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === id));
</script>

<section class="thread-page">
  {#if root}
    <NoteCard event={root} profile={$profiles[root.pubkey]} />
    <div class="feed-list">
      {#each replies as event (event.id)}
        <NoteCard {event} profile={$profiles[event.pubkey]} />
      {:else}
        <div class="empty-state"><strong>No cached replies yet</strong><span>Missing event fetching is ready in the Nostr client layer.</span></div>
      {/each}
    </div>
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
