<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { ArrowLeft, ExternalLink, Image as ImageIcon, Loader2, MessageSquareText, Plus, Send, UserPlus } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import {
    activeMessagePeer,
    directMessages,
    follows,
    loadingMessages,
    loginDialogOpen,
    markMessagesSeen,
    mergeProfileRecords,
    profiles,
    relays,
    refreshMessages,
    resolveMessageRecipient,
    selectMessagePeer,
    sendDirectMessage,
    session
  } from '$lib/stores/app';
  import { searchProfiles } from '$lib/nostr/client';
  import { shouldSubmitTextareaOnEnter } from '$lib/keyboard';
  import { extractMediaAttachments, extractQuotedNoteReferences, parseNoteText } from '$lib/nostr/media';
  import { appPath } from '$lib/paths';
  import { findOrCreatePomegranateConnection } from '$lib/nostr/pomegranateAuth';
  import type { DirectMessage, MediaAttachment, NostrEvent, Profile } from '$lib/nostr/types';
  import ImageViewer from './ImageViewer.svelte';
  import QuotedNotePreview from './QuotedNotePreview.svelte';
  import VideoAttachment from './VideoAttachment.svelte';

  const nostrChatUrl = 'https://chat.nostr.com';
  const nostrChatConnectionName = 'chat.nostr.com';

  let recipientInput = '';
  let messageText = '';
  let resolving = false;
  let sending = false;
  let error = '';
  let chatScroll: HTMLDivElement;
  let openImage: { url: string; alt?: string } | null = null;
  let remoteProfiles: Profile[] = [];
  let searchingProfiles = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let chatLoginDialogOpen = false;
  let openingNostrChat = false;
  let nostrChatError = '';
  let newDmDialogOpen = false;
  let activeDmTab: 'known' | 'requests' = 'known';

  $: conversations = groupMessages($directMessages);
  $: knownConversations = conversations.filter((conversation) => $follows.includes(conversation.peer));
  $: requestConversations = conversations.filter((conversation) => !$follows.includes(conversation.peer));
  $: visibleConversations = activeDmTab === 'known' ? knownConversations : requestConversations;
  $: activePeer = $activeMessagePeer;
  $: activeMessages = activePeer ? [...($directMessages.filter((message) => message.peer === activePeer))].sort((a, b) => a.created_at - b.created_at) : [];
  $: followChoices = $follows.map((pubkey) => ({ pubkey, label: profileName(pubkey, $profiles[pubkey]) })).sort((a, b) => a.label.localeCompare(b.label));
  $: activeProfile = activePeer ? $profiles[activePeer] : undefined;
  $: cleanRecipientInput = recipientInput.trim();
  $: localProfiles = profileSuggestions(cleanRecipientInput, Object.values($profiles));
  $: recipientSuggestions = mergeProfiles(localProfiles, remoteProfiles).slice(0, 6);

  onMount(() => {
    markMessagesSeen();
    void refreshMessages();
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
  });

  $: if ($session && $directMessages.length) markMessagesSeen();

  $: if (activeMessages.length) void scrollChatToBottom();

  function groupMessages(messages: DirectMessage[]) {
    const byPeer = new Map<string, DirectMessage[]>();
    for (const message of messages) {
      if (!message.peer) continue;
      byPeer.set(message.peer, [...(byPeer.get(message.peer) ?? []), message]);
    }
    return [...byPeer.entries()]
      .map(([peer, items]) => {
        const sorted = items.sort((a, b) => b.created_at - a.created_at);
        return { peer, messages: sorted, latest: sorted[0] };
      })
      .sort((a, b) => b.latest.created_at - a.latest.created_at);
  }

  async function startConversation() {
    if (!cleanRecipientInput) return;
    resolving = true;
    error = '';
    try {
      const pubkey = await resolveMessageRecipient(cleanRecipientInput).catch((exception) => {
        if (recipientSuggestions[0]) return recipientSuggestions[0].pubkey;
        throw exception;
      });
      selectMessagePeer(pubkey);
      recipientInput = profileName(pubkey, $profiles[pubkey]);
      newDmDialogOpen = false;
      remoteProfiles = [];
      await tick();
      chatScroll?.scrollTo({ top: chatScroll.scrollHeight });
    } catch (exception) {
      error = exception instanceof Error ? exception.message : 'Could not find that profile.';
    } finally {
      resolving = false;
    }
  }

  function scheduleProfileSearch() {
    clearTimeout(searchTimer);
    remoteProfiles = [];
    if (cleanRecipientInput.replace(/^@/, '').length < 2) return;
    searchTimer = setTimeout(() => void runProfileSearch(cleanRecipientInput), 260);
  }

  async function runProfileSearch(value: string) {
    searchingProfiles = true;
    try {
      const found = await searchProfiles(value, $relays).catch(() => []);
      if (value === cleanRecipientInput) {
        remoteProfiles = found;
        if (found.length) profiles.update((existing) => mergeProfileRecords(existing, found));
      }
    } finally {
      searchingProfiles = false;
    }
  }

  function chooseProfile(profile: Profile) {
    selectMessagePeer(profile.pubkey);
    recipientInput = profileName(profile.pubkey, profile);
    newDmDialogOpen = false;
    remoteProfiles = [];
    clearTimeout(searchTimer);
  }

  function openNewDmDialog() {
    recipientInput = '';
    remoteProfiles = [];
    error = '';
    newDmDialogOpen = true;
  }

  function closeNewDmDialog() {
    if (resolving) return;
    newDmDialogOpen = false;
    recipientInput = '';
    remoteProfiles = [];
    clearTimeout(searchTimer);
  }

  async function sendMessage() {
    if (!activePeer || !messageText.trim()) return;
    sending = true;
    error = '';
    try {
      await sendDirectMessage(activePeer, messageText);
      messageText = '';
      await scrollChatToBottom();
    } catch (exception) {
      error = exception instanceof Error ? exception.message : 'Could not send that message.';
    } finally {
      sending = false;
    }
  }

  function sendMessageOnEnter(event: KeyboardEvent) {
    if (!shouldSubmitTextareaOnEnter(event)) return;
    event.preventDefault();
    void sendMessage();
  }

  async function scrollChatToBottom() {
    await tick();
    chatScroll?.scrollTo({ top: chatScroll.scrollHeight });
  }

  function chooseFollow(event: Event) {
    const pubkey = (event.currentTarget as HTMLSelectElement).value;
    if (!pubkey) return;
    selectMessagePeer(pubkey);
    recipientInput = profileName(pubkey, $profiles[pubkey]);
    newDmDialogOpen = false;
  }

  function profileName(pubkey: string, profile?: Profile) {
    return profile?.display_name || profile?.name || shortNpub(pubkey);
  }

  function profileSubline(profile: Profile) {
    return profile.nip05 || shortNpub(profile.pubkey);
  }

  function profileSuggestions(value: string, items: Profile[]) {
    const needle = value.trim().replace(/^@/, '').toLowerCase();
    if (needle.length < 2) return [];
    return items
      .filter((profile) => profileMatches(profile, needle))
      .sort((a, b) => profileName(a.pubkey, a).localeCompare(profileName(b.pubkey, b)));
  }

  function profileMatches(profile: Profile, needle: string) {
    return [profile.name, profile.display_name, profile.nip05, profile.pubkey].filter(isString).some((value) => value.toLowerCase().includes(needle));
  }

  function mergeProfiles(first: Profile[], second: Profile[]) {
    const byPubkey = new Map<string, Profile>();
    [...first, ...second].forEach((profile) => byPubkey.set(profile.pubkey, profile));
    return [...byPubkey.values()];
  }

  function isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function shortNpub(pubkey: string) {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return pubkey.slice(0, 12);
    }
  }

  function avatarLetter(pubkey: string, profile?: Profile) {
    return profileName(pubkey, profile).slice(0, 1).toUpperCase();
  }

  function conversationPreview(message: DirectMessage) {
    const content = (message.content || `${message.protocol} encrypted message`).replace(/\s+/g, ' ').trim();
    return content || `${message.protocol} encrypted message`;
  }

  function conversationTime(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const ageMs = now.getTime() - date.getTime();
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    if (ageMs < minuteMs) return 'now';
    if (ageMs < hourMs) return `${Math.max(1, Math.floor(ageMs / minuteMs))}m`;
    if (ageMs < dayMs) return `${Math.floor(ageMs / hourMs)}h`;
    if (ageMs < 7 * dayMs) return `${Math.floor(ageMs / dayMs)}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function messageMedia(message: DirectMessage) {
    return extractMediaAttachments(messageAsEvent(message));
  }

  function messageParts(message: DirectMessage, media: MediaAttachment[]) {
    const quotes = messageQuotes(message);
    return parseNoteText(message.content ?? '', [...media.map((item) => item.url), ...quotes.map((quote) => quote.raw)]);
  }

  function messageQuotes(message: DirectMessage) {
    return extractQuotedNoteReferences(message.content ?? '');
  }

  function messageAsEvent(message: DirectMessage): NostrEvent {
    return {
      id: message.id,
      pubkey: message.from,
      created_at: message.created_at,
      kind: 14,
      tags: [],
      content: message.content ?? ''
    };
  }

  function handleNostrChatClick(event: MouseEvent) {
    if ($session?.mode !== 'pomegranate') return;
    event.preventDefault();
    nostrChatError = '';
    chatLoginDialogOpen = true;
  }

  async function openNostrChatWithPomegranate() {
    openingNostrChat = true;
    nostrChatError = '';
    try {
      const connection = await findOrCreatePomegranateConnection(nostrChatConnectionName);
      openNostrChatLogin(connection.bunker);
      chatLoginDialogOpen = false;
    } catch (exception) {
      nostrChatError = exception instanceof Error ? exception.message : 'Could not connect to Nostr Chat.';
    } finally {
      openingNostrChat = false;
    }
  }

  function openNostrChatNormally() {
    chatLoginDialogOpen = false;
    nostrChatError = '';
    window.open(nostrChatUrl, '_blank', 'noopener,noreferrer');
  }

  function openNostrChatLogin(bunker: string) {
    window.open(nostrChatLoginUrl(bunker), '_blank', 'noopener,noreferrer');
  }

  function nostrChatLoginUrl(bunker: string) {
    return `${nostrChatUrl}/#/login?bunker=${encodeURIComponent(bunker)}`;
  }
