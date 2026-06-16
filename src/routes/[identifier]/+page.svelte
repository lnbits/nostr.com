<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { eventPointerFromIdentifier, profilePointerFromIdentifier } from '$lib/nostr/identifiers';
  import { nipBySlug } from '$lib/nips';
  import { appPath } from '$lib/paths';
  import NipView from '$lib/components/NipView.svelte';

  $: identifier = decodeURIComponent($page.params.identifier ?? '');
  $: nip = nipBySlug[identifier.toLowerCase()];

  onMount(() => {
    if (nip) return;

    const eventPointer = eventPointerFromIdentifier(identifier);
    if (eventPointer) {
      void goto(appPath(`/thread/${encodeURIComponent(identifier)}`), { replaceState: true });
      return;
    }

    const profilePointer = profilePointerFromIdentifier(identifier);
    if (profilePointer) {
      void goto(appPath(`/profile/${profilePointer.pubkey}`), { replaceState: true });
      return;
    }

    void goto(appPath('/'), { replaceState: true });
  });
</script>

{#if nip}
  <NipView {nip} />
{:else}
  <section class="empty-state">
    <span>Opening Nostr link</span>
  </section>
{/if}
