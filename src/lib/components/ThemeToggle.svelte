<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { cycleThemeMode, setThemeMode, themeMode } from '$lib/stores/theme';

  $: themeLabel = $themeMode === 'light' ? 'Light theme' : 'Dark theme';
</script>

<button class="icon-button" on:click={() => setThemeMode(cycleThemeMode($themeMode))} aria-label={themeLabel} title={themeLabel}>
  {#if $themeMode === 'light'}
    <Sun size={20} />
  {:else}
    <Moon size={20} />
  {/if}
</button>
