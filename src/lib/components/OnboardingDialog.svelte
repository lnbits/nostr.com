<script lang="ts">
  import { X } from '@lucide/svelte';
  import { socialInterests } from '$lib/nostr/config';
  import { completeOnboardingInterests, dismissOnboarding, onboardingDialogOpen } from '$lib/stores/app';

  let selected = new Set<string>();

  function toggle(interest: string) {
    selected = new Set(selected);
    if (selected.has(interest)) selected.delete(interest);
    else selected.add(interest);
  }

  function save() {
    completeOnboardingInterests([...selected]);
    selected = new Set<string>();
  }

  function skip() {
    dismissOnboarding();
    selected = new Set<string>();
  }

  function closeFromBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) skip();
  }

  function closeFromKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') skip();
  }
</script>

{#if $onboardingDialogOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={closeFromBackdrop} on:keydown={closeFromKeyboard}>
    <div class="dialog-panel compact" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div class="dialog-head">
        <h2 id="onboarding-title">Pick tags for your custom feed</h2>
        <button class="icon-button" on:click={skip} aria-label="Close onboarding"><X size={20} /></button>
      </div>

      <div class="interest-picker">
        <div class="interest-badges">
          {#each socialInterests as interest}
            <button class:active={selected.has(interest)} on:click={() => toggle(interest)}>{interest}</button>
          {/each}
        </div>
      </div>

      <div class="dialog-actions">
        <button on:click={skip}>Skip</button>
        <button class="primary" disabled={!selected.size} on:click={save}>Use custom feed</button>
      </div>
    </div>
  </div>
{/if}
