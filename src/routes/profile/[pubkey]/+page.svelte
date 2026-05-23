<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Check, Copy, Globe2, MessageCircle, Pencil, Save, Upload, UserPlus, X } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, mergeEvents, profiles, relays, saveProfile, session } from '$lib/stores/app';
  import { getCachedProfileEvents } from '$lib/nostr/cache';
  import { dedupeEvents, fetchProfileEvents, fetchProfiles, getNip98AuthorizationHeader } from '$lib/nostr/client';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

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
  const initialProfileEventLimit = 120;
  const profileEventPageLimit = 120;

  $: pubkey = normalizePubkey($page.params.pubkey ?? '');
  $: profile = $profiles[pubkey];
  $: isOwnProfile = Boolean($session?.pubkey === pubkey);
  $: userEvents = profileEvents.filter((event) => event.pubkey === pubkey);
  $: npub = /^[0-9a-f]{64}$/i.test(pubkey) ? nip19.npubEncode(pubkey) : '';
  $: shortNpub = npub ? `${npub.slice(0, 12)}...${npub.slice(-8)}` : '';
  $: displayName = profile?.display_name || profile?.name || (isOwnProfile ? '' : 'Nostr profile');
  $: avatarInitial = (profile?.display_name || profile?.name || npub || pubkey || '?').slice(0, 1).toUpperCase();

  let saving = false;
  let copied = false;
  let error = '';
  let uploadMessage = '';
  let uploading: 'picture' | 'banner' | '' = '';
  let editorOpen = false;
  let draft: Profile = emptyProfile();
  let profileEvents: NostrEvent[] = [];
  let hydratedPubkey = '';
  let profileLoadMoreSentinel: HTMLDivElement;
  let profileObserver: IntersectionObserver | undefined;
  let loadingMoreProfile = false;
  let hasMoreProfile = true;
  let pictureInput: HTMLInputElement;
  let bannerInput: HTMLInputElement;

  $: if (pubkey) draft = { ...emptyProfile(), ...profile, pubkey };

  $: if (pubkey && pubkey !== hydratedPubkey) {
    hydratedPubkey = pubkey;
    void hydrateProfile(pubkey);
  }

  onMount(() => {
    profileObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMoreProfileEvents();
      },
      { rootMargin: '360px 0px' }
    );
    if (profileLoadMoreSentinel) profileObserver.observe(profileLoadMoreSentinel);
    return () => profileObserver?.disconnect();
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
      editorOpen = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update profile.';
    } finally {
      saving = false;
    }
  }

  async function hydrateProfile(nextPubkey: string) {
    hasMoreProfile = true;
    loadingMoreProfile = false;
    const cachedProfileEvents = await getCachedProfileEvents(nextPubkey, initialProfileEventLimit);
    profileEvents = dedupeEvents([...cachedProfileEvents, ...$events.filter((event) => event.pubkey === nextPubkey)]);
    const [found, fetchedProfileEvents] = await Promise.all([
      $profiles[nextPubkey] ? Promise.resolve([]) : fetchProfiles([nextPubkey], $relays).catch(() => []),
      fetchProfileEvents(nextPubkey, $relays, initialProfileEventLimit).catch(() => [])
    ]);
    const [profile] = found;
    if (profile) profiles.update((existing) => ({ ...existing, [profile.pubkey]: profile }));
    if (fetchedProfileEvents.length) {
      events.update((existing) => mergeEvents(fetchedProfileEvents, existing));
      addProfileEvents(fetchedProfileEvents);
    }
  }

  async function loadMoreProfileEvents() {
    if (!pubkey || loadingMoreProfile || !hasMoreProfile) return;
    const oldest = oldestProfileTimestamp();
    if (!oldest) return;

    loadingMoreProfile = true;
    try {
      const nextEvents = await fetchProfileEvents(pubkey, $relays, profileEventPageLimit, { until: oldest - 1 }).catch(() => []);
      hasMoreProfile = true;
      if (nextEvents.length) {
        events.update((existing) => mergeEvents(nextEvents, existing));
        addProfileEvents(nextEvents);
      }
    } finally {
      loadingMoreProfile = false;
    }
  }

  function oldestProfileTimestamp() {
    if (!userEvents.length) return undefined;
    return Math.min(...userEvents.map((event) => event.created_at));
  }

  function addProfileEvents(nextEvents: NostrEvent[]) {
    profileEvents = dedupeEvents([...profileEvents, ...nextEvents]);
  }

  async function uploadProfileMedia(file: File | undefined, target: 'picture' | 'banner') {
    if (!file) return;
    if (!$session) {
      error = 'Sign in before uploading profile media.';
      return;
    }
    if (!file.type.startsWith('image/')) {
      error = 'Choose an image file for your profile media.';
      return;
    }

    uploading = target;
    error = '';
    uploadMessage = '';
    try {
      const url = await uploadToNostrBuild(file, target === 'picture' ? 'avatar' : 'banner');
      draft = { ...draft, [target]: url };
      uploadMessage = target === 'picture' ? 'Profile image uploaded.' : 'Banner image uploaded.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not upload image.';
    } finally {
      uploading = '';
    }
  }

  async function uploadToNostrBuild(file: File, mediaType: 'avatar' | 'banner') {
    if (!$session) throw new Error('Sign in before uploading profile media.');
    const uploadUrl = 'https://nostr.build/api/v2/upload/files';
    const form = new FormData();
    form.set('file', file);
    form.set('media_type', mediaType);
    form.set('content_type', file.type);
    form.set('size', String(file.size));

    const authorization = await getNip98AuthorizationHeader($session, uploadUrl, 'POST');
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(uploadErrorMessage(data) ?? `Upload failed with ${response.status}.`);

    const url = uploadResponseUrl(data);
    if (!url) throw new Error('Upload finished but no media URL was returned.');
    return url;
  }

  function uploadResponseUrl(data: unknown): string {
    const tags = uploadResponseTags(data);
    const urlTag = tags.find((tag) => tag[0] === 'url' && tag[1]);
    if (urlTag?.[1]) return urlTag[1];
    if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') return data.url;
    return '';
  }

  function uploadResponseTags(data: unknown): string[][] {
    if (Array.isArray(data) && Array.isArray(data[0])) return data as string[][];
    if (!data || typeof data !== 'object') return [];
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.tags)) return record.tags as string[][];
    if (record.nip94_event && typeof record.nip94_event === 'object' && Array.isArray((record.nip94_event as Record<string, unknown>).tags)) {
      return (record.nip94_event as { tags: string[][] }).tags;
    }
    if (record.data && typeof record.data === 'object') return uploadResponseTags(record.data);
    return [];
  }

  function uploadErrorMessage(data: unknown) {
    return data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : '';
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
  {#if !$session}
    <a class="info-back" href="/">← Feed</a>
  {/if}

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
            <button disabled={!$session}><UserPlus size={18} /> Follow</button>
            <button class="icon-button" disabled={!$session} aria-label="Message" on:click={() => void goto('/#messages')}><MessageCircle size={19} /></button>
          </div>
        {/if}
      </div>

      <div class="profile-key-actions">
        <button class="npub-pill" on:click={copyNpub} aria-label="Copy public key">
          {#if copied}<Check size={17} /> Copied{:else}<Copy size={17} /> <span>{npub}</span>{/if}
        </button>
        {#if isOwnProfile}
          <button class="icon-button" on:click={() => (editorOpen = true)} aria-label="Edit profile">
            <Pencil size={18} />
          </button>
        {/if}
      </div>

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

  {#if isOwnProfile && editorOpen}
    <div
      class="dialog-backdrop"
      role="presentation"
      on:click={(event) => {
        if (event.target === event.currentTarget) editorOpen = false;
      }}
    >
    <form class="dialog-panel profile-editor profile-editor-dialog" on:submit|preventDefault={submitProfile}>
      <div class="editor-head">
        <h2>Edit profile</h2>
        <button class="icon-button" type="button" on:click={() => (editorOpen = false)} aria-label="Close profile editor">
          <X size={19} />
        </button>
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
          <div class="upload-url-row">
            <input bind:value={draft.picture} placeholder="https://..." />
            <input class="visually-hidden" type="file" accept="image/*" bind:this={pictureInput} on:change={(event) => uploadProfileMedia(event.currentTarget.files?.[0], 'picture')} />
            <button type="button" disabled={uploading !== ''} on:click={() => pictureInput.click()}><Upload size={17} /> {uploading === 'picture' ? 'Uploading' : 'Upload'}</button>
          </div>
        </label>
        <label class="wide">
          <span>Banner image URL</span>
          <div class="upload-url-row">
            <input bind:value={draft.banner} placeholder="https://..." />
            <input class="visually-hidden" type="file" accept="image/*" bind:this={bannerInput} on:change={(event) => uploadProfileMedia(event.currentTarget.files?.[0], 'banner')} />
            <button type="button" disabled={uploading !== ''} on:click={() => bannerInput.click()}><Upload size={17} /> {uploading === 'banner' ? 'Uploading' : 'Upload'}</button>
          </div>
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

      {#if uploadMessage}<p class="muted-copy">{uploadMessage}</p>{/if}
      {#if error}<p class="error">{error}</p>{/if}
      <div class="dialog-actions">
        <button type="button" on:click={() => (editorOpen = false)}>Cancel</button>
        <button class="primary" disabled={saving} type="submit"><Save size={18} /> {saving ? 'Saving' : 'Save profile'}</button>
      </div>
    </form>
    </div>
  {/if}
</section>

<section class="feed-list narrow">
  {#each userEvents as event (event.id)}
    <NoteCard {event} {profile} />
  {:else}
    <div class="empty-state"><strong>No notes for this profile yet</strong><span>Trying relays for this profile’s posts.</span></div>
  {/each}
  <div class="load-more-sentinel profile-load-more-sentinel" bind:this={profileLoadMoreSentinel}>
    {#if loadingMoreProfile}
      <span>Loading older profile notes</span>
    {:else if userEvents.length}
      <span>Scroll down for older profile notes</span>
    {/if}
  </div>
</section>
