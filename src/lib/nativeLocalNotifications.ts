import { browser } from '$app/environment';
import type { NotificationItem, Profile } from '$lib/nostr/types';

const channelId = 'nostr-activity';
const groupId = 'nostr-activity';
const recentNotificationMemoryMs = 5 * 60 * 1000;
const recentNotificationIds = new Map<string, number>();

let listenersReady = false;
let permissionReady = false;
let nativeNotificationsAvailable: boolean | undefined;
let desktopNotificationsAvailable: boolean | undefined;

export async function setupNativeLocalNotifications(openRoute: (route: string) => void) {
  if (!browser || listenersReady) return;

  const platform = await nativePlatform();
  if (!platform && !(await desktopNotificationsSupported())) return;
  listenersReady = true;

  if (!platform) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await ensureNotificationChannel();
  await ensureNotificationPermission();
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = routeFromNotificationExtra(action.notification.extra);
    if (route) openRoute(route);
  });
}

export async function showNativeNotificationForItem(item: NotificationItem, profile?: Profile) {
  if (!browser) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if (recentlyDisplayed(item.id)) return;

  if (!(await nativePlatform())) {
    await showDesktopNotificationForItem(item, profile);
    return;
  }

  if (!(await ensureNotificationPermission())) return;

  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await ensureNotificationChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationNumericId(item.id),
        title: notificationTitle(item, profile),
        body: notificationBody(item),
        largeBody: notificationBody(item),
        channelId,
        group: groupId,
        autoCancel: true,
        extra: { route: notificationRoute(item), notificationId: item.id }
      }
    ]
  });
}

async function ensureNotificationPermission() {
  if (permissionReady) return true;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions();
  permissionReady = permission.display === 'granted';
  return permissionReady;
}

async function ensureNotificationChannel() {
  const platform = await nativePlatform();
  if (platform !== 'android') return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.createChannel({
    id: channelId,
    name: 'Nostr activity',
    description: 'Replies, mentions, reactions, reposts, and follows',
    importance: 4,
    visibility: 0
  }).catch(() => undefined);
}

async function nativePlatform() {
  if (nativeNotificationsAvailable === false) return '';
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      nativeNotificationsAvailable = false;
      return '';
    }
    nativeNotificationsAvailable = true;
    return Capacitor.getPlatform();
  } catch {
    nativeNotificationsAvailable = false;
    return '';
  }
}

function notificationTitle(item: NotificationItem, profile?: Profile) {
  const actor = actorName(profile, item.actor);
  if (item.type === 'reply') return `${actor} replied to you`;
  if (item.type === 'mention') return `${actor} mentioned you`;
  if (item.type === 'like') return `${actor} liked your note`;
  return `${actor} reposted your note`;
}

function notificationBody(item: NotificationItem) {
  const content = item.type === 'reply' || item.type === 'mention' ? item.event.content : item.targetEvent?.content || '';
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return 'Open Nostr to view the activity.';
  const compact = firstLine.replace(/\s+/g, ' ');
  return compact.length > 110 ? `${compact.slice(0, 110).trimEnd()}...` : compact;
}

async function showDesktopNotificationForItem(item: NotificationItem, profile?: Profile) {
  if (!(await desktopNotificationsSupported())) return;
  await window.nostrDesktopNotifications?.show({
    title: notificationTitle(item, profile),
    body: notificationBody(item),
    route: notificationRoute(item)
  });
}

async function desktopNotificationsSupported() {
  if (desktopNotificationsAvailable !== undefined) return desktopNotificationsAvailable;
  desktopNotificationsAvailable = Boolean(await window.nostrDesktopNotifications?.isAvailable().catch(() => false));
  return desktopNotificationsAvailable;
}

function notificationRoute(item: NotificationItem) {
  const targetId = item.targetId || item.event.id;
  const focus = item.type === 'reply' && targetId !== item.event.id ? `?focus=${item.event.id}` : '';
  return `/thread/${targetId}${focus}`;
}

function actorName(profile: Profile | undefined, pubkey: string) {
  return profile?.display_name || profile?.name || `${pubkey.slice(0, 10)}...`;
}

function routeFromNotificationExtra(extra: unknown) {
  if (!extra || typeof extra !== 'object') return '';
  const route = (extra as { route?: unknown }).route;
  return typeof route === 'string' && route.startsWith('/') ? route : '';
}

function recentlyDisplayed(id: string) {
  const now = Date.now();
  for (const [key, timestamp] of recentNotificationIds) {
    if (now - timestamp > recentNotificationMemoryMs) recentNotificationIds.delete(key);
  }
  if (recentNotificationIds.has(id)) return true;
  recentNotificationIds.set(id, now);
  return false;
}

function notificationNumericId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}
