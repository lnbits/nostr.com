<script lang="ts">
  import NoteCard from '$lib/components/NoteCard.svelte';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

  export let parentId: string;
  export let repliesByParent: Record<string, NostrEvent[]> = {};
  export let profiles: Record<string, Profile> = {};
  export let depth = 0;
  export let focusedId = '';

  $: replies = repliesByParent[parentId] ?? [];
</script>

{#each replies as reply (reply.id)}
  <div class="thread-reply" class:direct={depth === 0} class:nested={depth > 0}>
    <NoteCard event={reply} profile={profiles[reply.pubkey]} featured={reply.id === focusedId} />
    <svelte:self parentId={reply.id} {repliesByParent} {profiles} depth={depth + 1} {focusedId} />
  </div>
{/each}
