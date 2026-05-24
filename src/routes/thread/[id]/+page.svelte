<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import ThreadReplyTree from '$lib/components/ThreadReplyTree.svelte';
  import { deletedEventIds, eventStats, events, mergeEvents, profiles, refreshEventStats, relays, session } from '$lib/stores/app';
  import { eventStatsFromEvents, fetchMissingEvents, fetchProfiles, fetchThreadReplies } from '$lib/nostr/client';
  import { appPath } from '$lib/paths';
  import type { NostrEvent } from '$lib/nostr/types';

  const initialThreadReplyLimit = 40;
  const nestedThreadReplyLimit = 80;

  $: id = $page.params.id;
  $: focusedReplyId = $page.url.searchParams.get('focus') ?? '';
  $: threadEvents = mergeThreadEvents(localThreadEvents, $events);
  $: root = rootEvent?.id === id ? rootEvent : threadEvents.find((event) => event.id === id);
  $: replies = id ? threadReplyEvents(threadEvents, id) : [];
  $: repliesByParent = id ? groupRepliesByParent(replies, id) : {};
  let loading = true;
  let hydratedId = '';
  let rootEvent: NostrEvent | undefined;
  let localThreadEvents: NostrEvent[] = [];

  onMount(() => {
    void hydrateThread();
  });

  $: if (browser && id && id !== hydratedId) void hydrateThread();

  function mergeThreadEvents(incoming: NostrEvent[], existing: NostrEvent[]) {
    const byId = new Map<string, NostrEvent>();
    [...existing, ...incoming].forEach((event) => byId.set(event.id, event));
    return [...byId.values()].filter((event) => !$deletedEventIds.has(event.id)).sort((a, b) => b.created_at - a.created_at);
  }

  function threadReplyEvents(items: NostrEvent[], rootId: string) {
    const candidates = items.filter((event) => event.id !== rootId && event.kind === 1 && event.tags.some((tag) => tag[0] === 'e' && tag[1]));
    const included = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const event of candidates) {
        if (included.has(event.id)) continue;
        const parent = replyParentId(event, rootId);
        if (parent === rootId || included.has(parent)) {
          included.add(event.id);
          changed = true;
        }
      }
    }
    return candidates.filter((event) => included.has(event.id));
  }

  function groupRepliesByParent(items: NostrEvent[], rootId: string) {
    const byParent: Record<string, NostrEvent[]> = {};
    for (const event of items) {
      const parent = replyParentId(event, rootId);
      if (!parent) continue;
      byParent[parent] = [...(byParent[parent] ?? []), event];
    }
    Object.values(byParent).forEach((events) => events.sort((a, b) => a.created_at - b.created_at));
    return byParent;
  }

  function replyParentId(event: NostrEvent, rootId: string) {
    const replyTag = [...event.tags].reverse().find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'reply');
    if (replyTag?.[1]) return replyTag[1];
    const eTags = event.tags.filter((tag) => tag[0] === 'e' && tag[1]);
    const nonRoot = [...eTags].reverse().find((tag) => tag[1] !== rootId);
    return nonRoot?.[1] ?? (eTags.some((tag) => tag[1] === rootId) ? rootId : '');
  }

  async function hydrateThread() {
    if (!id || hydratedId === id) return;
    hydratedId = id;
    localThreadEvents = cachedThreadSeed(id, focusedReplyId);
    loading = true;
    try {
      const cached = $events.find((event) => event.id === id);
      const [found] = cached ? [cached] : await fetchMissingEvents([id], $relays).catch(() => []);
      if (found) {
        rootEvent = found;
        localThreadEvents = mergeThreadEvents([found], localThreadEvents);
        events.update((existing) => mergeEvents([found], existing));
      }
      const fetchedReplies = await fetchThreadReplies(id, $relays, initialThreadReplyLimit).catch(() => []);
      const nestedReplies = fetchedReplies.length
        ? await fetchThreadReplies(
            fetchedReplies.map((event) => event.id),
            $relays,
            nestedThreadReplyLimit
          ).catch(() => [])
        : [];
      const allReplies = mergeThreadEvents(nestedReplies, fetchedReplies).filter((event) => event.id !== id);
      if (fetchedReplies.length) {
        localThreadEvents = mergeThreadEvents(allReplies, localThreadEvents);
      }
      refreshThreadStats(mergeThreadEvents([...(found ? [found] : []), ...allReplies], localThreadEvents));

      const pubkeys = [...(found ? [found.pubkey] : []), ...allReplies.map((event) => event.pubkey)];
      const missingPubkeys = [...new Set(pubkeys.filter((pubkey) => !$profiles[pubkey]))];
      if (missingPubkeys.length) {
        const fetchedProfiles = await fetchProfiles(missingPubkeys, $relays).catch(() => []);
        if (fetchedProfiles.length) profiles.update((existing) => ({ ...existing, ...Object.fromEntries(fetchedProfiles.map((profile) => [profile.pubkey, profile])) }));
      }
    } finally {
      loading = false;
    }
  }

  function cachedThreadSeed(rootId: string, focusId: string) {
    return $events.filter((event) => event.id === rootId || (focusId && event.id === focusId));
  }

  function refreshThreadStats(threadItems: NostrEvent[]) {
    const statIds = [...new Set(threadItems.map((event) => event.id))];
    if (!statIds.length) return;

    const localStats = eventStatsFromEvents(statIds, threadItems);
    eventStats.update((existing) => {
      const next = { ...existing };
      for (const id of statIds) {
        const existingStats = next[id] ?? { replies: 0, reposts: 0, likes: 0, zaps: 0, zapSats: 0, dislikes: 0, emoji: 0 };
        const loadedStats = localStats[id] ?? existingStats;
        next[id] = {
          replies: Math.max(existingStats.replies, loadedStats.replies),
          reposts: Math.max(existingStats.reposts, loadedStats.reposts),
          likes: Math.max(existingStats.likes, loadedStats.likes),
          zaps: Math.max(existingStats.zaps, loadedStats.zaps),
          zapSats: Math.max(existingStats.zapSats, loadedStats.zapSats),
          dislikes: Math.max(existingStats.dislikes, loadedStats.dislikes),
          emoji: Math.max(existingStats.emoji, loadedStats.emoji)
        };
      }
      return next;
    });
    void refreshEventStats(statIds, true);
  }
</script>

<section class="thread-page">
  <a class="page-back" href={appPath('/')} aria-label="Back to feed"><ArrowLeft size={18} /> Back</a>

  {#if root}
    <div class="feed-list">
      <NoteCard event={root} profile={$profiles[root.pubkey]} />
      {#if replies.length}
        <ThreadReplyTree parentId={root.id} {repliesByParent} profiles={$profiles} focusedId={focusedReplyId} />
      {:else}
        <div class="empty-state"><strong>No replies found yet</strong><span>Relays did not return replies for this thread.</span></div>
      {/if}
    </div>
  {:else if loading}
    <div class="empty-state"><span>Loading thread</span></div>
  {:else}
    <div class="empty-state"><strong>Thread not cached</strong><span>Open a note from the feed or refresh relays to hydrate it.</span></div>
  {/if}
</section>
