<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ArrowLeft, Image as ImageIcon, Loader2, MessageSquareText, RefreshCw, Send, UserPlus } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import {
    activeMessagePeer,
    directMessages,
    follows,
    loadingMessages,
    loginDialogOpen,
    profiles,
    refreshMessages,
    resolveMessageRecipient,
    selectMessagePeer,
    sendDirectMessage,
    session
  } from '$lib/stores/app';
  import { extractMediaAttachments, extractQuotedNoteReferences, parseNoteText } from '$lib/nostr/media';
  import type { DirectMessage, MediaAttachment, NostrEvent, Profile } from '$lib/nostr/types';
  import QuotedNotePreview from './QuotedNotePreview.svelte';

  let recipientInput = '';
  let messageText = '';
  let resolving = false;
  let sending = false;
  let error = '';
  let chatScroll: HTMLDivElement;
  let openImage: { url: string; alt?: string } | null = null;

  $: conversations = groupMessages($directMessages);
  $: activePeer = $activeMessagePeer;
  $: activeMessages = activePeer ? [...($directMessages.filter((message) => message.peer === activePeer))].sort((a, b) => a.created_at - b.created_at) : [];
  $: followChoices = $follows.map((pubkey) => ({ pubkey, label: profileName(pubkey, $profiles[pubkey]) })).sort((a, b) => a.label.localeCompare(b.label));
  $: activeProfile = activePeer ? $profiles[activePeer] : undefined;

  onMount(() => {
    void refreshMessages();
  });

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
    if (!recipientInput.trim()) return;
    resolving = true;
    error = '';
    try {
      const pubkey = await resolveMessageRecipient(recipientInput);
      recipientInput = profileName(pubkey, $profiles[pubkey]);
      await tick();
      chatScroll?.scrollTo({ top: chatScroll.scrollHeight });
    } catch (exception) {
      error = exception instanceof Error ? exception.message : 'Could not resolve that recipient.';
    } finally {
      resolving = false;
    }
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

  async function scrollChatToBottom() {
    await tick();
    chatScroll?.scrollTo({ top: chatScroll.scrollHeight });
  }

  function chooseFollow(event: Event) {
    const pubkey = (event.currentTarget as HTMLSelectElement).value;
    if (!pubkey) return;
    selectMessagePeer(pubkey);
    recipientInput = profileName(pubkey, $profiles[pubkey]);
  }

  function profileName(pubkey: string, profile?: Profile) {
    return profile?.display_name || profile?.name || shortNpub(pubkey);
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
</script>

<section class="messages-view">
  <header class="messages-head">
    <div>
      <h1>Messages</h1>
      <p>NIP-17 private chats, with legacy NIP-04 messages shown when they can be decrypted.</p>
    </div>
    <button disabled={!$session || $loadingMessages} on:click={() => refreshMessages()}>
      <RefreshCw size={18} class={$loadingMessages ? 'spin' : ''} /> Refresh
    </button>
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
          <div class="dm-inbox-controls">
            <form class="dm-recipient-form" on:submit|preventDefault={startConversation}>
              <label>
                <input bind:value={recipientInput} placeholder="npub or name@example.com" autocomplete="off" />
              </label>
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

          <div class="conversation-list" aria-label="Direct message conversations">
            {#each conversations as conversation}
              <button class="conversation-row" on:click={() => selectMessagePeer(conversation.peer)}>
                <span class="avatar">
                  {#if $profiles[conversation.peer]?.picture}
                    <img src={$profiles[conversation.peer].picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
                  {:else}
                    <span>{avatarLetter(conversation.peer, $profiles[conversation.peer])}</span>
                  {/if}
                </span>
                <span>
                  <strong>{profileName(conversation.peer, $profiles[conversation.peer])}</strong>
                  <small>{conversation.latest.content || `${conversation.latest.protocol} encrypted message`}</small>
                </span>
                <em>{conversation.messages.length}</em>
              </button>
            {:else}
              <div class="dm-empty-list">No conversations yet</div>
            {/each}
          </div>
        </section>
      {:else}
        <section class="dm-chat" aria-label="Conversation">
          <header class="dm-chat-head">
            <button class="dm-back" aria-label="Back to messages" on:click={() => selectMessagePeer('')}>
              <ArrowLeft size={18} />
            </button>
            <span class="avatar">
              {#if activeProfile?.picture}
                <img src={activeProfile.picture} alt="" loading="lazy" referrerpolicy="no-referrer" />
              {:else}
                <span>{avatarLetter(activePeer, activeProfile)}</span>
              {/if}
            </span>
            <div>
              <strong>{profileName(activePeer, activeProfile)}</strong>
              <span>{shortNpub(activePeer)}</span>
            </div>
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
                          <!-- svelte-ignore a11y_media_has_caption -->
                          <video src={item.url} controls preload="metadata" playsinline title={item.alt}></video>
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
            <textarea bind:value={messageText} placeholder="Write a message" rows="2"></textarea>
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

{#if openImage}
  <div class="dialog-backdrop image-viewer-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && (openImage = null)}>
    <button class="image-viewer" on:click={() => (openImage = null)} aria-label="Close image">
      <img src={openImage.url} alt={openImage.alt ?? ''} />
    </button>
  </div>
{/if}
