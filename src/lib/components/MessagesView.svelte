<script lang="ts">
  import { onMount } from 'svelte';
  import { LockKeyhole, MessageSquareText, RefreshCw, Sparkles } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import { directMessages, loadingMessages, loginDialogOpen, refreshMessages, session } from '$lib/stores/app';

  const protocols = [
    { label: 'NIP-04', detail: 'Legacy DMs; can leak metadata', icon: LockKeyhole },
    { label: 'NIP-17', detail: 'Modern private DMs', icon: Sparkles }
  ];

  $: conversations = groupMessages($directMessages);

  onMount(() => {
    void refreshMessages();
  });

  function groupMessages(messages: typeof $directMessages) {
    const byPeer = new Map<string, typeof messages>();
    for (const message of messages) {
      if (!message.peer) continue;
      byPeer.set(message.peer, [...(byPeer.get(message.peer) ?? []), message]);
    }
    return [...byPeer.entries()]
      .map(([peer, items]) => ({
        peer,
        messages: items.sort((a, b) => b.created_at - a.created_at),
        latest: items.sort((a, b) => b.created_at - a.created_at)[0]
      }))
      .sort((a, b) => b.latest.created_at - a.latest.created_at);
  }

  function shortNpub(pubkey: string) {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
    } catch {
      return pubkey.slice(0, 12);
    }
  }
</script>

<section class="messages-view">
  <header class="messages-head">
    <div>
      <h1>Messages</h1>
      <p class="messages-chat-link">For a dedicated chat client included private groups use <a href="https://chat.nostr.com" target="_blank" rel="noreferrer">chat.nostr.com</a>.</p>
    </div>
    <button disabled={!$session || $loadingMessages} on:click={() => refreshMessages()}>
      <RefreshCw size={18} class={$loadingMessages ? 'spin' : ''} /> Refresh
    </button>
  </header>

  <div class="protocol-grid">
    {#each protocols as protocol}
      <div class="protocol-chip">
        <svelte:component this={protocol.icon} size={18} />
        <strong>{protocol.label}</strong>
        <span>{protocol.detail}</span>
      </div>
    {/each}
  </div>

  {#if !$session}
    <section class="panel message-empty">
      <MessageSquareText size={26} />
      <strong>Sign in to read messages</strong>
      <span>Direct messages need your signer or local key so encrypted payloads can be handled on-device.</span>
      <button class="primary" on:click={() => loginDialogOpen.set(true)}>Sign in</button>
    </section>
  {:else if conversations.length}
    <section class="conversation-list" aria-label="Direct message conversations">
      {#each conversations as conversation}
        <article class="conversation-row">
          <div class="avatar"><span>{shortNpub(conversation.peer).slice(0, 1).toUpperCase()}</span></div>
          <div>
            <strong>{shortNpub(conversation.peer)}</strong>
            <p>{conversation.latest.content || `${conversation.latest.protocol} encrypted message`}</p>
          </div>
          <span>{conversation.messages.length}</span>
        </article>
      {/each}
    </section>
  {:else}
    <section class="panel message-empty">
      <MessageSquareText size={26} />
      <strong>No direct messages found</strong>
      <span>NIP-04 and NIP-17 messages will appear here when relays return conversations for this key.</span>
    </section>
  {/if}
</section>
