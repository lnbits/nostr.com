<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Copy, Globe2, MessageCircle, Pencil, Save, UserMinus, UserX, Upload, UserPlus, X } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { deletedEventIds, events, follows, mergeEvents, mergeProfileRecords, mutedPubkeys, muteAccount, profiles, refreshEventStats, relays, saveFollowList, saveProfile, selectMessagePeer, session, unmuteAccount } from '$lib/stores/app';
  import { getCachedProfileEvents } from '$lib/nostr/cache';
  import { dedupeEvents, fetchProfileEvents, fetchProfiles, isReplyEvent, topLevelFeedEvents } from '$lib/nostr/client';
  import { extractMediaAttachments } from '$lib/nostr/media';
  import { uploadToNostrBuild } from '$lib/nostr/upload';
  import { appPath } from '$lib/paths';
  import { readRouteScrollState, saveRouteScrollState } from '$lib/stores/routeScroll';
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
  const initialProfileEventLimit = 60;
  const profileEventPageLimit = 60;
  const targetProfileEventCount = 12;
  const maxAutomaticProfilePages = 1;
  const profileScrollStateMaxAgeMs = 30 * 60 * 1000;
  const profilePageWindowSeconds = 60 * 60 * 24 * 30;
  const profileWindowScanLimit = 6;
  const profilePreloadDistancePx = 1800;
  const profilePreloadRootMargin = `0px 0px ${profilePreloadDistancePx}px 0px`;
  type ProfileTimelineItem = { id: string; event: NostrEvent };

  $: pubkey = normalizePubkey($page.params.pubkey ?? '');
  $: profile = $profiles[pubkey];
  $: isOwnProfile = Boolean($session?.pubkey === pubkey);
  $: isFollowing = $follows.includes(pubkey);
  $: isMuted = $mutedPubkeys.includes(pubkey);
  $: userItems = profileEvents.flatMap(profileTimelineItem);
  $: userEvents = userItems.map((item) => item.event);
  $: profileSummary = profileSummaryForEvents(profileSummaryEvents);
  $: npub = /^[0-9a-f]{64}$/i.test(pubkey) ? nip19.npubEncode(pubkey) : '';
  $: shortNpub = npub ? `${npub.slice(0, 12)}...${npub.slice(-8)}` : '';
  $: displayName = profile?.display_name || profile?.name || (isOwnProfile ? '' : 'Nostr profile');
  $: avatarInitial = (profile?.display_name || profile?.name || npub || pubkey || '?').slice(0, 1).toUpperCase();
  $: websiteHref = safeHttpUrl(profile?.website);
  $: websiteLabel = websiteHref.replace(/^https?:\/\//, '').replace(/\/$/, '');
  $: routeKey = currentProfileRouteKey();

  let saving = false;
  let copied = false;
  let error = '';
  let uploadMessage = '';
  let uploading: 'picture' | 'banner' | '' = '';
  let updatingFollow = false;
  let updatingMute = false;
  let editorOpen = false;
  let draft: Profile = emptyProfile();
  let profileEvents: NostrEvent[] = [];
  let profileSummaryEvents: NostrEvent[] = [];
  let hydratedPubkey = '';
  let profileLoadMoreSentinel: HTMLDivElement;
  let profileObserver: IntersectionObserver | undefined;
  let loadingMoreProfile = false;
  let loadingProfile = true;
  let triedProfileRelays = false;
  let hasMoreProfile = true;
  let profilePaginationCursor = 0;
  let profilePreloadTimer: ReturnType<typeof setTimeout> | undefined;
  let pictureInput: HTMLInputElement;
  let bannerInput: HTMLInputElement;
  let editingProfilePubkey = '';
  let restoredProfileRouteKey = '';

  $: if (pubkey && !editorOpen) draft = { ...emptyProfile(), ...profile, pubkey };

  $: if (pubkey && pubkey !== hydratedPubkey) {
    hydratedPubkey = pubkey;
    void hydrateProfile(pubkey);
  }
  $: if ($deletedEventIds.size && profileEvents.some((event) => $deletedEventIds.has(event.id))) {
    profileEvents = profileEvents.filter((event) => !$deletedEventIds.has(event.id));
    profileSummaryEvents = profileSummaryEvents.filter((event) => !$deletedEventIds.has(event.id));
  }
  $: if (browser && routeKey && userItems.length && routeKey !== restoredProfileRouteKey) void restoreProfileScrollPosition(routeKey);

  beforeNavigate(() => {
    saveCurrentProfileScrollPosition();
  });

  onMount(() => {
    profileObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) scheduleProfilePreload();
      },
      { rootMargin: profilePreloadRootMargin }
    );
    if (profileLoadMoreSentinel) profileObserver.observe(profileLoadMoreSentinel);
    void restoreProfileScrollPosition(routeKey);
    return () => {
      saveCurrentProfileScrollPosition();
      clearTimeout(profilePreloadTimer);
      profileObserver?.disconnect();
    };
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
      profiles.update((existing) => mergeProfileRecords(existing, [{ ...draft, pubkey, updated_at: Math.floor(Date.now() / 1000) }]));
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

  async function toggleMute() {
    if (!$session || !pubkey || isOwnProfile || updatingMute) return;
    updatingMute = true;
    error = '';
    try {
      if (isMuted) await unmuteAccount(pubkey);
      else await muteAccount(pubkey);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update mute list.';
    } finally {
      updatingMute = false;
    }
  }

  async function hydrateProfile(nextPubkey: string) {
    hasMoreProfile = true;
    loadingProfile = true;
    triedProfileRelays = false;
    loadingMoreProfile = false;
    profilePaginationCursor = profileRecentWindowUpperBound();
    profileEvents = [];
    profileSummaryEvents = [];
    const cachedProfileEvents = await getCachedProfileEvents(nextPubkey, initialProfileEventLimit);
    if (nextPubkey !== pubkey) return;
    const cachedAndVisibleEvents = [...cachedProfileEvents, ...$events.filter((event) => event.pubkey === nextPubkey)].filter((event) =>
      eventInProfileWindow(event, profileRecentWindowLowerBound(), profileRecentWindowUpperBound())
    );
    profileSummaryEvents = cleanProfileSummaryEvents(cachedAndVisibleEvents);
    profileEvents = cleanProfileEvents(cachedAndVisibleEvents);
    void refreshProfileStats();
    const [found, fetchedProfileEvents] = await Promise.all([
      $profiles[nextPubkey] ? Promise.resolve([]) : fetchProfiles([nextPubkey], $relays).catch(() => []),
      fetchProfileEvents(nextPubkey, $relays, initialProfileEventLimit, {
        since: profileRecentWindowLowerBound(),
        until: profileRecentWindowUpperBound()
      }).catch(() => [])
    ]);
    if (nextPubkey !== pubkey) return;
    triedProfileRelays = true;
    const [profile] = found;
    if (profile) profiles.update((existing) => mergeProfileRecords(existing, [profile]));
    if (fetchedProfileEvents.length) {
      events.update((existing) => mergeEvents(fetchedProfileEvents, existing));
      addProfileEvents(fetchedProfileEvents);
    }
    profilePaginationCursor = nextProfilePaginationCursor(fetchedProfileEvents, profileRecentWindowLowerBound(), initialProfileEventLimit);
    loadingProfile = false;
    void autoFillProfileEvents(nextPubkey);
  }

  async function loadMoreProfileEvents(targetPubkey = pubkey) {
    if (!targetPubkey || loadingMoreProfile || !hasMoreProfile) return false;

    loadingMoreProfile = true;
    try {
      const nextEvents: NostrEvent[] = [];
      let cursor = profilePaginationCursor || oldestProfileTimestamp() || profileRecentWindowUpperBound();
      let scannedWindows = 0;

      while (cursor > 0 && nextEvents.length < profileEventPageLimit && scannedWindows < profileWindowScanLimit) {
        const windowLower = Math.max(0, cursor - profilePageWindowSeconds);
        const requestLimit = profileEventPageLimit - nextEvents.length;
        const fetched = await fetchProfileEvents(targetPubkey, $relays, requestLimit, {
          since: windowLower,
          until: Math.max(0, cursor - 1)
        }).catch(() => []);
        if (targetPubkey !== pubkey) return false;

        nextEvents.push(...fetched);
        if (fetched.length >= requestLimit) {
          cursor = nextProfilePaginationCursor(fetched, windowLower, requestLimit);
          break;
        }
        cursor = windowLower;
        scannedWindows += 1;
      }

      if (targetPubkey !== pubkey) return false;
      profilePaginationCursor = cursor;
      hasMoreProfile = cursor > 0;
      const cleanNextEvents = cleanProfileEvents(nextEvents);
      if (cleanNextEvents.length) {
        events.update((existing) => mergeEvents(cleanNextEvents, existing));
        addProfileEvents(cleanNextEvents);
      }
      return cleanNextEvents.length > 0;
    } finally {
      loadingMoreProfile = false;
      scheduleProfilePreloadIfNeeded();
    }
  }

  function scheduleProfilePreload() {
    if (profilePreloadTimer || loadingProfile || loadingMoreProfile || !hasMoreProfile) return;
    profilePreloadTimer = setTimeout(() => {
      profilePreloadTimer = undefined;
      if (!loadingProfile && !loadingMoreProfile && hasMoreProfile) void loadMoreProfileEvents();
    }, 120);
  }

  function scheduleProfilePreloadIfNeeded() {
    if (!browser || !hasMoreProfile || loadingProfile || loadingMoreProfile) return;
    if (distanceToPageBottom() <= profilePreloadDistancePx) scheduleProfilePreload();
  }

  function distanceToPageBottom() {
    if (!browser) return Number.POSITIVE_INFINITY;
    return document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
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
    profileSummaryEvents = cleanProfileSummaryEvents([...profileSummaryEvents, ...nextEvents]);
    profileEvents = cleanProfileEvents([...profileEvents, ...nextEvents]);
    void refreshProfileStats();
  }

  function refreshProfileStats() {
    const statIds = [...new Set(userItems.map((item) => item.event.id))];
    if (statIds.length) void refreshEventStats(statIds, true);
  }

  function cleanProfileEvents(nextEvents: NostrEvent[]) {
    return dedupeEvents(nextEvents).filter((event) => event.kind === 6 || (event.kind === 1 && topLevelFeedEvents([event]).length));
  }

  function cleanProfileSummaryEvents(nextEvents: NostrEvent[]) {
    return dedupeEvents(nextEvents).filter((event) => event.kind === 1 || event.kind === 30023);
  }

  function profileSummaryForEvents(nextEvents: NostrEvent[]) {
    const summary = { notes: 0, replies: 0, reads: 0, media: 0 };
    for (const event of nextEvents) {
      if (event.kind === 30023) {
        summary.reads += 1;
        continue;
      }
      if (event.kind !== 1) continue;
      if (isReplyEvent(event)) summary.replies += 1;
      else summary.notes += 1;
      if (extractMediaAttachments(event).length) summary.media += 1;
    }
    return summary;
  }

  function profileRecentWindowUpperBound() {
    return Math.floor(Date.now() / 1000);
  }

  function profileRecentWindowLowerBound() {
    return Math.max(0, profileRecentWindowUpperBound() - profilePageWindowSeconds);
  }

  function eventInProfileWindow(event: NostrEvent, since: number, until: number) {
    return event.created_at >= since && event.created_at <= until;
  }

  function nextProfilePaginationCursor(nextEvents: NostrEvent[], windowLower: number, limit: number) {
    const cleanEvents = cleanProfileEvents(nextEvents);
    if (cleanEvents.length >= limit) return Math.max(windowLower, Math.min(...cleanEvents.map((event) => event.created_at)));
    return windowLower;
  }

  function openEditor() {
    editingProfilePubkey = pubkey;
    draft = { ...emptyProfile(), ...profile, pubkey };
    editorOpen = true;
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

  function safeHttpUrl(value: string | undefined) {
    if (!value) return '';
    try {
      const parsed = new URL(value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
      return '';
    }
  }

  function currentProfileRouteKey() {
    if (!browser) return '';
    return `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
  }

  function saveCurrentProfileScrollPosition() {
    if (!browser || !routeKey) return;
    const anchor = firstVisibleProfileNote();
    saveRouteScrollState(routeKey, {
      scrollY: window.scrollY,
      anchorId: anchor?.dataset.noteId,
      anchorOffset: anchor?.getBoundingClientRect().top
    });
  }

  async function restoreProfileScrollPosition(nextRouteKey: string) {
    if (!browser || !nextRouteKey || restoredProfileRouteKey === nextRouteKey) return;
    const state = readRouteScrollState(nextRouteKey);
    if (!state || Date.now() - state.savedAt > profileScrollStateMaxAgeMs) {
      restoredProfileRouteKey = nextRouteKey;
      return;
    }
    restoredProfileRouteKey = nextRouteKey;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await tick();
      await nextAnimationFrame();
      const anchor = state.anchorId ? document.querySelector<HTMLElement>(`.profile-page [data-note-id="${state.anchorId}"]`) : null;
      if (anchor) {
        const top = window.scrollY + anchor.getBoundingClientRect().top - (state.anchorOffset ?? 0);
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
      } else {
        window.scrollTo({ top: state.scrollY, left: 0, behavior: 'instant' });
      }
    }
  }

  function firstVisibleProfileNote() {
    if (!browser) return undefined;
    return [...document.querySelectorAll<HTMLElement>('.profile-page [data-note-id]')].find((element) => element.getBoundingClientRect().bottom > 0);
  }

  function nextAnimationFrame() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
</script>

<div class="profile-page">
  <section class="profile-hero">
    <a class="page-back" href={appPath('/')} aria-label="Back to feed"><ArrowLeft size={18} /> Back</a>

    <div class="profile-banner" style={`background-image: ${profile?.banner ? `url(${profile.banner})` : 'none'}`}></div>

    <div class="profile-card">
      <div class="avatar xlarge">
        {#if profile?.picture}<img src={profile.picture} alt="" />{:else}<span>{avatarInitial}</span>{/if}
      </div>

      <div class="profile-banner-actions">
        {#if isOwnProfile}
          <button class="profile-edit-inline" on:click={openEditor} aria-label="Edit profile">
            <Pencil size={14} /> Edit profile
          </button>
        {:else}
          <button disabled={!$session || updatingFollow} on:click={toggleFollow}>
            {#if isFollowing}<UserMinus size={17} /> Unfollow{:else}<UserPlus size={17} /> Follow{/if}
          </button>
          <button disabled={!$session || updatingMute} on:click={toggleMute}>
            {#if isMuted}<UserMinus size={17} /> Unmute{:else}<UserX size={17} /> Mute{/if}
          </button>
          <button class="icon-button" disabled={!$session} aria-label="Message" on:click={() => { selectMessagePeer(pubkey); void goto(appPath('/messages')); }}><MessageCircle size={19} /></button>
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
          {#if websiteHref}<a href={websiteHref} target="_blank" rel="noreferrer"><Globe2 size={16} /> {websiteLabel}</a>{/if}
          {#if profile?.lud16}<span>{profile.lud16}</span>{/if}
        </div>
      </div>
    </div>

    <div class="profile-summary-tabs" aria-label="Profile activity summary">
      <div class="active">
        <strong>{profileSummary.notes}</strong>
        <span>notes</span>
      </div>
      <div>
        <strong>{profileSummary.replies}</strong>
        <span>replies</span>
      </div>
      <div>
        <strong>{profileSummary.reads}</strong>
        <span>reads</span>
      </div>
      <div>
        <strong>{profileSummary.media}</strong>
        <span>media</span>
      </div>
    </div>

    {#if isOwnProfile && editorOpen && editingProfilePubkey === pubkey}
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
    {#if userItems.length}
      {#each userItems as item (item.id)}
        <NoteCard event={item.event} profile={$profiles[item.event.pubkey] ?? (item.event.pubkey === pubkey ? profile : undefined)} prefetchThread />
      {/each}
    {:else if loadingProfile}
      <div class="empty-state"><strong>Loading profile notes</strong><span>Checking relays for this profile’s posts.</span></div>
    {:else if triedProfileRelays}
      <div class="empty-state"><strong>No notes for this profile yet</strong><span>No posts were returned by the connected relays.</span></div>
    {:else}
      <div class="empty-state"><strong>No notes for this profile yet</strong><span>Connect to relays to check this profile’s posts.</span></div>
    {/if}
    <div class="load-more-sentinel profile-load-more-sentinel" bind:this={profileLoadMoreSentinel}>
      {#if loadingMoreProfile}
        <span>Loading older profile notes</span>
      {:else if userEvents.length}
        <span>Scroll down for older profile notes</span>
      {/if}
    </div>
  </section>
</div>
