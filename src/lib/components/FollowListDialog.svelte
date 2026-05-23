<script lang="ts">
  import { nip19 } from 'nostr-tools';
  import { Save, Trash2, UserPlus, X } from '@lucide/svelte';
  import { follows, profiles, relays, saveFollowList } from '$lib/stores/app';
  import { fetchProfiles, resolveNip05Profile, searchProfiles } from '$lib/nostr/client';
  import type { Profile } from '$lib/nostr/types';

  export let open = false;

  let entries: string[] = [];
  let newFollow = '';
  let saving = false;
  let error = '';
  let suggestions: Profile[] = [];
  let suggesting = false;
  let suggestTimer: ReturnType<typeof setTimeout> | undefined;
  let hydratedEntries = '';

  $: if (open) {
    entries = [...$follows];
    error = '';
  }

  $: if (open) {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => void updateSuggestions(newFollow), 250);
  }

  $: if (open) {
    const key = entries.join(',');
    if (key && key !== hydratedEntries) {
      hydratedEntries = key;
      void hydrateEntryProfiles(entries);
    }
  }

  function close() {
    open = false;
  }

  function normalizePubkey(value: string) {
    const trimmed = value.trim();
    if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (!trimmed.startsWith('npub')) return null;
    try {
      const decoded = nip19.decode(trimmed);
      return decoded.type === 'npub' ? decoded.data : null;
    } catch {
      return null;
    }
  }

  function addFollow() {
    const pubkey = normalizePubkey(newFollow);
    if (!pubkey) {
      error = 'Use a valid npub or hex public key.';
      return;
    }
    entries = [...new Set([...entries, pubkey])];
    newFollow = '';
    error = '';
  }

  function addSuggested(profile: Profile) {
    entries = [...new Set([...entries, profile.pubkey])];
    newFollow = '';
    suggestions = [];
    error = '';
  }

  function removeFollow(pubkey: string) {
    entries = entries.filter((entry) => entry !== pubkey);
  }

  function shortKey(pubkey: string) {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return pubkey.slice(0, 16);
    }
  }

  function profileLabel(profile: Profile) {
    return profile.display_name || profile.name || profile.nip05 || shortKey(profile.pubkey);
  }

  function profileSubline(profile: Profile) {
    return profile.nip05 || shortKey(profile.pubkey);
  }

  function profileFor(pubkey: string): Profile {
    return $profiles[pubkey] ?? { pubkey };
  }

  async function hydrateEntryProfiles(pubkeys: string[]) {
    const missing = pubkeys.filter((pubkey) => !$profiles[pubkey]).slice(0, 40);
    if (!missing.length) return;
    const found = await fetchProfiles(missing, $relays).catch(() => []);
    if (!found.length) return;
    profiles.update((existing) => ({
      ...existing,
      ...Object.fromEntries(found.map((profile) => [profile.pubkey, profile]))
    }));
  }

  async function updateSuggestions(value: string) {
    const query = value.trim();
    if (query.length < 2) {
      suggestions = [];
      return;
    }

    const pubkey = normalizePubkey(query);
    if (pubkey) {
      suggesting = true;
      const [profile] = await fetchProfiles([pubkey], $relays).catch(() => []);
      suggestions = [{ ...(profile ?? {}), pubkey }];
      suggesting = false;
      return;
    }

    suggesting = true;
    const searchable = query.replace(/^@/, '').toLowerCase();
    const local = Object.values($profiles)
      .filter((profile) =>
        [profile.name, profile.display_name, profile.nip05]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(searchable))
      )
      .slice(0, 6);

    const nip05 = query.includes('@')
      ? await resolveNip05Profile(query.replace(/^@/, '')).catch(() => null)
      : null;
    const nip05Profiles = nip05 ? await fetchProfiles([nip05.pubkey], $relays).catch(() => []) : [];
    const relayProfiles = await searchProfiles(searchable, $relays).catch(() => []);

    const byPubkey = new Map<string, Profile>();
    [...local, ...nip05Profiles, ...relayProfiles].forEach((profile) => byPubkey.set(profile.pubkey, profile));
    if (nip05 && !byPubkey.has(nip05.pubkey)) byPubkey.set(nip05.pubkey, { pubkey: nip05.pubkey, nip05: query.replace(/^@/, '') });
    suggestions = [...byPubkey.values()].filter((profile) => !entries.includes(profile.pubkey)).slice(0, 8);
    suggesting = false;
  }

  async function save() {
    saving = true;
    error = '';
    try {
      await saveFollowList(entries);
      close();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update follow list.';
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && close()}>
    <div class="dialog-panel compact" role="dialog" aria-modal="true" aria-labelledby="follow-list-title">
      <div class="dialog-head">
        <h2 id="follow-list-title">Following</h2>
        <button class="icon-button" on:click={close} aria-label="Close follow list"><X size={20} /></button>
      </div>

      <div class="follow-add-row">
        <div class="follow-search">
          <input bind:value={newFollow} placeholder="@jack, name@domain.com, npub1..., or hex" on:keydown={(event) => event.key === 'Enter' && addFollow()} />
          {#if suggestions.length || suggesting}
            <div class="profile-suggestions" aria-label="Profile suggestions">
              {#if suggesting}
                <span class="muted-copy">Searching profiles...</span>
              {/if}
              {#each suggestions as profile (profile.pubkey)}
                <button on:click={() => addSuggested(profile)}>
                  <span class="avatar mini">
                    {#if profile.picture}<img src={profile.picture} alt="" />{:else}{profileLabel(profile).slice(0, 1).toUpperCase()}{/if}
                  </span>
                  <span>
                    <strong>{profileLabel(profile)}</strong>
                    <small>{profileSubline(profile)}</small>
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <button on:click={addFollow}><UserPlus size={18} /> Add</button>
      </div>

      <div class="follow-list-manager" aria-label="Follow list">
        {#each entries as pubkey}
          {@const profile = profileFor(pubkey)}
          <div class="follow-list-row">
            <a class="follow-profile-link" href={`/profile/${pubkey}`} on:click={close}>
              <span class="avatar mini">
                {#if profile.picture}<img src={profile.picture} alt="" />{:else}{profileLabel(profile).slice(0, 1).toUpperCase()}{/if}
              </span>
              <span>
                <strong>{profileLabel(profile)}</strong>
                <small>{profileSubline(profile)}</small>
              </span>
            </a>
            <button class="icon-button" on:click={() => removeFollow(pubkey)} aria-label="Remove follow"><Trash2 size={17} /></button>
          </div>
        {:else}
          <p class="muted-copy">No follows yet.</p>
        {/each}
      </div>

      {#if error}<p class="error">{error}</p>{/if}
      <div class="dialog-actions">
        <button on:click={close}>Cancel</button>
        <button class="primary" disabled={saving} on:click={save}><Save size={18} /> {saving ? 'Saving' : 'Save'}</button>
      </div>
    </div>
  </div>
{/if}
