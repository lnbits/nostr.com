<script lang="ts">
  import { X } from '@lucide/svelte';
  import { loginDialogOpen } from '$lib/stores/app';
  import LoginPanel from './LoginPanel.svelte';

  function closeFromBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) loginDialogOpen.set(false);
  }

  function closeFromKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') loginDialogOpen.set(false);
  }
</script>

{#if $loginDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={closeFromBackdrop} on:keydown={closeFromKeyboard}>
    <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div class="dialog-head">
        <h2 id="login-title">Sign in</h2>
        <button class="icon-button" on:click={() => loginDialogOpen.set(false)} aria-label="Close sign in"><X size={20} /></button>
      </div>
      <LoginPanel />
    </div>
  </div>
{/if}
