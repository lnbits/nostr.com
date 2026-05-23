<script lang="ts">
  import { browser } from '$app/environment';
  import { Copy, ExternalLink, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Zap } from '@lucide/svelte';
  import type { NostrEvent, Profile } from '$lib/nostr/types';
  import { extractMediaAttachments, parseNoteText } from '$lib/nostr/media';
  import { eventStats, filterByHashtag, likedEvents, reactToNote, reportNote, repostNote, startReply } from '$lib/stores/app';

  export let event: NostrEvent;
  export let profile: Profile | undefined;
  export let featured = false;
  export let embedded = false;
  export let onOpen: ((event: NostrEvent) => void) | undefined = undefined;

  const previewLength = 400;
  let expanded = false;
  let openImage: { url: string; alt?: string } | null = null;
  let menuOpen = false;
  let copiedEmbed = false;

  $: name = profile?.display_name || profile?.name || event.pubkey.slice(0, 10);
  $: avatar = profile?.picture;
  $: mediaAttachments = extractMediaAttachments(event);
  $: isLong = event.content.length > previewLength;
  $: visibleContent = !isLong || expanded ? event.content : event.content.slice(0, previewLength).trimEnd();
  $: contentParts = parseNoteText(visibleContent, mediaAttachments.map((media) => media.url), event.tags);
  $: counts = $eventStats[event.id] ?? { replies: 0, reposts: 0, likes: 0, dislikes: 0, emoji: 0, zaps: 0 };
  $: liked = $likedEvents.has(event.id);
  $: time = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.max(-30, Math.round((event.created_at * 1000 - Date.now()) / 86400000)),
    'day'
  );

  function filterHashtag(tag: string) {
    filterByHashtag(tag);
  }

  function openNote() {
    if (onOpen) onOpen(event);
    else if (browser && !embedded) window.location.href = `/thread/${event.id}`;
  }

  function openFromNoteBody(pointerEvent: MouseEvent) {
    if (embedded || isInteractiveTarget(pointerEvent.target)) return;
    openNote();
  }

  function openFromKeyboard(keyboardEvent: KeyboardEvent) {
    if (embedded || !['Enter', ' '].includes(keyboardEvent.key) || isInteractiveTarget(keyboardEvent.target)) return;
    keyboardEvent.preventDefault();
    openNote();
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('a, button, input, textarea, video, .note-actions, .media-grid, .note-menu'));
  }

  function embedUrl() {
    const base = browser ? window.location.origin : '';
    return `${base}/embed/${event.id}`;
  }

  async function copyEmbed() {
    const url = embedUrl();
    const iframeId = `nostr-embed-${event.id.slice(0, 12)}`;
    const code = `<iframe id="${iframeId}" src="${url}" title="Nostr note" width="100%" height="160" scrolling="no" style="border:0;max-width:640px;width:100%;display:block;overflow:hidden;"></iframe>
<scr` + `ipt>
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'nostr-embed-size' || event.data.id !== '${event.id}') return;
    var frame = document.getElementById('${iframeId}');
    if (frame) frame.style.height = event.data.height + 'px';
  });
</scr` + `ipt>`;
    await navigator.clipboard.writeText(code);
    copiedEmbed = true;
    menuOpen = false;
    setTimeout(() => (copiedEmbed = false), 1400);
  }
</script>

<article class="note-card" class:featured class:embedded>
  <a class="avatar" href={`/profile/${event.pubkey}`} aria-label={`${name} profile`}>
    {#if avatar}
      <img src={avatar} alt="" loading="lazy" />
    {:else}
      <span>{name.slice(0, 1).toUpperCase()}</span>
    {/if}
  </a>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="note-body" role={embedded ? undefined : 'button'} tabindex={embedded ? undefined : 0} on:click={openFromNoteBody} on:keydown={openFromKeyboard}>
    <div class="note-meta">
      <a href={`/profile/${event.pubkey}`}><strong>{name}</strong></a>
      <span>{time}</span>
      {#if !embedded}
        <div class="note-menu">
          <button class="icon-button small" aria-label="More actions" aria-expanded={menuOpen} on:click={() => (menuOpen = !menuOpen)}>
            {#if copiedEmbed}<Copy size={16} />{:else}<MoreHorizontal size={18} />{/if}
          </button>
          {#if menuOpen}
            <div class="note-menu-popover">
              <button on:click={copyEmbed}><Copy size={16} /> Copy embed</button>
              <a href={`/embed/${event.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open embed</a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="note-content" class:collapsed={isLong && !expanded}>
      {#each contentParts as part}
        {#if part.type === 'hashtag'}
          <button class="hashtag" on:click={() => filterHashtag(part.value)}>#{part.value}</button>
        {:else if part.type === 'nostr'}
          <a href={part.href}>{part.label}</a>
        {:else if part.type === 'mention'}
          <a href={part.href}>{part.value}</a>
        {:else if part.type === 'link'}
          <a href={part.href} target="_blank" rel="noreferrer">{part.value}</a>
        {:else}
          {#if onOpen}
            <button class="note-open-text" on:click={openNote}>{part.value}</button>
          {:else}
            {part.value}
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
    {#if mediaAttachments.length}
      <div class="media-grid">
        {#each mediaAttachments as media}
          {#if media.type === 'video'}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={media.url} controls preload="metadata" playsinline title={media.alt}></video>
          {:else}
            <button class="media-image-button" on:click={() => (openImage = { url: media.url, alt: media.alt })} aria-label="Open image">
              <img src={media.url} alt={media.alt ?? ''} loading="lazy" referrerpolicy="no-referrer" />
            </button>
          {/if}
        {/each}
      </div>
    {/if}
    {#if embedded}
      <a class="embed-open-link" href={`/thread/${event.id}?feed=global`} target="_blank" rel="noreferrer">View on Nostr</a>
    {:else}
      <div class="note-actions">
        <button aria-label="Reply" on:click={() => startReply(event)}><MessageCircle size={18} /><span>{counts.replies}</span></button>
        <button aria-label="Repost" on:click={() => void repostNote(event)}><Repeat2 size={18} /><span>{counts.reposts}</span></button>
        <button class:liked aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} on:click={() => void reactToNote(event)}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /><span>{counts.likes}</span></button>
        <button aria-label="Zap"><Zap size={18} /><span>{counts.zaps}</span></button>
        <button aria-label="Report" on:click={() => void reportNote(event)}><Flag size={17} /></button>
      </div>
    {/if}
  </div>
</article>

{#if openImage}
  <div class="dialog-backdrop image-viewer-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && (openImage = null)}>
    <div
      class="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabindex="0"
      on:click={() => (openImage = null)}
      on:keydown={(event) => ['Enter', ' ', 'Escape'].includes(event.key) && (openImage = null)}
    >
      <img src={openImage.url} alt={openImage.alt ?? ''} referrerpolicy="no-referrer" />
    </div>
  </div>
{/if}
