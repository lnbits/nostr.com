<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { eventPointerFromIdentifier, profilePointerFromIdentifier } from '$lib/nostr/identifiers';
  import { appPath } from '$lib/paths';

  $: identifier = decodeURIComponent($page.params.identifier ?? '');

  onMount(() => {
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

<section class="empty-state">
  <span>Opening Nostr link</span>
</section>
