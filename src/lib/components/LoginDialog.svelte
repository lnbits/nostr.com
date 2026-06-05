<script lang="ts">
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
  <div class="dialog-backdrop login-dialog-backdrop" role="presentation" tabindex="-1" on:click={closeFromBackdrop} on:keydown={closeFromKeyboard}>
    <div class="dialog-panel" role="dialog" aria-modal="true" aria-label="Authentication">
      <LoginPanel />
    </div>
  </div>
{/if}
