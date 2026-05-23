<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { BellPlus, Check, Copy, Globe2, Save, UserPlus } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, profiles, relays, saveProfile, session } from '$lib/stores/app';
  import { fetchProfiles } from '$lib/nostr/client';
  import type { Profile } from '$lib/nostr/types';

  const emptyProfile = (): Profile => ({
    pubkey,
    name: '',
    display_name: '',
    about: '',
    picture: '',
    banner: '',
    nip05: '',
    website: '',
    lud16: '',
    lud06: ''
  });

  $: pubkey = normalizePubkey($page.params.pubkey ?? '');
  $: profile = $profiles[pubkey];
  $: isOwnProfile = Boolean($session?.pubkey === pubkey);
  $: userEvents = $events.filter((event) => event.pubkey === pubkey);
  $: npub = /^[0-9a-f]{64}$/i.test(pubkey) ? nip19.npubEncode(pubkey) : '';
  $: shortNpub = npub ? `${npub.slice(0, 12)}...${npub.slice(-8)}` : '';
  $: displayName = profile?.display_name || profile?.name || (isOwnProfile ? '' : 'Nostr profile');
  $: avatarInitial = (profile?.display_name || profile?.name || npub || pubkey || '?').slice(0, 1).toUpperCase();

  let saving = false;
  let copied = false;
  let error = '';
  let draft: Profile = emptyProfile();

  $: if (pubkey) draft = { ...emptyProfile(), ...profile, pubkey };

  onMount(async () => {
    if (!pubkey) return;
    const [found] = await fetchProfiles([pubkey], $relays).catch(() => []);
    if (found) profiles.update((existing) => ({ ...existing, [found.pubkey]: found }));
  });

  async function copyNpub() {
    await navigator.clipboard.writeText(npub);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }

  async function submitProfile() {
    saving = true;
    error = '';
    try {
      await saveProfile(draft);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update profile.';
    } finally {
      saving = false;
    }
  }

  function normalizePubkey(value: string) {
    if (/^[0-9a-f]{64}$/i.test(value)) return value;
    if (!value.startsWith('npub')) return value;
    try {
      const decoded = nip19.decode(value);
      return decoded.type === 'npub' ? decoded.data : value;
    } catch {
      return value;
    }
  }
</script>

<section class="profile-hero">
  <div class="profile-banner" style={`background-image: ${profile?.banner ? `url(${profile.banner})` : 'none'}`}></div>

  <div class="profile-card">
    <div class="avatar xlarge">
      {#if profile?.picture}<img src={profile.picture} alt="" />{:else}<span>{avatarInitial}</span>{/if}
    </div>

    <div class="profile-copy">
      <div class="profile-title-row">
        <div>
          {#if displayName}<h1>{displayName}</h1>{/if}
          {#if profile?.name && profile.display_name}
            <p>@{profile.name}</p>
          {/if}
        </div>
        {#if !isOwnProfile}
          <div class="profile-actions">
            <button><UserPlus size={18} /> Follow</button>
            <button class="icon-button" aria-label="Notify"><BellPlus size={19} /></button>
          </div>
        {/if}
      </div>

      <button class="npub-pill" on:click={copyNpub} aria-label="Copy public key">
        {#if copied}<Check size={17} /> Copied{:else}<Copy size={17} /> <span>{npub}</span>{/if}
      </button>

      {#if profile?.about}
        <p class="profile-about">{profile.about}</p>
      {/if}

      <div class="profile-meta">
        {#if profile?.nip05}<span>{profile.nip05}</span>{/if}
        {#if profile?.website}<a href={profile.website} target="_blank" rel="noreferrer"><Globe2 size={16} /> {profile.website.replace(/^https?:\/\//, '')}</a>{/if}
        {#if profile?.lud16}<span>{profile.lud16}</span>{/if}
      </div>
    </div>
  </div>

  {#if isOwnProfile}
    <form class="panel profile-editor" on:submit|preventDefault={submitProfile}>
      <div class="editor-head">
        <h2>Edit profile</h2>
      </div>

      <div class="profile-edit-grid">
        <label>
          <span>Display name</span>
          <input bind:value={draft.display_name} placeholder="Ben Arc" />
        </label>
        <label>
          <span>Username</span>
          <input bind:value={draft.name} placeholder="benarc" />
        </label>
        <label class="wide">
          <span>About</span>
          <textarea bind:value={draft.about} placeholder="What should people know about you?"></textarea>
        </label>
        <label class="wide">
          <span>Profile image URL</span>
          <input bind:value={draft.picture} placeholder="https://..." />
        </label>
        <label class="wide">
          <span>Banner image URL</span>
          <input bind:value={draft.banner} placeholder="https://..." />
        </label>
        <label>
          <span>NIP-05</span>
          <input bind:value={draft.nip05} placeholder="name@example.com" />
        </label>
        <label>
          <span>Website</span>
          <input bind:value={draft.website} placeholder="https://example.com" />
        </label>
        <label>
          <span>Lightning address</span>
          <input bind:value={draft.lud16} placeholder="name@getalby.com" />
        </label>
        <label>
          <span>LNURL</span>
          <input bind:value={draft.lud06} placeholder="lnurl1..." />
        </label>
      </div>

      {#if error}<p class="error">{error}</p>{/if}
      <div class="dialog-actions">
        <button class="primary" disabled={saving} type="submit"><Save size={18} /> {saving ? 'Saving' : 'Save profile'}</button>
      </div>
    </form>
  {/if}
</section>

<section class="feed-list narrow">
  {#each userEvents as event (event.id)}
    <NoteCard {event} {profile} />
  {:else}
    <div class="empty-state"><strong>No cached notes for this profile</strong><span>Refresh the global feed to fetch more events.</span></div>
  {/each}
</section>
