<script lang="ts">
  import { ImagePlus, Send, X } from '@lucide/svelte';
  import { composerOpen, postNote, replyTarget, session } from '$lib/stores/app';

  let content = '';
  let busy = false;
  let error = '';

  async function submit() {
    if (!content.trim()) return;
    busy = true;
    error = '';
    try {
      await postNote(content.trim(), $replyTarget ?? undefined);
      content = '';
      composerOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not publish note.';
    } finally {
      busy = false;
    }
  }
</script>

{#if $composerOpen}
  <section class="composer-dock">
    <div class="composer-head">
      <strong>New note</strong>
      <button class="icon-button" on:click={() => composerOpen.set(false)} aria-label="Close composer"><X size={20} /></button>
    </div>
    {#if $replyTarget}
      <div class="reply-context">Replying to {$replyTarget.pubkey.slice(0, 10)}</div>
    {/if}
    <textarea bind:value={content} placeholder={$session ? "What's happening on Nostr?" : 'Sign in before posting'} maxlength="2000"></textarea>
    <div class="composer-actions">
      <button class="icon-button" aria-label="Add media"><ImagePlus size={20} /></button>
      <span>{content.length}/2000</span>
      <button class="primary" disabled={busy || !$session || !content.trim()} on:click={submit}><Send size={18} /> Post</button>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
  </section>
{/if}