</script>

<section class="messages-view">
  <header class="messages-head">
    <div>
      <h1>Messages</h1>
      <p class="messages-chat-link">
        For a dedicated DM client checkout
        <a href={nostrChatUrl} target="_blank" rel="noreferrer" on:click={handleNostrChatClick} aria-busy={openingNostrChat}>
          chat.nostr.com <ExternalLink size={14} />
        </a>
      </p>
    </div>
  </header>

  {#if !$session}
    <section class="panel message-empty">
      <MessageSquareText size={26} />
      <strong>Sign in to read messages</strong>
      <span>Direct messages need your signer or local key so encrypted payloads can be handled on-device.</span>
      <button class="primary" on:click={() => loginDialogOpen.set(true)}>Sign in</button>
    </section>
  {:else}
    <section class="dm-shell" class:chat-open={activePeer} aria-label="Direct messages">
      {#if !activePeer}
        <section class="dm-inbox" aria-label="Message inbox">
          <div class="dm-tabs" role="tablist" aria-label="Message filters">
            <button type="button" class:active={activeDmTab === 'known'} role="tab" aria-selected={activeDmTab === 'known'} on:click={() => (activeDmTab = 'known')}>
              Known
            </button>
            <button type="button" class:active={activeDmTab === 'requests'} role="tab" aria-selected={activeDmTab === 'requests'} on:click={() => (activeDmTab = 'requests')}>
              New Requests
              {#if requestConversations.length}
                <span>{requestConversations.length}</span>
              {/if}
            </button>
          </div>

          <div class="conversation-list" aria-label="Direct message conversations">
            {#each visibleConversations as conversation}
              <button class="conversation-row" on:click={() => selectMessagePeer(conversation.peer)}>
                <span class="avatar">
                  {#if $profiles[conversation.peer]?.picture}
                    <img src={$profiles[conversation.peer].picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
                  {:else}
                    <span>{avatarLetter(conversation.peer, $profiles[conversation.peer])}</span>
                  {/if}
                </span>
                <span class="conversation-copy">
                  <strong>{profileName(conversation.peer, $profiles[conversation.peer])}</strong>
                  <small>{conversationPreview(conversation.latest)}</small>
                </span>
                <span class="conversation-meta">
                  <time datetime={new Date(conversation.latest.created_at * 1000).toISOString()}>{conversationTime(conversation.latest.created_at)}</time>
                  {#if conversation.messages.length > 1}
                    <em>{conversation.messages.length}</em>
                  {/if}
                </span>
              </button>
            {:else}
              <div class="dm-empty-list">
                {#if activeDmTab === 'known'}No known conversations yet{:else}No new requests{/if}
              </div>
            {/each}
          </div>
          <button class="fab dm-new-fab" type="button" aria-label="New direct message" on:click={openNewDmDialog}>
            <Plus size={30} />
          </button>
        </section>
      {:else}
        <section class="dm-chat" aria-label="Conversation">
          <header class="dm-chat-head">
            <button class="dm-back" aria-label="Back to messages" on:click={() => selectMessagePeer('')}>
              <ArrowLeft size={18} />
            </button>
            <a class="dm-chat-profile" href={appPath(`/profile/${activePeer}`)} aria-label={`${profileName(activePeer, activeProfile)} profile`}>
              <span class="avatar">
                {#if activeProfile?.picture}
                  <img src={activeProfile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
                {:else}
                  <span>{avatarLetter(activePeer, activeProfile)}</span>
                {/if}
              </span>
              <span>
                <strong>{profileName(activePeer, activeProfile)}</strong>
                <span>{shortNpub(activePeer)}</span>
              </span>
            </a>
          </header>

          <div class="dm-messages" bind:this={chatScroll}>
            {#each activeMessages as message (message.id)}
              {@const mine = message.from === $session?.pubkey}
              {@const media = messageMedia(message)}
              {@const quotes = messageQuotes(message)}
              <article class="dm-message" class:mine class:theirs={!mine}>
                <div class="dm-bubble">
                  {#if message.content}
                    <p>
                      {#each messageParts(message, media) as part}
                        {#if part.type === 'link'}
                          <a href={part.href} target="_blank" rel="noreferrer">{part.value}</a>
                        {:else if part.type === 'nostr' || part.type === 'mention'}
                          <a href={part.href}>{part.value}</a>
                        {:else if part.type === 'hashtag'}
                          <span>#{part.value}</span>
                        {:else}
                          {part.value}
                        {/if}
                      {/each}
                    </p>
                  {:else}
                    <p class="muted-copy">{message.protocol} encrypted message</p>
                  {/if}

                  <QuotedNotePreview ids={quotes.map((quote) => quote.id)} compact />

                  {#if media.length}
                    <div class="dm-media-grid">
                      {#each media as item}
                        {#if item.type === 'video'}
                          <VideoAttachment src={item.url} poster={item.poster} title={item.alt} />
                        {:else}
                          <button type="button" on:click={() => (openImage = { url: item.url, alt: item.alt })} aria-label="Open image">
                            <img src={item.url} alt={item.alt ?? ''} loading="lazy" referrerpolicy="no-referrer" />
                          </button>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </article>
            {:else}
              <div class="message-empty compact">
                <ImageIcon size={22} />
                <strong>No messages yet</strong>
                <span>Send the first one.</span>
              </div>
            {/each}
          </div>

          <form class="dm-compose" on:submit|preventDefault={sendMessage}>
            <textarea bind:value={messageText} on:keydown={sendMessageOnEnter} placeholder="Write a message" rows="2"></textarea>
            <button type="submit" disabled={sending || !messageText.trim()}>
              {#if sending}<Loader2 size={18} class="spin" />{:else}<Send size={18} />{/if}
              <span>Send</span>
            </button>
          </form>
        </section>
      {/if}
    </section>

    {#if error}
      <p class="dm-error">{error}</p>
    {/if}
  {/if}
</section>

{#if newDmDialogOpen}
  <div class="dialog-backdrop dm-new-dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && closeNewDmDialog()}>
    <div class="dialog-panel compact dm-new-dialog" role="dialog" aria-modal="true" aria-labelledby="new-dm-title">
      <div class="dialog-head">
        <h2 id="new-dm-title">New message</h2>
        <button class="icon-button" aria-label="Close new message dialog" on:click={closeNewDmDialog}>×</button>
      </div>
      <form class="dm-recipient-form" on:submit|preventDefault={startConversation}>
        <div class="dm-recipient-search">
          <label>
            <input bind:value={recipientInput} on:input={scheduleProfileSearch} placeholder="Search name, npub, or NIP-05" autocomplete="off" />
          </label>
          {#if cleanRecipientInput.length >= 2 && (recipientSuggestions.length || searchingProfiles)}
            <div class="dm-search-results" aria-label="Profile suggestions">
              {#each recipientSuggestions as profile (profile.pubkey)}
                <button type="button" on:click={() => chooseProfile(profile)}>
                  <span class="avatar mini">
                    {#if profile.picture}
                      <img src={profile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
                    {:else}
                      <span>{profileName(profile.pubkey, profile).slice(0, 1).toUpperCase()}</span>
                    {/if}
                  </span>
                  <span>
                    <strong>{profileName(profile.pubkey, profile)}</strong>
                    <small>{profileSubline(profile)}</small>
                  </span>
                </button>
              {/each}
              {#if searchingProfiles}
                <div class="dm-search-empty"><Loader2 size={16} class="spin" /> Searching profiles</div>
              {/if}
            </div>
          {/if}
        </div>
        <button type="submit" disabled={resolving || !recipientInput.trim()}>
          {#if resolving}<Loader2 size={17} class="spin" />{:else}<UserPlus size={17} />{/if}
          Open
        </button>
      </form>

      {#if followChoices.length}
        <label class="dm-follow-picker">
          <span>Follow list</span>
          <select on:change={chooseFollow} value="">
            <option value="">Select someone</option>
            {#each followChoices as follow}
              <option value={follow.pubkey}>{follow.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
  </div>
{/if}

{#if openImage}
  <ImageViewer url={openImage.url} alt={openImage.alt ?? ''} referrerpolicy="no-referrer" on:close={() => (openImage = null)} />
{/if}

{#if chatLoginDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !openingNostrChat && (chatLoginDialogOpen = false)}>
    <div class="dialog-panel compact" role="dialog" aria-modal="true" aria-labelledby="nostr-chat-login-title">
      <div class="dialog-head">
        <h2 id="nostr-chat-login-title">Nostr Chat</h2>
      </div>
      <p>Do you want to login to Nostr Chat with this account?</p>
      {#if nostrChatError}
        <p class="error">{nostrChatError}</p>
      {/if}
      <div class="dialog-actions">
        <button disabled={openingNostrChat} on:click={openNostrChatNormally}>No</button>
        <button class="primary" disabled={openingNostrChat} on:click={() => void openNostrChatWithPomegranate()}>
          {#if openingNostrChat}
            <Loader2 size={17} class="spin" />
          {/if}
          Yes
        </button>
      </div>
    </div>
  </div>
{/if}
