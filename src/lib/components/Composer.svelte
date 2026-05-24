<script lang="ts">
  import { ImagePlus, Loader2, Send, X } from '@lucide/svelte';
  import { composerOpen, editNote, editTarget, postNote, replyTarget, session } from '$lib/stores/app';
  import { uploadToNostrBuild } from '$lib/nostr/upload';

  let content = '';
  let busy = false;
  let uploading = false;
  let error = '';
  let mediaInput: HTMLInputElement;
  let loadedEditId = '';

  $: if ($composerOpen && $editTarget && loadedEditId !== $editTarget.id) {
    content = $editTarget.content;
    loadedEditId = $editTarget.id;
  }
  $: if ($composerOpen && !$editTarget && loadedEditId) {
    loadedEditId = '';
    content = '';
  }

  async function submit() {
    if (busy || uploading || !$session || !content.trim()) return;
    busy = true;
    error = '';
    try {
      if ($editTarget) await editNote(content.trim(), $editTarget);
      else await postNote(content.trim(), $replyTarget ?? undefined);
      content = '';
      composerOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not publish note.';
    } finally {
      busy = false;
    }
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

    uploading = true;
    error = '';
    try {
      const url = await uploadToNostrBuild($session, file, 'media');
      content = `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${url}`;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not upload image.';
    } finally {
      uploading = false;
      if (mediaInput) mediaInput.value = '';
    }
  }

  function submitOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    void submit();
  }
</script>

{#if $composerOpen}
  <div class="composer-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && composerOpen.set(false)}>
    <div class="composer-dock" role="dialog" aria-modal="true" aria-label="New note">
      <div class="composer-head">
        <strong>{$editTarget ? 'Edit note' : 'New note'}</strong>
        <button class="icon-button" on:click={() => composerOpen.set(false)} aria-label="Close composer"><X size={20} /></button>
      </div>
      {#if $editTarget}
        <div class="reply-context">Publishes a corrected note and requests deletion of the old one.</div>
      {/if}
      {#if $replyTarget}
        <div class="reply-context">Replying to {$replyTarget.pubkey.slice(0, 10)}</div>
      {/if}
      <textarea bind:value={content} on:keydown={submitOnEnter} placeholder={$session ? "What's happening on Nostr?" : 'Sign in before posting'} maxlength="2000"></textarea>
      <div class="composer-actions">
        <input class="visually-hidden" type="file" accept="image/*" bind:this={mediaInput} on:change={(event) => uploadMedia(event.currentTarget.files?.[0])} />
        <button class="icon-button" disabled={uploading || !$session} aria-label="Add media" on:click={() => mediaInput.click()}>
          {#if uploading}<Loader2 size={20} class="spin" />{:else}<ImagePlus size={20} />{/if}
        </button>
        <span>{content.length}/2000</span>
        <button class="primary" disabled={busy || uploading || !$session || !content.trim()} on:click={submit}><Send size={18} /> {$editTarget ? 'Save edit' : 'Post'}</button>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
  </div>
{/if}
