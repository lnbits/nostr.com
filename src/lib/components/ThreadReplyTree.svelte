<script lang="ts">
  import NoteCard from '$lib/components/NoteCard.svelte';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

  export let parentId: string;
  export let repliesByParent: Record<string, NostrEvent[]> = {};
  export let profiles: Record<string, Profile> = {};
  export let depth = 0;

  $: replies = repliesByParent[parentId] ?? [];
</script>

{#each replies as reply (reply.id)}
  <div class="thread-reply" class:nested={depth > 0}>
    <NoteCard event={reply} profile={profiles[reply.pubkey]} />
    <svelte:self parentId={reply.id} {repliesByParent} {profiles} depth={depth + 1} />
  </div>
{/each}
