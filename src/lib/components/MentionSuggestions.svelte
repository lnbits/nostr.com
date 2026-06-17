<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { nip19 } from 'nostr-tools';
  import type { Profile } from '$lib/nostr/types';

  export let profiles: Profile[] = [];
  export let searching = false;

  const dispatch = createEventDispatcher<{ select: Profile }>();

  function profileLabel(profile: Profile | undefined) {
    return firstString(profile?.display_name, profile?.name, profile?.nip05) || (profile?.pubkey ? `${profile.pubkey.slice(0, 10)}...` : '');
  }

  function mentionSubtitle(profile: Profile) {
    return profile.nip05 || nip19.npubEncode(profile.pubkey);
  }

  function isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function firstString(...values: unknown[]) {
    return values.find(isString) ?? '';
  }
</script>

<div class="composer-mention-results">
  {#if searching}
    <div class="composer-mention-empty">Searching profiles...</div>
  {/if}
  {#each profiles as profile (profile.pubkey)}
    <button type="button" on:click={() => dispatch('select', profile)}>
      <span class="avatar mini">
        {#if profile.picture}
          <img src={profile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
        {:else}
          <span>{profileLabel(profile).slice(0, 1).toUpperCase()}</span>
        {/if}
      </span>
      <span>
        <strong>{profileLabel(profile)}</strong>
        <small>{mentionSubtitle(profile)}</small>
      </span>
    </button>
  {/each}
  {#if !profiles.length && !searching}
    <div class="composer-mention-empty">No profile suggestions yet</div>
  {/if}
</div>
