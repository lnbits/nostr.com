<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { Hash, Loader2, Search, UserRound } from '@lucide/svelte';
  import { filterByHashtag, profiles, relays } from '$lib/stores/app';
  import { resolvePubkeyIdentifier, searchProfiles } from '$lib/nostr/client';
  import type { Profile } from '$lib/nostr/types';

  let query = '';
  let remoteProfiles: Profile[] = [];
  let searchingProfiles = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  $: cleanQuery = query.trim();
  $: localProfiles = profileSuggestions(cleanQuery, Object.values($profiles));
  $: suggestions = mergeProfiles(localProfiles, remoteProfiles).slice(0, 6);

  onDestroy(() => {
    clearTimeout(searchTimer);
  });

  function scheduleProfileSearch() {
    clearTimeout(searchTimer);
    remoteProfiles = [];
    if (cleanQuery.replace(/^@/, '').length < 2) return;
    searchTimer = setTimeout(() => void runProfileSearch(cleanQuery), 260);
  }

  async function runProfileSearch(value: string) {
    searchingProfiles = true;
    try {
      const found = await searchProfiles(value, $relays).catch(() => []);
      if (value === cleanQuery) {
        remoteProfiles = found;
        if (found.length) profiles.update((existing) => ({ ...existing, ...Object.fromEntries(found.map((profile) => [profile.pubkey, profile])) }));
      }
    } finally {
      searchingProfiles = false;
    }
  }

  async function submitSearch() {
    const value = cleanQuery;
    if (!value) return;

    const suggestedProfile = suggestions[0];
    const resolvedPubkey = await resolvePubkeyIdentifier(value, $relays).catch(() => '');
    if (resolvedPubkey) {
      query = '';
      await goto(`/profile/${resolvedPubkey}`);
      return;
    }
    if (value.startsWith('@') && suggestedProfile) {
      openProfile(suggestedProfile.pubkey);
      return;
    }

    filterByHashtag(value.replace(/^#/, ''));
    query = '';
    await goto('/');
  }

  async function openProfile(pubkey: string) {
    query = '';
    await goto(`/profile/${pubkey}`);
  }

  function profileSuggestions(value: string, items: Profile[]) {
    const needle = value.trim().replace(/^@/, '').toLowerCase();
    if (needle.length < 2) return [];
    return items
      .filter((profile) => profileMatches(profile, needle))
      .sort((a, b) => profileLabel(a).localeCompare(profileLabel(b)));
  }

  function profileMatches(profile: Profile, needle: string) {
    return [profile.name, profile.display_name, profile.nip05, profile.pubkey].filter(isString).some((value) => value.toLowerCase().includes(needle));
  }

  function mergeProfiles(first: Profile[], second: Profile[]) {
    const byPubkey = new Map<string, Profile>();
    [...first, ...second].forEach((profile) => byPubkey.set(profile.pubkey, profile));
    return [...byPubkey.values()];
  }

  function profileLabel(profile: Profile) {
    return firstString(profile.display_name, profile.name, profile.nip05) || `${profile.pubkey.slice(0, 10)}...`;
  }

  function isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function firstString(...values: unknown[]) {
    return values.find(isString) ?? '';
  }
</script>

<section class="feed-search" aria-label="Global search">
  <form class="feed-search-form" on:submit|preventDefault={submitSearch}>
    <Search size={18} />
    <input bind:value={query} on:input={scheduleProfileSearch} placeholder="Search keyword, profile, npub, or NIP-05" autocomplete="off" />
    {#if searchingProfiles}<Loader2 size={17} class="spin" />{/if}
  </form>

  {#if cleanQuery.length >= 2}
    <div class="feed-search-results">
      {#each suggestions as profile (profile.pubkey)}
        <button type="button" on:click={() => openProfile(profile.pubkey)}>
          <span class="avatar mini">
            {#if profile.picture}
              <img src={profile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
            {:else}
              <span>{profileLabel(profile).slice(0, 1).toUpperCase()}</span>
            {/if}
          </span>
          <span>
            <strong>{profileLabel(profile)}</strong>
            <small>{profile.nip05 || `npub ${profile.pubkey.slice(0, 10)}...`}</small>
          </span>
        </button>
      {/each}
      <button type="button" on:click={submitSearch}>
        <span class="avatar mini search-kind"><Hash size={15} /></span>
        <span>
          <strong>Search global posts</strong>
          <small>#{cleanQuery.replace(/^#/, '')}</small>
        </span>
      </button>
      {#if !suggestions.length && !searchingProfiles}
        <div class="feed-search-empty"><UserRound size={16} /> No profile suggestions yet</div>
      {/if}
    </div>
  {/if}
</section>
