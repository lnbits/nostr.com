<script lang="ts">
  import { browser } from '$app/environment';
  import { tick, onDestroy } from 'svelte';
  import { nip19 } from 'nostr-tools';
  import { ImagePlus, Loader2, Send, Smile, X } from '@lucide/svelte';
  import { composerOpen, editNote, editTarget, mergeProfileRecords, postNote, profiles, quoteTarget, relays, replyTarget, session } from '$lib/stores/app';
  import { shouldSubmitTextareaOnEnter } from '$lib/keyboard';
  import { hasPublishedTextNote, searchProfiles } from '$lib/nostr/client';
  import { uploadToNostrBuild } from '$lib/nostr/upload';
  import type { NostrEvent, Profile } from '$lib/nostr/types';
  import ImageCropDialog from './ImageCropDialog.svelte';
  import MentionSuggestions from './MentionSuggestions.svelte';

  const introductionPrefix = '#nostr #introductions\n\n';
  const mentionSearchDelayMs = 220;
  const croppableImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);
  const emojiOptions = [
    '😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊', '🙂', '🙃', '😉', '😍',
    '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
    '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏',
    '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
    '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
    '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
    '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
    '😞', '😓', '😩', '😫', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
    '💩', '🤡', '👻', '👽', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀',
    '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓',
    '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤',
    '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️',
    '🗨️', '🗯️', '💭', '💤', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
    '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
    '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲',
    '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🧠', '🫀', '🫁', '🦷', '🦴',
    '👀', '👁️', '👅', '👄', '🧑', '👨', '👩', '🧔', '👴', '👵', '🙍', '🙎',
    '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👨‍💻', '👩‍💻', '🧙', '🧚',
    '🧛', '🧜', '🧝', '🧞', '🧟', '🏃', '🚶', '🧘', '🛌', '🌍', '🌎', '🌏',
    '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️',
    '🏛️', '🏗️', '🏘️', '🏠', '🏡', '🏢', '🏬', '🏥', '🏦', '🏨', '🏫', '🏭',
    '🌁', '🌃', '🌆', '🌇', '🌉', '🌌', '🎠', '🎡', '🎢', '🚂', '🚀', '🛸',
    '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️',
    '⛄', '🌬️', '💨', '🌪️', '🌈', '🌂', '☂️', '⚡', '🔥', '💧', '🌊', '🎄',
    '✨', '🎋', '🎍', '🌱', '🌿', '☘️', '🍀', '🎍', '🌵', '🌲', '🌳', '🌴',
    '🪵', '🌾', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌸', '🍄', '🌰', '🪨',
    '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑',
    '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽',
    '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🥜', '🫘', '🌰', '🍞', '🥐',
    '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟',
    '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲',
    '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛',
    '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡',
    '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬',
    '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸',
    '🍹', '🍺', '🍻', '🥂', '🥃', '🧃', '🧉', '🧊', '🥢', '🍽️', '⚽', '🏀',
    '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒',
    '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋',
    '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼',
    '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧗', '🏊', '🚣', '🏄', '🎪', '🎭',
    '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸',
    '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩', '⌚', '📱', '💻',
    '⌨️', '🖥️', '🖨️', '🖱️', '💽', '💾', '💿', '📀', '📷', '📸', '🎥', '📺',
    '📻', '🎙️', '⏰', '⌛', '⏳', '📡', '🔋', '🪫', '🔌', '💡', '🔦', '🕯️',
    '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🧾', '💎',
    '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱',
    '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '🛡️', '🚬', '⚰️', '🪦',
    '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺',
    '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧽', '🧼',
    '🪥', '🪒', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🧸', '🪆',
    '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🪩', '🪅', '📩',
    '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭',
    '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️',
    '📆', '📅', '🗑️', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝',
    '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '❤️‍🔥', '❤️‍🩹', '🏆', '🥇', '🥈', '🥉',
    '₿', '🧡', '⚡', '🤙'
  ];
  let content = '';
  let busy = false;
  let uploading = false;
  let error = '';
  let emojiPickerOpen = false;
  let emojiButtonElement: HTMLElement;
  let emojiPickerElement: HTMLElement;
  let mediaInput: HTMLInputElement;
  let textarea: HTMLTextAreaElement;
  let loadedEditId = '';
  let loadedQuoteId = '';
  let loadedQuoteReference = '';
  let introductionCheckKey = '';
  let showingIntroductionTip = false;
  let mentionQuery = '';
  let mentionStart = -1;
  let mentionEnd = -1;
  let remoteMentionProfiles: Profile[] = [];
  let searchingMentions = false;
  let mentionSearchTimer: ReturnType<typeof setTimeout> | undefined;
  let selectedMentions: Array<{ pubkey: string; label: string; profile?: Profile }> = [];
  let cropFile: File | undefined;
  let textareaTouchY = 0;

  $: mentionSuggestions = mergeMentionProfiles(localMentionSuggestions(mentionQuery), remoteMentionProfiles).slice(0, 6);
  $: orangeCultTag = content.match(/(^|[\s([{])#(600bn|600000000000)\b/i)?.[2];

  $: if ($composerOpen && $editTarget && loadedEditId !== $editTarget.id) {
    content = $editTarget.content;
    loadedEditId = $editTarget.id;
  }
  $: if ($composerOpen && !$editTarget && loadedEditId) {
    loadedEditId = '';
    content = '';
  }
  $: if ($composerOpen && $quoteTarget && !$editTarget && loadedQuoteId !== $quoteTarget.id) {
    loadedQuoteReference = quoteReference($quoteTarget);
    content = content.trim() ? `${content.trimEnd()}\n\n${loadedQuoteReference}` : `\n\n${loadedQuoteReference}`;
    loadedQuoteId = $quoteTarget.id;
    void focusComposerStart();
  }
  $: if (!$quoteTarget) {
    loadedQuoteId = '';
    loadedQuoteReference = '';
  }
  $: if (!$composerOpen) {
    introductionCheckKey = '';
    showingIntroductionTip = false;
    clearMentionSearch();
    selectedMentions = [];
    closeCropper();
    emojiPickerOpen = false;
  }
  $: if ($composerOpen && $session && !$editTarget && !$replyTarget && !$quoteTarget && !content.trim()) {
    void maybePrefillIntroduction();
  }

  onDestroy(() => {
    clearTimeout(mentionSearchTimer);
    if (browser) document.removeEventListener('pointerdown', closeComposerPopupsFromOutside);
  });

  $: if (browser && $composerOpen) syncComposerPopupListener(emojiPickerOpen);

  async function submit() {
    if (busy || uploading || !$session || !content.trim()) return;
    busy = true;
    error = '';
    try {
      const draft = mentionDraft(content.trim());
      const tags = mergeDraftTags(draft.tags, quoteDraftTags(draft.content));
      if ($editTarget) await editNote(draft.content, $editTarget, tags);
      else await postNote(draft.content, $replyTarget ?? undefined, tags);
      content = '';
      selectedMentions = [];
      showingIntroductionTip = false;
      closeComposer();
    } catch (err) {
      error = friendlyPublishError(err);
    } finally {
      busy = false;
    }
  }

  async function maybePrefillIntroduction() {
    if (!$session || $editTarget || $replyTarget || content.trim()) return;
    const checkKey = `${$session.pubkey}:${$relays.map((relay) => relay.url).join(',')}`;
    if (checkKey === introductionCheckKey) return;
    introductionCheckKey = checkKey;
    const hasPosted = await hasPublishedTextNote($session.pubkey, $relays).catch(() => true);
    if (checkKey !== introductionCheckKey || hasPosted || !$composerOpen || $editTarget || $replyTarget || content.trim()) return;
    content = introductionPrefix;
    showingIntroductionTip = true;
  }

  async function uploadMedia(file: File | undefined) {
    if (!file) return;
    if (!$session) {
      error = 'Sign in before uploading media.';
      return;
    }
    if (!file.type.startsWith('image/')) {
      error = 'Choose an image file.';
      return;
    }

    if (shouldCropImage(file)) {
      openCropper(file);
      return;
    }

    await uploadCroppedMedia(file);
  }

  async function uploadCroppedMedia(file: File) {
    if (!$session) return;
    uploading = true;
    error = '';
    try {
      const url = await uploadToNostrBuild($session, file, 'media');
      content = `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${url}`;
      closeCropper();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not upload image.';
    } finally {
      uploading = false;
      if (mediaInput) mediaInput.value = '';
    }
  }

  function openCropper(file: File) {
    cropFile = file;
    error = '';
  }

  function shouldCropImage(file: File) {
    if (croppableImageTypes.has(file.type.toLowerCase())) return true;
    return /\.(jpe?g|png|webp|avif)$/i.test(file.name);
  }

  function closeCropper() {
    cropFile = undefined;
    if (mediaInput) mediaInput.value = '';
  }

  function submitOnEnter(event: KeyboardEvent) {
    if (mentionSuggestions.length && mentionStart >= 0 && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault();
      selectMention(mentionSuggestions[0]);
      return;
    }
    if (!shouldSubmitTextareaOnEnter(event)) return;
    event.preventDefault();
    void submit();
  }

  function updateMentionSearch() {
    if (!textarea) return;
    const caret = textarea.selectionStart ?? content.length;
    const token = activeMentionToken(content, caret);
    mentionQuery = token?.query ?? '';
    mentionStart = token?.start ?? -1;
    mentionEnd = token?.end ?? -1;
    clearTimeout(mentionSearchTimer);
    remoteMentionProfiles = [];
    if (mentionQuery.length < 2) {
      searchingMentions = false;
      return;
    }
    mentionSearchTimer = setTimeout(() => void runMentionSearch(mentionQuery), mentionSearchDelayMs);
  }

  async function runMentionSearch(value: string) {
    searchingMentions = true;
    try {
      const found = await searchProfiles(value, $relays).catch(() => []);
      if (value === mentionQuery) {
        remoteMentionProfiles = found;
        if (found.length) profiles.update((existing) => mergeProfileRecords(existing, found));
      }
    } finally {
      searchingMentions = false;
    }
  }

  async function selectMention(profile: Profile) {
    if (mentionStart < 0 || mentionEnd < mentionStart) return;
    const label = mentionLabel(profile);
    content = `${content.slice(0, mentionStart)}${label}${content.slice(mentionEnd)}`;
    selectedMentions = mergeSelectedMentions([...selectedMentions, { pubkey: profile.pubkey, label, profile }]);
    clearMentionSearch();
    await tick();
    const caret = mentionStart + label.length;
    textarea?.focus();
    textarea?.setSelectionRange(caret, caret);
  }

  async function insertEmoji(emoji: string) {
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? start;
    content = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
    emojiPickerOpen = false;
    clearMentionSearch();
    await tick();
    const caret = start + emoji.length;
    textarea?.focus();
    textarea?.setSelectionRange(caret, caret);
  }

  function syncComposerPopupListener(open: boolean) {
    if (!browser) return;
    if (open) document.addEventListener('pointerdown', closeComposerPopupsFromOutside);
    else document.removeEventListener('pointerdown', closeComposerPopupsFromOutside);
  }

  function closeComposerPopupsFromOutside(event: PointerEvent) {
    if (!(event.target instanceof Node)) return;
    if (
      emojiPickerOpen &&
      emojiPickerElement &&
      emojiButtonElement &&
      !emojiPickerElement.contains(event.target) &&
      !emojiButtonElement.contains(event.target)
    ) {
      emojiPickerOpen = false;
    }
  }

  async function focusComposerStart() {
    await tick();
    textarea?.focus();
    textarea?.setSelectionRange(0, 0);
  }

  function mentionDraft(value: string) {
    let output = value;
    const tags: string[][] = [];
    for (const mention of selectedMentions) {
      if (!output.includes(mention.label)) continue;
      const profile = mention.profile ?? $profiles[mention.pubkey];
      const reference = `nostr:${nip19.nprofileEncode({ pubkey: mention.pubkey, relays: mentionRelayHints() })}`;
      output = output.replace(new RegExp(escapeRegExp(mention.label), 'g'), reference);
      tags.push(['p', mention.pubkey, '', profileLabel(profile)]);
    }
    return { content: output, tags: uniqueMentionTags(tags) };
  }

  function activeMentionToken(value: string, caret: number) {
    const beforeCaret = value.slice(0, caret);
    const match = /(^|[\s([{"'])@([A-Za-z0-9_.-]{0,64})$/.exec(beforeCaret);
    if (!match) return undefined;
    const query = match[2] ?? '';
    const start = beforeCaret.length - query.length - 1;
    return { query, start, end: caret };
  }

  function localMentionSuggestions(query: string) {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return Object.values($profiles)
      .filter((profile) => profileMatches(profile, needle))
      .sort((a, b) => profileLabel(a).localeCompare(profileLabel(b)));
  }

  function profileMatches(profile: Profile, needle: string) {
    return [profile.name, profile.display_name, profile.nip05, profile.pubkey].filter(isString).some((value) => value.toLowerCase().includes(needle));
  }

  function mergeMentionProfiles(first: Profile[], second: Profile[]) {
    const byPubkey = new Map<string, Profile>();
    [...first, ...second].filter((profile) => /^[0-9a-f]{64}$/i.test(profile.pubkey)).forEach((profile) => byPubkey.set(profile.pubkey, profile));
    return [...byPubkey.values()];
  }

  function mergeSelectedMentions(items: Array<{ pubkey: string; label: string; profile?: Profile }>) {
    const byKey = new Map<string, { pubkey: string; label: string; profile?: Profile }>();
    for (const item of items) byKey.set(`${item.pubkey}:${item.label}`, item);
    return [...byKey.values()];
  }

  function mentionLabel(profile: Profile) {
    const raw = firstString(profile.name, profile.display_name, profile.nip05?.split('@')[0]) || nip19.npubEncode(profile.pubkey).slice(0, 12);
    const clean = raw.replace(/^@/, '').replace(/[^A-Za-z0-9_.-]+/g, '');
    return `@${clean || nip19.npubEncode(profile.pubkey).slice(0, 12)}`;
  }

  function profileLabel(profile: Profile | undefined) {
    return firstString(profile?.display_name, profile?.name, profile?.nip05) || (profile?.pubkey ? `${profile.pubkey.slice(0, 10)}...` : '');
  }

  function mentionRelayHints() {
    return $relays.filter((relay) => relay.enabled && relay.read).slice(0, 3).map((relay) => relay.url);
  }

  function quoteReference(event: NostrEvent) {
    const relays = mentionRelayHints();
    try {
      return `nostr:${nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind, relays })}`;
    } catch {
      return `nostr:${nip19.noteEncode(event.id)}`;
    }
  }

  function quoteDraftTags(value: string) {
    if (!$quoteTarget || !loadedQuoteReference || !value.includes(loadedQuoteReference)) return [];
    const relay = mentionRelayHints()[0] ?? '';
    return [['q', $quoteTarget.id, relay, $quoteTarget.pubkey], ['p', $quoteTarget.pubkey]];
  }

  function mergeDraftTags(tags: string[][], extraTags: string[][]) {
    const seen = new Set<string>();
    return [...tags, ...extraTags].filter((tag) => {
      const key = `${tag[0] ?? ''}:${tag[1] ?? ''}:${tag[3] ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function uniqueMentionTags(tags: string[][]) {
    const byPubkey = new Map<string, string[]>();
    for (const tag of tags) {
      if (tag[0] === 'p' && /^[0-9a-f]{64}$/i.test(tag[1])) byPubkey.set(tag[1], tag);
    }
    return [...byPubkey.values()];
  }

  function clearMentionSearch() {
    clearTimeout(mentionSearchTimer);
    mentionQuery = '';
    mentionStart = -1;
    mentionEnd = -1;
    remoteMentionProfiles = [];
    searchingMentions = false;
  }

  function isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function firstString(...values: unknown[]) {
    return values.find(isString) ?? '';
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function closeComposer() {
    composerOpen.set(false);
    quoteTarget.set(null);
  }

  function keepComposerScroll(event: Event) {
    event.stopPropagation();
  }

  function startTextareaScroll(event: TouchEvent) {
    textareaTouchY = event.touches[0]?.clientY ?? 0;
    event.stopPropagation();
  }

  function moveTextareaScroll(event: TouchEvent) {
    event.stopPropagation();
    if (!textarea) return;
    const y = event.touches[0]?.clientY ?? textareaTouchY;
    const delta = textareaTouchY - y;
    textareaTouchY = y;
    if (textarea.scrollHeight <= textarea.clientHeight || !delta) return;
    textarea.scrollTop += delta;
    event.preventDefault();
  }

  function friendlyPublishError(err: unknown) {
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    if (/sign|signer|bunker|nip-?46|acknowledge|connect/i.test(message)) return 'Could not sign this event, please try again.';
    return message || 'Could not publish note.';
  }
</script>

{#if $composerOpen}
  <div class="composer-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && closeComposer()}>
    <div class:composer-orange-cult={orangeCultTag} class="composer-dock" role="dialog" aria-modal="true" aria-label="New note">
      <div class="composer-head">
        <strong>{$editTarget ? 'Edit note' : 'New note'}</strong>
        <button class="icon-button" on:click={closeComposer} aria-label="Close composer"><X size={20} /></button>
      </div>
      {#if $editTarget}
        <div class="reply-context">Publishes a corrected note and requests deletion of the old one.</div>
      {/if}
      {#if $replyTarget}
        <div class="reply-context">Replying to {$replyTarget.pubkey.slice(0, 10)}</div>
      {/if}
      {#if $quoteTarget}
        <div class="reply-context">Quoting {$quoteTarget.pubkey.slice(0, 10)}</div>
      {/if}
      {#if showingIntroductionTip && !$editTarget && !$replyTarget && !$quoteTarget}
        <div class="composer-tip">Tell us about yourself.</div>
      {/if}
      <div class="composer-input-wrap">
        <textarea
          bind:this={textarea}
          bind:value={content}
          on:input={updateMentionSearch}
          on:click={updateMentionSearch}
          on:keyup={updateMentionSearch}
          on:keydown={submitOnEnter}
          on:touchstart={startTextareaScroll}
          on:touchmove={moveTextareaScroll}
          on:wheel={keepComposerScroll}
          placeholder={$session ? "What's happening on Nostr?" : 'Sign in before posting'}
          maxlength="2000"
        ></textarea>
        {#if mentionQuery.length >= 2}
          <MentionSuggestions profiles={mentionSuggestions} searching={searchingMentions} on:select={(event) => selectMention(event.detail)} />
        {/if}
      </div>
      {#if orangeCultTag}
        <div class="composer-orange-cult-chip">#{orangeCultTag} <span>(not a cult)</span></div>
      {/if}
      {#if emojiPickerOpen}
        <div class="composer-emoji-picker" bind:this={emojiPickerElement} aria-label="Emoji picker">
          {#each emojiOptions as emoji}
            <button type="button" aria-label={`Insert ${emoji}`} on:click={() => insertEmoji(emoji)}>{emoji}</button>
          {/each}
        </div>
      {/if}
      <div class="composer-actions">
        <input class="visually-hidden" type="file" accept="image/*" bind:this={mediaInput} on:change={(event) => uploadMedia(event.currentTarget.files?.[0])} />
        <button class="icon-button" disabled={uploading || !$session} aria-label="Add media" on:click={() => mediaInput.click()}>
          {#if uploading}<Loader2 size={20} class="spin" />{:else}<ImagePlus size={20} />{/if}
        </button>
        <button bind:this={emojiButtonElement} class="icon-button" type="button" disabled={!$session} aria-label="Add emoji" aria-expanded={emojiPickerOpen} on:click={() => (emojiPickerOpen = !emojiPickerOpen)}>
          <Smile size={20} />
        </button>
        <span class="composer-count">{content.length}/2000</span>
        <button class="primary" disabled={busy || uploading || !$session || !content.trim()} on:click={submit}><Send size={18} /> {$editTarget ? 'Save edit' : 'Post'}</button>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
  </div>
{/if}

{#if cropFile}
  <ImageCropDialog file={cropFile} {uploading} on:close={closeCropper} on:crop={(event) => void uploadCroppedMedia(event.detail)} />
{/if}
