<script lang="ts">
  import { Heart, MessageCircle, Repeat2, Zap, MoreHorizontal, Flag } from '@lucide/svelte';
  import type { NostrEvent, Profile } from '$lib/nostr/types';
  import { extractMediaUrls, isVideoUrl, parseHashtags } from '$lib/nostr/media';
  import { customFeedSettings, eventStats, feedMode, refreshFeed, startReply } from '$lib/stores/app';

  export let event: NostrEvent;
  export let profile: Profile | undefined;
  export let featured = false;
  export let onOpen: ((event: NostrEvent) => void) | undefined = undefined;

  const previewLength = 400;
  let expanded = false;

  $: name = profile?.display_name || profile?.name || event.pubkey.slice(0, 10);
  $: avatar = profile?.picture;
  $: mediaUrls = extractMediaUrls(event.content);
  $: isLong = event.content.length > previewLength;
  $: visibleContent = !isLong || expanded ? event.content : event.content.slice(0, previewLength).trimEnd();
  $: contentParts = parseHashtags(visibleContent);
  $: counts = $eventStats[event.id] ?? { replies: 0, reposts: 0, likes: 0, zaps: 0 };
  $: time = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.max(-30, Math.round((event.created_at * 1000 - Date.now()) / 86400000)),
    'day'
  );

  function filterHashtag(tag: string) {
    customFeedSettings.update((settings) => ({
      ...settings,
      keywords: [...new Set([...settings.keywords, tag])]
    }));
    feedMode.set('custom');
    void refreshFeed('custom');
  }

  function openNote() {
    if (onOpen) onOpen(event);
  }
</script>

<article class="note-card" class:featured>
  <a class="avatar" href={`/profile/${event.pubkey}`} aria-label={`${name} profile`}>
    {#if avatar}
      <img src={avatar} alt="" loading="lazy" />
    {:else}
      <span>{name.slice(0, 1).toUpperCase()}</span>
    {/if}
  </a>

  <div class="note-body">
    <div class="note-meta">
      <a href={`/profile/${event.pubkey}`}><strong>{name}</strong></a>
      <span>{time}</span>
      <button class="icon-button small" aria-label="More actions"><MoreHorizontal size={18} /></button>
    </div>
    <div class="note-content" class:collapsed={isLong && !expanded}>
      {#each contentParts as part}
        {#if part.type === 'hashtag'}
          <button class="hashtag" on:click={() => filterHashtag(part.value)}>#{part.value}</button>
        {:else}
          {#if onOpen}
            <button class="note-open-text" on:click={openNote}>{part.value}</button>
          {:else}
            <a href={`/thread/${event.id}`}>{part.value}</a>
          {/if}
        {/if}
      {/each}
      {#if isLong && !expanded}
        <span class="fade-tail" aria-hidden="true"></span>
      {/if}
    </div>
    {#if isLong && !expanded}
      <button class="show-more" on:click={() => (expanded = true)}>show more</button>
    {:else if isLong}
      <button class="show-more" on:click={() => (expanded = false)}>show less</button>
    {/if}
    {#if mediaUrls.length}
      <div class="media-grid">
        {#each mediaUrls as url}
          {#if isVideoUrl(url)}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={url} controls preload="metadata" playsinline></video>
          {:else}
            <img src={url} alt="" loading="lazy" referrerpolicy="no-referrer" />
          {/if}
        {/each}
      </div>
    {/if}
    <div class="note-actions">
      <button aria-label="Reply" on:click={() => startReply(event)}><MessageCircle size={18} /><span>{counts.replies}</span></button>
      <button aria-label="Repost"><Repeat2 size={18} /><span>{counts.reposts}</span></button>
      <button aria-label="Like"><Heart size={18} /><span>{counts.likes}</span></button>
      <button aria-label="Zap"><Zap size={18} /><span>{counts.zaps}</span></button>
      <button aria-label="Report"><Flag size={17} /></button>
    </div>
  </div>
</article>
