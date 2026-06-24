<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import { eventStats, events, mergeEvents, mergeProfileRecords, profiles, refreshEventStats, relays } from '$lib/stores/app';
  import { dedupeEvents, fetchContactListDetails, fetchFeed, fetchProfiles } from '$lib/nostr/client';
  import { appPath } from '$lib/paths';
  import type { NostrEvent, Profile } from '$lib/nostr/types';

  const initialFeedLimit = 48;
  const pageFeedLimit = 48;
  const feedSettings = { friendsOfFriends: false, keywords: [], interests: [] };

  $: pubkey = normalizePubkey($page.params.pubkey ?? '');
  $: profile = $profiles[pubkey];
  $: displayName = profile?.display_name || profile?.name || shortNpub(pubkey) || 'Nostr profile';
  $: avatarInitial = (profile?.display_name || profile?.name || pubkey || '?').slice(0, 1).toUpperCase();

  let loading = true;
  let loadingMore = false;
  let triedRelays = false;
  let error = '';
  let hydratedPubkey = '';
  let followPubkeys: string[] = [];
  let feedEvents: NostrEvent[] = [];
  let oldestCursor = 0;
  let hasMore = true;
  let loadMoreSentinel: HTMLDivElement;
  let observer: IntersectionObserver | undefined;

  onMount(() => {
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadOlderFeed();
      },
      { rootMargin: '420px 0px' }
    );
    if (loadMoreSentinel) observer.observe(loadMoreSentinel);
  });

  onDestroy(() => {
    observer?.disconnect();
  });

  $: if (browser && pubkey && pubkey !== hydratedPubkey) void loadFollowFeed();
  $: if (browser && observer && loadMoreSentinel) observer.observe(loadMoreSentinel);

  async function loadFollowFeed() {
    const targetPubkey = pubkey;
    if (!targetPubkey) return;
    hydratedPubkey = targetPubkey;
    loading = true;
    loadingMore = false;
    triedRelays = false;
    error = '';
    followPubkeys = [];
    feedEvents = [];
    oldestCursor = 0;
    hasMore = true;

    try {
      const [profileRecords, contacts] = await Promise.all([
        profile ? Promise.resolve([] as Profile[]) : fetchProfiles([targetPubkey], $relays).catch(() => []),
        fetchContactListDetails(targetPubkey, $relays)
      ]);
      if (targetPubkey !== pubkey) return;
      if (profileRecords.length) profiles.update((existing) => mergeProfileRecords(existing, profileRecords));
      followPubkeys = contacts.pubkeys;
      triedRelays = true;

      if (!followPubkeys.length) {
        hasMore = false;
        return;
      }

      const events = await fetchFollowFeedPage(followPubkeys, initialFeedLimit);
      if (targetPubkey !== pubkey) return;
      setFeedEvents(events);
      await hydrateFeedProfiles(events);
    } catch (exception) {
      if (targetPubkey !== pubkey) return;
      error = exception instanceof Error ? exception.message : 'Could not load follow feed.';
      triedRelays = true;
      hasMore = false;
    } finally {
      if (targetPubkey === pubkey) loading = false;
    }
  }

  async function loadOlderFeed() {
    if (!pubkey || loading || loadingMore || !hasMore || !followPubkeys.length || !feedEvents.length) return;
    loadingMore = true;
    try {
      const older = await fetchFollowFeedPage(followPubkeys, pageFeedLimit, oldestCursor ? oldestCursor - 1 : undefined);
      if (!older.length) {
        hasMore = false;
        return;
      }
      setFeedEvents([...feedEvents, ...older]);
      await hydrateFeedProfiles(older);
      hasMore = true;
    } finally {
      loadingMore = false;
    }
  }

  async function fetchFollowFeedPage(follows: string[], limit: number, until?: number) {
    return fetchFeed('follow', $relays, follows, feedSettings, { limit, until });
  }

  function setFeedEvents(nextEvents: NostrEvent[]) {
    feedEvents = dedupeEvents(nextEvents).sort((a, b) => b.created_at - a.created_at);
    oldestCursor = feedEvents.at(-1)?.created_at ?? 0;
    hasMore = Boolean(nextEvents.length);
    if (feedEvents.length) events.update((existing) => mergeEvents(feedEvents, existing));
    if (feedEvents.length) void refreshEventStats(feedEvents.map((event) => event.id).filter((id) => !$eventStats[id]));
  }

  async function hydrateFeedProfiles(events: NostrEvent[]) {
    const missing = [...new Set(events.map((event) => event.pubkey))].filter((author) => !$profiles[author]);
    if (!missing.length) return;
    const fetched = await fetchProfiles(missing.slice(0, 80), $relays).catch(() => []);
    if (fetched.length) profiles.update((existing) => mergeProfileRecords(existing, fetched));
  }

  function normalizePubkey(value: string) {
    return /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : '';
  }

  function shortNpub(value: string) {
    if (!/^[0-9a-f]{64}$/i.test(value)) return '';
    const npub = nip19.npubEncode(value);
    return `${npub.slice(0, 10)}...${npub.slice(-6)}`;
  }
</script>

<div class="profile-follow-feed-page">
  <a class="page-back" href={appPath(`/profile/${pubkey}`)} aria-label="Back to profile"><ArrowLeft size={18} /> Back</a>

  <header class="follow-feed-head">
    <div class="avatar xlarge">
      {#if profile?.picture}<img src={profile.picture} alt="" />{:else}<span>{avatarInitial}</span>{/if}
    </div>
    <h1>{displayName} - follow feed</h1>
  </header>

  <section class="feed-list narrow" aria-label={`${displayName} follow feed`}>
    {#if feedEvents.length}
      {#each feedEvents as event (event.id)}
        <NoteCard {event} profile={$profiles[event.pubkey]} prefetchThread />
      {/each}
    {:else if loading}
      <div class="empty-state"><strong>Loading follow feed</strong><span>Fetching this user's follow list and recent notes.</span></div>
    {:else if error}
      <div class="empty-state"><strong>Could not load follow feed</strong><span>{error}</span></div>
    {:else if triedRelays && !followPubkeys.length}
      <div class="empty-state"><strong>No follow list found</strong><span>This profile has not published a public follow list on the connected relays.</span></div>
    {:else}
      <div class="empty-state"><strong>No notes found</strong><span>No recent posts were returned from the users this profile follows.</span></div>
    {/if}
    <div class="load-more-sentinel" bind:this={loadMoreSentinel}>
      {#if loadingMore}
        <span>Loading older notes</span>
      {:else if hasMore && feedEvents.length}
        <span>Scroll down for older notes</span>
      {/if}
    </div>
  </section>
</div>
