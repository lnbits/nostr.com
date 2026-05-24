<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Copy, Globe2, MessageCircle, Pencil, Save, UserMinus, Upload, UserPlus, X } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { events, follows, mergeEvents, profiles, refreshEventStats, relays, saveFollowList, saveProfile, selectMessagePeer, session } from '$lib/stores/app';
  import { getCachedProfileEvents } from '$lib/nostr/cache';
  import { dedupeEvents, fetchProfileEvents, fetchProfiles, topLevelFeedEvents } from '$lib/nostr/client';
  import { uploadToNostrBuild } from '$lib/nostr/upload';
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
  const targetProfileEventCount = 24;
  const maxAutomaticProfilePages = 4;
  type ProfileTimelineItem = { id: string; event: NostrEvent };

  $: pubkey = normalizePubkey($page.params.pubkey ?? '');
  $: profile = $profiles[pubkey];
  $: isOwnProfile = Boolean($session?.pubkey === pubkey);
  $: isFollowing = $follows.includes(pubkey);
  $: userItems = profileEvents.flatMap(profileTimelineItem);
  $: userEvents = userItems.map((item) => item.event);
  $: npub = /^[0-9a-f]{64}$/i.test(pubkey) ? nip19.npubEncode(pubkey) : '';
  $: shortNpub = npub ? `${npub.slice(0, 12)}...${npub.slice(-8)}` : '';
  $: displayName = profile?.display_name || profile?.name || (isOwnProfile ? '' : 'Nostr profile');
  $: avatarInitial = (profile?.display_name || profile?.name || npub || pubkey || '?').slice(0, 1).toUpperCase();

  let saving = false;
  let copied = false;
  let error = '';
  let uploadMessage = '';
  let uploading: 'picture' | 'banner' | '' = '';
  let updatingFollow = false;
  let editorOpen = false;
  let draft: Profile = emptyProfile();
  let profileEvents: NostrEvent[] = [];
  let hydratedPubkey = '';
  let profileLoadMoreSentinel: HTMLDivElement;
  let profileObserver: IntersectionObserver | undefined;
  let loadingMoreProfile = false;
  let hasMoreProfile = true;
  let profilePaginationCursor: number | undefined;
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

  async function toggleFollow() {
    if (!$session || !pubkey || isOwnProfile || updatingFollow) return;
    updatingFollow = true;
    error = '';
    try {
      const nextFollows = isFollowing ? $follows.filter((item) => item !== pubkey) : [...$follows, pubkey];
      await saveFollowList(nextFollows);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update follow list.';
    } finally {
      updatingFollow = false;
    }
  }

  async function hydrateProfile(nextPubkey: string) {
    hasMoreProfile = true;
    loadingMoreProfile = false;
    profilePaginationCursor = undefined;
    const cachedProfileEvents = await getCachedProfileEvents(nextPubkey, initialProfileEventLimit);
    profileEvents = cleanProfileEvents([...cachedProfileEvents, ...$events.filter((event) => event.pubkey === nextPubkey)]);
    void refreshProfileStats();
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
    updateProfilePaginationCursor([...cachedProfileEvents, ...fetchedProfileEvents]);
    void autoFillProfileEvents(nextPubkey);
  }

  async function loadMoreProfileEvents(targetPubkey = pubkey) {
    if (!targetPubkey || loadingMoreProfile || !hasMoreProfile) return false;
    const oldest = profilePaginationCursor ?? oldestProfileTimestamp();
    if (!oldest) return false;

    loadingMoreProfile = true;
    try {
      const nextEvents = await fetchProfileEvents(targetPubkey, $relays, profileEventPageLimit, { until: oldest - 1 }).catch(() => []);
      if (targetPubkey !== pubkey) return false;
      hasMoreProfile = nextEvents.length > 0;
      if (nextEvents.length) {
        events.update((existing) => mergeEvents(nextEvents, existing));
        addProfileEvents(nextEvents);
        updateProfilePaginationCursor(nextEvents);
      }
      return nextEvents.length > 0;
    } finally {
      loadingMoreProfile = false;
    }
  }

  async function autoFillProfileEvents(targetPubkey: string) {
    for (let page = 0; page < maxAutomaticProfilePages; page += 1) {
      if (targetPubkey !== pubkey || userItems.length >= targetProfileEventCount || !hasMoreProfile) return;
      const loaded = await loadMoreProfileEvents(targetPubkey);
      if (!loaded) return;
    }
  }

  function oldestProfileTimestamp() {
    if (!userEvents.length) return undefined;
    return Math.min(...userEvents.map((event) => event.created_at));
  }

  function addProfileEvents(nextEvents: NostrEvent[]) {
    profileEvents = cleanProfileEvents([...profileEvents, ...nextEvents]);
    void refreshProfileStats();
  }

  function refreshProfileStats() {
    const statIds = [...new Set(userItems.map((item) => item.event.id))];
    if (statIds.length) void refreshEventStats(statIds, true);
  }

  function updateProfilePaginationCursor(nextEvents: NostrEvent[]) {
    if (!nextEvents.length) return;
    const oldest = Math.min(...nextEvents.map((event) => event.created_at));
    profilePaginationCursor = Math.min(profilePaginationCursor ?? oldest, oldest);
  }

  function cleanProfileEvents(nextEvents: NostrEvent[]) {
    return dedupeEvents(nextEvents).filter((event) => event.kind === 6 || (event.kind === 1 && topLevelFeedEvents([event]).length));
  }

  function profileTimelineItem(event: NostrEvent): ProfileTimelineItem[] {
    if (event.kind === 1 && topLevelFeedEvents([event]).length) return [{ id: event.id, event }];
    const reposted = parseRepostContent(event);
    if (!reposted || !topLevelFeedEvents([reposted]).length) return [];
    return [{ id: event.id, event: reposted }];
  }

  function parseRepostContent(event: NostrEvent) {
    if (event.kind !== 6 || !event.content.trim()) return null;
    try {
      const reposted = JSON.parse(event.content) as NostrEvent;
      return reposted?.kind === 1 && /^[0-9a-f]{64}$/i.test(reposted.id) ? reposted : null;
    } catch {
      return null;
    }
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
      const url = await uploadToNostrBuild($session, file, target === 'picture' ? 'avatar' : 'banner');
      draft = { ...draft, [target]: url };
      uploadMessage = target === 'picture' ? 'Profile image uploaded.' : 'Banner image uploaded.';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not upload image.';
    } finally {
      uploading = '';
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
  <a class="page-back" href="/" aria-label="Back to feed"><ArrowLeft size={18} /> Back</a>

  <div class="profile-banner" style={`background-image: ${profile?.banner ? `url(${profile.banner})` : 'none'}`}></div>

  <div class="profile-card">
    <div class="avatar xlarge">
      {#if profile?.picture}<img src={profile.picture} alt="" />{:else}<span>{avatarInitial}</span>{/if}
    </div>

    <div class="profile-banner-actions">
      {#if isOwnProfile}
        <button class="profile-edit-inline" on:click={() => (editorOpen = true)} aria-label="Edit profile">
          <Pencil size={14} /> Edit profile
        </button>
      {:else}
        <button disabled={!$session || updatingFollow} on:click={toggleFollow}>
          {#if isFollowing}<UserMinus size={17} /> Unfollow{:else}<UserPlus size={17} /> Follow{/if}
        </button>
        <button class="icon-button" disabled={!$session} aria-label="Message" on:click={() => { selectMessagePeer(pubkey); void goto('/#messages'); }}><MessageCircle size={19} /></button>
      {/if}
    </div>

    <div class="profile-copy">
      <div class="profile-title-row">
        <div>
          {#if displayName}<h1>{displayName}</h1>{/if}
          <div class="profile-identity-line">
            {#if profile?.name && profile.display_name}
              <span>@{profile.name}</span>
            {/if}
            {#if npub}
              <button class="npub-inline-copy" on:click={copyNpub} aria-label="Copy public key">
                {#if copied}<Check size={13} /> Copied{:else}<span>{shortNpub}</span><Copy size={13} />{/if}
              </button>
            {/if}
          </div>
        </div>
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
  {#each userItems as item (item.id)}
    <NoteCard event={item.event} profile={$profiles[item.event.pubkey] ?? (item.event.pubkey === pubkey ? profile : undefined)} />
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
