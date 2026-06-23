<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { Copy, ExternalLink, Flag, Heart, Link, MessageCircle, MoreHorizontal, Pencil, Repeat2, Trash2, UserX, Zap } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import type { NostrEvent, Profile } from '$lib/nostr/types';
  import { extractMediaAttachments, extractQuotedNoteReferences, extractSocialEmbeds, parseNoteText } from '$lib/nostr/media';
  import { activeRelayUrls, fetchLikeAuthors, fetchProfiles, subscribeZapReceipts } from '$lib/nostr/client';
  import { createZapInvoice, loadZapInfo, type ZapInfo } from '$lib/nostr/zap';
  import { deleteNote, displayEventForEvent, filterByHashtag, likedStateForEvent, mergeProfileRecords, muteAccount, prefetchThreadPreview, profiles, reactToNote, refreshEventStats, relays, reportNote, repostedStateForEvent, repostNote, session, startEdit, startQuote, startReply, statsForEvent, watchVisibleNoteStats } from '$lib/stores/app';
  import { appPath } from '$lib/paths';
  import { pauseWhenHidden } from '$lib/actions/pauseWhenHidden';
  import { saveRouteScrollState } from '$lib/stores/routeScroll';
  import { saveThreadReturnTarget, currentThreadReturnTarget } from '$lib/stores/threadNavigation';
  import { saveThreadSeed } from '$lib/stores/threadSeed';
  import ImageViewer from './ImageViewer.svelte';
  import QuotedNotePreview from './QuotedNotePreview.svelte';
  import VideoAttachment from './VideoAttachment.svelte';

  export let event: NostrEvent;
  export let profile: Profile | undefined;
  export let featured = false;
  export let embedded = false;
  export let prefetchThread = false;
  export let initialExpanded = false;
  export let hiddenQuotedNoteIds: string[] = [];
  export let onOpen: ((event: NostrEvent) => void) | undefined = undefined;

  const previewLength = 400;
  const maxParsedContentLength = 8000;
  const maxExpandedContentLength = 6000;
  const maxRenderableTags = 300;
  const maxRenderedTextParts = 240;
  const maxMediaAttachments = 6;
  const maxSocialEmbeds = 3;
  const maxQuotedNotes = 3;
  let expanded = initialExpanded;
  let openImage: { url: string; alt?: string } | null = null;
  let menuOpen = false;
  let repostMenuOpen = false;
  let copiedEmbed = false;
  let copiedEventId = false;
  let copiedShareLink = false;
  let likePopoverOpen = false;
  let likeAuthors: string[] = [];
  let loadingLikeAuthors = false;
  let reportDialogOpen = false;
  let reporting = false;
  let reportError = '';
  let deleteDialogOpen = false;
  let deleting = false;
  let deleteError = '';
  let zapDialogOpen = false;
  let zapInfo: ZapInfo | null = null;
  let zapLookupKey = '';
  let zapChecking = false;
  let zapAmount = '21';
  let zapInvoice = '';
  let zapQr = '';
  let zapLoading = false;
  let zapError = '';
  let zapCopied = false;
  let zapPaid = false;
  let liking = false;
  let reposting = false;
  let zapReceiptSub: { close: (reason?: string) => void } | undefined;
  let noteElement: HTMLElement;
  let menuElement: HTMLElement;
  let repostMenuElement: HTMLElement;
  let noteObserver: IntersectionObserver | undefined;
  let prefetchTimer: ReturnType<typeof setTimeout> | undefined;
  let floatingMenuListenerActive = false;
  let statsVisible = false;
  let heavyContentReady = embedded;
  let statsEventId = event.id;
  $: statsStore = statsForEvent(event.id);
  $: likedStore = likedStateForEvent(event.id);
  $: repostedStore = repostedStateForEvent(event.id);
  $: displayEventStore = displayEventForEvent(event);

  onMount(() => {
    if (!browser || embedded) return;
    if (!('IntersectionObserver' in window)) {
      statsVisible = true;
      heavyContentReady = true;
      watchVisibleNoteStats(event.id, true);
      scheduleThreadPrefetch(true);
      return;
    }
    noteObserver = new IntersectionObserver(
      ([entry]) => updateStatsVisibility(Boolean(entry?.isIntersecting)),
      { rootMargin: '900px 0px' }
    );
    noteObserver.observe(noteElement);
  });

  onDestroy(() => {
    noteObserver?.disconnect();
    clearTimeout(prefetchTimer);
    stopFloatingMenuListener();
    if (statsVisible) watchVisibleNoteStats(statsEventId, false);
    zapReceiptSub?.close('note destroyed');
  });

  $: if (browser) syncFloatingMenuListener(menuOpen || repostMenuOpen);

  $: if (browser && !embedded && event.id !== statsEventId) {
    if (statsVisible) {
      watchVisibleNoteStats(statsEventId, false);
      watchVisibleNoteStats(event.id, true);
    }
    statsEventId = event.id;
  }

  $: displayEvent = $displayEventStore;
  $: name = profile?.display_name || profile?.name || displayEvent.pubkey.slice(0, 10);
  $: avatar = profile?.picture;
  $: safeTags = displayEvent.tags.slice(0, maxRenderableTags);
  $: parsedContent = displayEvent.content.slice(0, maxParsedContentLength);
  $: renderedContent = displayEvent.content.slice(0, maxExpandedContentLength);
  $: contentWasCapped = displayEvent.content.length > maxExpandedContentLength;
  $: mediaAttachments = heavyContentReady ? extractMediaAttachments({ ...displayEvent, content: parsedContent, tags: safeTags }).slice(0, maxMediaAttachments) : [];
  $: socialEmbeds = heavyContentReady ? extractSocialEmbeds(parsedContent).slice(0, maxSocialEmbeds) : [];
  $: hiddenQuotedNoteIdSet = new Set(hiddenQuotedNoteIds);
  $: allQuotedNoteReferences = heavyContentReady ? extractQuotedNoteReferences(parsedContent, safeTags).slice(0, maxQuotedNotes) : [];
  $: quotedNoteReferences = allQuotedNoteReferences.filter((reference) => !hiddenQuotedNoteIdSet.has(reference.id));
  $: quotedNoteRawValues = allQuotedNoteReferences.map((reference) => reference.raw);
  $: isLong = displayEvent.content.length > previewLength;
  $: visibleContent = !isLong || expanded ? renderedContent : renderedContent.slice(0, previewLength).trimEnd();
  $: contentParts = parseNoteText(visibleContent, [...mediaAttachments.map((media) => media.url), ...socialEmbeds.map((embed) => embed.url), ...quotedNoteRawValues], safeTags).slice(0, maxRenderedTextParts);
  $: counts = $statsStore;
  $: liked = $likedStore;
  $: reposted = $repostedStore;
  $: isOwnPost = $session?.pubkey === event.pubkey;
  $: canZap = Boolean(zapInfo && $session);
  $: zapTitle = !$session ? 'Sign in to zap' : zapInfo ? 'Zap this post' : zapChecking ? 'Checking zap support' : 'This user has not enabled zaps';
  $: timestamp = new Date(event.created_at * 1000);
  $: time = formatNoteTime(timestamp);
  $: fullTime = timestamp.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  $: if (browser && !embedded && statsVisible) {
    void refreshZapInfo();
  }

  function formatNoteTime(date: Date, now = new Date()) {
    const futureMs = date.getTime() - now.getTime();
    if (futureMs > 120_000) return formatAbsoluteNoteTime(date, now);
    const elapsedMs = Math.max(0, now.getTime() - date.getTime());
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes < 1) return 'now';
    if (elapsedMinutes < 60) return `${elapsedMinutes}min`;
    if (elapsedMinutes < 120) return '1hr';
    if (isSameDay(date, now)) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return formatAbsoluteNoteTime(date, now);
  }

  function formatAbsoluteNoteTime(date: Date, now = new Date()) {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return date.toLocaleString('en-GB', options);
  }

  function isSameDay(date: Date, other: Date) {
    return date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate();
  }

  function filterHashtag(tag: string) {
    filterByHashtag(tag);
    if (browser) void goto(appPath('/'));
  }

  function openNote() {
    if (onOpen) onOpen(event);
    else if (browser && !embedded) {
      const rootId = threadRootId(displayEvent);
      const focus = rootId && rootId !== event.id ? `?focus=${event.id}` : '';
      const threadPath = appPath(`/thread/${rootId || event.id}${focus}`);
      if ($page.url.pathname === threadPath) return;
      saveCurrentRoutePosition(noteElement);
      saveThreadSeed(event);
      prefetchThreadPreview(displayEvent);
      saveThreadReturnTarget(rootId || event.id, currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash));
      void goto(threadPath);
    }
  }

  function threadRootId(note: NostrEvent) {
    if (note.kind !== 1) return note.id;
    const rootTag = note.tags.find((tag) => tag[0] === 'e' && tag[1] && tag[3] === 'root');
    if (rootTag?.[1]) return rootTag[1];
    const eTags = note.tags.filter((tag) => tag[0] === 'e' && tag[1]);
    return eTags[0]?.[1] ?? note.id;
  }

  function saveCurrentRoutePosition(anchor: HTMLElement | undefined) {
    if (!browser || !anchor?.dataset.noteId) return;
    saveRouteScrollState(
      currentThreadReturnTarget($page.url.pathname, $page.url.search, $page.url.hash),
      {
        scrollY: window.scrollY,
        anchorId: anchor.dataset.noteId,
        anchorOffset: anchor.getBoundingClientRect().top
      },
      { exact: true }
    );
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
    return target instanceof Element && Boolean(target.closest('a, button, input, textarea, video, iframe, .note-actions, .media-grid, .social-embed-list, .note-menu, .reaction-popover, .quoted-note'));
  }

  function closeMenuFromOutside(pointerEvent: PointerEvent) {
    if (!menuOpen || !menuElement || !(pointerEvent.target instanceof Node) || menuElement.contains(pointerEvent.target)) return;
    menuOpen = false;
  }

  function closeRepostMenuFromOutside(pointerEvent: PointerEvent) {
    if (!repostMenuOpen || !repostMenuElement || !(pointerEvent.target instanceof Node) || repostMenuElement.contains(pointerEvent.target)) return;
    repostMenuOpen = false;
  }

  function closeFloatingMenusFromOutside(pointerEvent: PointerEvent) {
    closeMenuFromOutside(pointerEvent);
    closeRepostMenuFromOutside(pointerEvent);
  }

  function syncFloatingMenuListener(shouldListen: boolean) {
    if (shouldListen === floatingMenuListenerActive) return;
    if (shouldListen) {
      document.addEventListener('pointerdown', closeFloatingMenusFromOutside);
      floatingMenuListenerActive = true;
    } else {
      stopFloatingMenuListener();
    }
  }

  function stopFloatingMenuListener() {
    if (!floatingMenuListenerActive) return;
    document.removeEventListener('pointerdown', closeFloatingMenusFromOutside);
    floatingMenuListenerActive = false;
  }

  function quoteNoteAction() {
    repostMenuOpen = false;
    startQuote(displayEvent);
  }

  async function repostNoteAction() {
    if (reposting) return;
    reposting = true;
    repostMenuOpen = false;
    try {
      await repostNote(displayEvent);
    } finally {
      reposting = false;
    }
  }

  async function likeNoteAction() {
    if (liking) return;
    liking = true;
    try {
      await reactToNote(displayEvent);
    } finally {
      liking = false;
    }
  }

  async function toggleLikePopover() {
    likePopoverOpen = !likePopoverOpen;
    if (!likePopoverOpen || likeAuthors.length || loadingLikeAuthors) return;

    loadingLikeAuthors = true;
    try {
      likeAuthors = await fetchLikeAuthors(event.id, $relays);
      const knownProfiles = get(profiles);
      const missing = likeAuthors.filter((pubkey) => !knownProfiles[pubkey]);
      if (missing.length) {
        const fetchedProfiles = await fetchProfiles(missing, $relays).catch(() => []);
        if (fetchedProfiles.length) profiles.update((existing) => mergeProfileRecords(existing, fetchedProfiles));
      }
    } finally {
      loadingLikeAuthors = false;
    }
  }

  function profileName(pubkey: string) {
    const item = get(profiles)[pubkey];
    return item?.display_name || item?.name || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  }

  function nostrReferenceLabel(part: { label: string; pubkey?: string }) {
    return part.pubkey ? `@${profileName(part.pubkey)}` : part.label;
  }

  function embedUrl() {
    const origin = browser ? window.location.origin : '';
    return `${origin}${appPath(`/embed/${event.id}`)}`;
  }

  function shareUrl() {
    return `https://nostr.com/${shareCode()}`;
  }

  function shareCode() {
    const relayHints = activeRelayUrls($relays, 'read').slice(0, 5);
    if (isAddressableEvent(displayEvent.kind)) {
      const identifier = displayEvent.tags.find((tag) => tag[0] === 'd' && tag[1])?.[1] ?? '';
      return nip19.naddrEncode({ identifier, pubkey: displayEvent.pubkey, kind: displayEvent.kind, relays: relayHints });
    }
    return nip19.neventEncode({ id: displayEvent.id, author: displayEvent.pubkey, kind: displayEvent.kind, relays: relayHints });
  }

  function isAddressableEvent(kind: number) {
    return kind >= 30000 && kind < 40000;
  }

  function shouldResetHiddenEmbed(provider: string) {
    return provider === 'instagram' || provider === 'tiktok';
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

  async function copyEventId() {
    await copyText(event.id);
    copiedEventId = true;
    menuOpen = false;
    setTimeout(() => (copiedEventId = false), 1400);
  }

  async function copyShareLink() {
    await copyText(shareUrl());
    copiedShareLink = true;
    menuOpen = false;
    setTimeout(() => (copiedShareLink = false), 1400);
  }

  async function muteAuthor() {
    menuOpen = false;
    await muteAccount(event.pubkey);
  }

  function updateStatsVisibility(visible: boolean) {
    if (visible === statsVisible) return;
    statsVisible = visible;
    if (visible) heavyContentReady = true;
    watchVisibleNoteStats(event.id, visible);
    scheduleThreadPrefetch(visible);
  }

  function scheduleThreadPrefetch(visible: boolean) {
    clearTimeout(prefetchTimer);
    prefetchTimer = undefined;
    if (!visible || !prefetchThread || embedded) return;
    prefetchTimer = setTimeout(() => {
      prefetchTimer = undefined;
      if (!statsVisible || embedded || !prefetchThread) return;
      prefetchThreadPreview(event);
    }, 650);
  }

  async function confirmReport() {
    reporting = true;
    reportError = '';
    try {
      await reportNote(event);
      reportDialogOpen = false;
    } catch (err) {
      reportError = err instanceof Error ? err.message : 'Could not report this post.';
    } finally {
      reporting = false;
    }
  }

  async function confirmDelete() {
    deleting = true;
    deleteError = '';
    try {
      await deleteNote(displayEvent);
      deleteDialogOpen = false;
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Could not delete this post.';
    } finally {
      deleting = false;
    }
  }

  async function refreshZapInfo() {
    const key = `${event.id}:${profile?.lud16 ?? ''}:${profile?.lud06 ?? ''}`;
    if (key === zapLookupKey || !profile) return;
    zapLookupKey = key;
    zapInfo = null;
    zapChecking = true;
    try {
      zapInfo = await loadZapInfo(event, profile, $relays);
    } catch {
      zapInfo = null;
    } finally {
      zapChecking = false;
    }
  }

  function openZapDialog() {
    if (!canZap) return;
    zapDialogOpen = true;
    zapInvoice = '';
    zapQr = '';
    zapError = '';
    zapCopied = false;
    zapPaid = false;
    zapReceiptSub?.close('new zap dialog');
    zapReceiptSub = undefined;
  }

  async function generateZapInvoice() {
    if (!zapInfo || !$session) return;
    zapLoading = true;
    zapError = '';
    zapInvoice = '';
    zapQr = '';
    try {
      const result = await createZapInvoice($session, event, zapInfo, Number(zapAmount), $relays);
      zapInvoice = result.invoice;
      const { default: QRCode } = await import('qrcode');
      zapQr = await QRCode.toDataURL(result.invoice, { margin: 1, width: 260, errorCorrectionLevel: 'M' });
      zapReceiptSub?.close('new zap invoice');
      zapReceiptSub = await subscribeZapReceipts(result.invoice, zapInfo.recipientPubkey, $relays, () => {
        zapPaid = true;
        setTimeout(() => {
          zapDialogOpen = false;
          zapPaid = false;
          zapInvoice = '';
          zapQr = '';
          zapReceiptSub?.close('zap paid');
          zapReceiptSub = undefined;
          void refreshEventStats([event.id], true);
        }, 700);
      }).catch(() => undefined);
    } catch (err) {
      zapError = err instanceof Error ? err.message : 'Could not create a zap invoice.';
    } finally {
      zapLoading = false;
    }
  }

  function openLightningIntent() {
    if (!browser || !zapInvoice) return;
    const link = document.createElement('a');
    link.href = lightningHref(zapInvoice);
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function copyZapInvoice() {
    if (!zapInvoice) return;
    try {
      await copyText(zapInvoice);
      zapCopied = true;
      setTimeout(() => (zapCopied = false), 1400);
    } catch {
      zapError = 'Could not copy the invoice from this browser.';
    }
  }

  function lightningHref(invoice: string) {
    return `lightning:${invoice}`;
  }

  function formatZapTotal(sats: number, fallbackCount: number) {
    const value = sats || fallbackCount;
    if (!value) return '0';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
    return String(value);
  }

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy failed.');
  }
</script>

<article class="note-card" class:featured class:embedded class:menu-open={menuOpen} data-note-id={event.id} bind:this={noteElement}>
  <a class="avatar" href={appPath(`/profile/${displayEvent.pubkey}`)} aria-label={`${name} profile`}>
    {#if avatar}
      <img src={avatar} alt="" loading="lazy" />
    {:else}
      <span>{name.slice(0, 1).toUpperCase()}</span>
    {/if}
  </a>
  {#if !embedded}
    <button class="note-gutter-open" aria-label="Open note" on:click={openNote}></button>
  {/if}

  <div class="note-body">
    <div class="note-meta">
      <a href={appPath(`/profile/${displayEvent.pubkey}`)}><strong>{name}</strong></a>
      <time datetime={timestamp.toISOString()} title={fullTime}>{time}</time>
      {#if !embedded}
        <div class="note-menu" bind:this={menuElement}>
          <button class="icon-button small" aria-label="More actions" aria-expanded={menuOpen} on:click={() => (menuOpen = !menuOpen)}>
            {#if copiedEmbed}<Copy size={16} />{:else}<MoreHorizontal size={18} />{/if}
          </button>
          {#if menuOpen}
            <div class="note-menu-popover">
              <button on:click={copyEmbed}><Copy size={16} /> Copy embed</button>
              <button on:click={copyEventId}><Copy size={16} /> {copiedEventId ? 'Copied event id' : 'Copy event id'}</button>
              <button on:click={copyShareLink}><Link size={16} /> {copiedShareLink ? 'Copied link' : 'Share link'}</button>
              {#if isOwnPost}
                <button on:click={() => { menuOpen = false; startEdit(displayEvent); }}><Pencil size={16} /> Edit post</button>
              {/if}
              {#if isOwnPost}
                <button class="danger-menu-item" on:click={() => { menuOpen = false; deleteDialogOpen = true; }}><Trash2 size={16} /> Delete post</button>
              {/if}
              {#if !isOwnPost}
                <button disabled={!$session} on:click={() => void muteAuthor()}><UserX size={16} /> Mute account</button>
              {/if}
              <a href={appPath(`/embed/${event.id}`)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open embed</a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="note-content" class:collapsed={isLong && !expanded} role={embedded ? undefined : 'button'} tabindex={embedded ? undefined : 0} on:click={openFromNoteBody} on:keydown={openFromKeyboard}>
      {#each contentParts as part}
        {#if part.type === 'hashtag'}
          <button class="hashtag" on:click={() => filterHashtag(part.value)}>#{part.value}</button>
        {:else if part.type === 'nostr'}
          <a href={part.href}>{nostrReferenceLabel(part)}</a>
        {:else if part.type === 'mention'}
          <a href={part.href}>{part.value}</a>
        {:else if part.type === 'link'}
          <a href={part.href} target="_blank" rel="noreferrer">{part.value}</a>
        {:else}
          {#if onOpen && embedded}
            <button class="note-open-text" on:click={openNote}>{part.value}</button>
          {:else}
            {part.value}
          {/if}
        {/if}
      {/each}
      {#if expanded && contentWasCapped}
        <span class="capped-note-copy">… post content truncated</span>
      {/if}
      {#if isLong && !expanded}
        <span class="fade-tail" aria-hidden="true"></span>
      {/if}
    </div>
    {#if isLong && !expanded}
      <button class="show-more" on:click={() => (expanded = true)}>show more</button>
    {:else if isLong}
      <button class="show-more" on:click={() => (expanded = false)}>show less</button>
    {/if}
    <QuotedNotePreview ids={quotedNoteReferences.map((reference) => reference.id)} />
    {#if socialEmbeds.length}
      <div class="social-embed-list">
        {#each socialEmbeds as embed (embed.url)}
          <div class="social-embed" class:portrait={embed.aspect === 'portrait'} class:square={embed.aspect === 'square'}>
            <iframe
              use:pauseWhenHidden={{ resetIframe: shouldResetHiddenEmbed(embed.provider) }}
              src={embed.embedUrl}
              title={embed.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
            <a href={embed.url} target="_blank" rel="noreferrer">{embed.title}</a>
          </div>
        {/each}
      </div>
    {/if}
    {#if mediaAttachments.length}
      <div class="media-grid" class:single={mediaAttachments.length === 1} class:double={mediaAttachments.length === 2} class:triple={mediaAttachments.length === 3} class:quad={mediaAttachments.length >= 4}>
        {#each mediaAttachments as media}
          {#if media.type === 'video'}
            <VideoAttachment src={media.url} poster={media.poster} title={media.alt} />
          {:else}
            <button class="media-image-button" on:click={() => (openImage = { url: media.url, alt: media.alt })} aria-label="Open image">
              <img src={media.url} alt={media.alt ?? ''} loading="lazy" referrerpolicy="no-referrer" />
            </button>
          {/if}
        {/each}
      </div>
    {/if}
    {#if embedded}
      <a class="embed-open-link" href={appPath(`/thread/${event.id}?feed=global`)} target="_blank" rel="noreferrer">View on Nostr</a>
    {:else}
      <div class="note-actions">
        <button aria-label="Reply" on:click={() => startReply(displayEvent)}><MessageCircle size={18} /><span>{counts.replies}</span></button>
        <span class="repost-action" bind:this={repostMenuElement}>
          <button class:reposted aria-label={reposted ? 'Repost options' : 'Repost'} aria-pressed={reposted} aria-expanded={repostMenuOpen} on:click|stopPropagation={() => (repostMenuOpen = !repostMenuOpen)}><Repeat2 size={18} /><span>{counts.reposts}</span></button>
          {#if repostMenuOpen}
            <div class="repost-popover" role="menu">
              <button type="button" role="menuitem" on:click|stopPropagation={quoteNoteAction}>Quote</button>
              <button type="button" role="menuitem" on:click|stopPropagation={() => void repostNoteAction()}>{reposted ? 'Undo repost' : 'Repost'}</button>
            </div>
          {/if}
        </span>
        <span class="like-action">
          <button class:liked disabled={liking} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked} on:click={() => void likeNoteAction()}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button>
          <button class="reaction-count" aria-label="Show likes" aria-expanded={likePopoverOpen} on:click={toggleLikePopover}>{counts.likes}</button>
          {#if likePopoverOpen}
            <div class="reaction-popover">
              <strong>Liked by</strong>
              {#if loadingLikeAuthors}
                <span>Loading</span>
              {:else if likeAuthors.length}
                {#each likeAuthors as pubkey}
                  <a href={appPath(`/profile/${pubkey}`)}>{profileName(pubkey)}</a>
                {/each}
              {:else}
                <span>No likes found yet</span>
              {/if}
            </div>
          {/if}
        </span>
        <button class="zap-action" aria-label="Zap" title={zapTitle} disabled={!canZap} on:click={openZapDialog}><Zap size={17} /><span>{formatZapTotal(counts.zapSats, counts.zaps)}</span></button>
        <button class="report-action" aria-label="Report" on:click={() => (reportDialogOpen = true)}><Flag size={17} /></button>
      </div>
    {/if}
  </div>
</article>

{#if reportDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !reporting && (reportDialogOpen = false)}>
    <div class="dialog-panel compact report-dialog" role="dialog" aria-modal="true" aria-labelledby={`report-title-${event.id}`}>
      <div class="dialog-head">
        <h2 id={`report-title-${event.id}`}>Report post</h2>
      </div>
      <p>Are you sure you want to report this post?</p>
      {#if reportError}<p class="error">{reportError}</p>{/if}
      <div class="dialog-actions">
        <button disabled={reporting} on:click={() => (reportDialogOpen = false)}>Cancel</button>
        <button class="danger-button" disabled={reporting} on:click={confirmReport}><Flag size={17} /> {reporting ? 'Reporting' : 'Report'}</button>
      </div>
    </div>
  </div>
{/if}

{#if deleteDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !deleting && (deleteDialogOpen = false)}>
    <div class="dialog-panel compact report-dialog" role="dialog" aria-modal="true" aria-labelledby={`delete-title-${event.id}`}>
      <div class="dialog-head">
        <h2 id={`delete-title-${event.id}`}>Delete post</h2>
      </div>
      <p>Delete this post from your profile and publish a deletion request to relays?</p>
      {#if deleteError}<p class="error">{deleteError}</p>{/if}
      <div class="dialog-actions">
        <button disabled={deleting} on:click={() => (deleteDialogOpen = false)}>Cancel</button>
        <button class="danger-button" disabled={deleting} on:click={confirmDelete}><Trash2 size={17} /> {deleting ? 'Deleting' : 'Delete'}</button>
      </div>
    </div>
  </div>
{/if}

{#if zapDialogOpen && zapInfo}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !zapLoading && (zapDialogOpen = false)}>
    <div class="dialog-panel compact zap-dialog" role="dialog" aria-modal="true" aria-labelledby={`zap-title-${event.id}`}>
      <div class="dialog-head">
        <h2 id={`zap-title-${event.id}`}>Zap post</h2>
        <button class="icon-button small" aria-label="Close zap dialog" disabled={zapLoading} on:click={() => (zapDialogOpen = false)}>×</button>
      </div>
      <label for={`zap-amount-${event.id}`}>Amount in sats</label>
      <div class="zap-amount-row">
        <input id={`zap-amount-${event.id}`} inputmode="numeric" min="1" type="number" bind:value={zapAmount} />
        <button disabled={zapLoading} on:click={generateZapInvoice}><Zap size={17} /> {zapLoading ? 'Creating' : 'Create'}</button>
      </div>
      <p class="zap-limits">Min {Math.ceil(zapInfo.minSendable / 1000)} sats · max {Math.floor(zapInfo.maxSendable / 1000)} sats</p>
      {#if zapError}<p class="error">{zapError}</p>{/if}
      {#if zapQr}
        <a class="zap-qr" href={lightningHref(zapInvoice)} aria-label="Open invoice in lightning wallet" on:click|preventDefault={openLightningIntent}>
          <img src={zapQr} alt="Lightning invoice QR" />
        </a>
        {#if zapPaid}<p class="success">Payment received.</p>{/if}
        <div class="dialog-actions zap-actions">
          <button on:click={copyZapInvoice}>{zapCopied ? 'Copied' : 'Copy'}</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if openImage}
  <ImageViewer url={openImage.url} alt={openImage.alt ?? ''} referrerpolicy="no-referrer" on:close={() => (openImage = null)} />
{/if}
