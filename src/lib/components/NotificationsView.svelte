<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Heart, MessageCircle, RefreshCw, Repeat2, UserPlus, UserRound } from '@lucide/svelte';
  import { events, loadingNotifications, loginDialogOpen, markNotificationsSeen, mergeEvents, notifications, profiles, refreshNotifications, session } from '$lib/stores/app';
  import { appPath } from '$lib/paths';
  import type { NotificationItem, Profile } from '$lib/nostr/types';

  function actorName(profile?: Profile, pubkey = '') {
    return profile?.display_name || profile?.name || `${pubkey.slice(0, 10)}...`;
  }

  function iconFor(type: NotificationItem['type']) {
    if (type === 'reply' || type === 'mention') return MessageCircle;
    if (type === 'like') return Heart;
    if (type === 'repost') return Repeat2;
    return UserPlus;
  }

  function notificationLabel(item: NotificationItem) {
    if (item.type === 'reply') return 'replied to you';
    if (item.type === 'mention') return 'mentioned you';
    if (item.type === 'like') return 'liked your note';
    if (item.type === 'repost') return 'reposted your note';
    return 'followed you';
  }

  function previewText(item: NotificationItem) {
    const content = item.type === 'reply' || item.type === 'mention' ? item.event.content : item.targetEvent?.content || '';
    const firstLine = content
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (!firstLine) return '';
    const compact = firstLine.replace(/\s+/g, ' ');
    return compact.length > 86 ? `${compact.slice(0, 86).trimEnd()}...` : compact;
  }

  function openNotification(item: NotificationItem) {
    if (item.type === 'follow') void goto(appPath(`/profile/${item.actor}`));
    else {
      events.update((existing) => mergeEvents([item.event, ...(item.targetEvent ? [item.targetEvent] : [])], existing));
      const targetId = item.targetId || item.event.id;
      const focus = item.type === 'reply' && targetId !== item.event.id ? `?focus=${item.event.id}` : '';
      void goto(appPath(`/thread/${targetId}${focus}`));
    }
  }

  onMount(() => {
    markNotificationsSeen();
  });

  $: if ($session && $notifications.length) markNotificationsSeen();
</script>

<section class="notifications-view">
  <header class="messages-head">
    <div>
      <h1>Notifications</h1>
      <p>Replies, mentions, reactions, reposts, and new follows.</p>
    </div>
    <button disabled={!$session || $loadingNotifications} on:click={() => refreshNotifications()}>
      <RefreshCw size={18} class={$loadingNotifications ? 'spin' : ''} /> Refresh
    </button>
  </header>

  {#if !$session}
    <section class="panel message-empty">
      <UserRound size={26} />
      <strong>Sign in to see notifications</strong>
      <span>Notifications are built from relay events for your public key.</span>
      <button class="primary" on:click={() => loginDialogOpen.set(true)}>Sign in</button>
    </section>
  {:else if $loadingNotifications && !$notifications.length}
    <div class="empty-state"><span>Checking relays for notifications</span></div>
  {:else if $notifications.length}
    <div class="notification-list">
      {#each $notifications as item (item.id)}
        {@const actor = $profiles[item.actor]}
        {@const Icon = iconFor(item.type)}
        <article class="notification-item">
          <button class="notification-summary" on:click={() => openNotification(item)}>
            <span class="notification-avatar">
              {#if actor?.picture}
                <img src={actor.picture} alt="" loading="lazy" />
              {:else}
                <span>{actorName(actor, item.event.pubkey).slice(0, 1).toUpperCase()}</span>
              {/if}
              <span class="notification-badge"><Icon size={13} /></span>
            </span>
            <span class="notification-copy">
              <span class="notification-line">
                <strong>{actorName(actor, item.actor)}</strong>
                <span>{notificationLabel(item)}</span>
              </span>
              {#if previewText(item)}
                <span class="notification-preview">{previewText(item)}</span>
              {/if}
            </span>
          </button>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <strong>No notifications yet</strong>
      <span>Relays did not return replies, mentions, likes, reposts, or follows.</span>
    </div>
  {/if}
</section>
