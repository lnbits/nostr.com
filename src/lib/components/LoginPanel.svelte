<script lang="ts">
  import { KeyRound, PlugZap, ShieldCheck } from '@lucide/svelte';
  import { loginDialogOpen, signIn } from '$lib/stores/app';

  let privateKey = '';
  let bunker = '';
  let error = '';

  async function login(mode: 'nip07' | 'private-key' | 'bunker' | 'guest') {
    error = '';
    try {
      await signIn(mode, mode === 'private-key' ? privateKey : bunker);
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not sign in.';
    }
  }
</script>

<section class="login-panel" id="login">
  <div>
    <h2>Sign in</h2>
    <p>NIP-07, local private key, and NIP-46 bunker signing are active.</p>
  </div>

  <div class="login-actions">
    <button class="primary" on:click={() => login('nip07')}><PlugZap size={18} /> NIP-07</button>
    <button on:click={() => login('guest')}><ShieldCheck size={18} /> Test key</button>
  </div>

  <label>
    <span>Private key hex</span>
    <input bind:value={privateKey} autocomplete="off" spellcheck="false" placeholder="nsec conversion can be added next" />
  </label>
  <button on:click={() => login('private-key')}><KeyRound size={18} /> Use private key</button>

  <label>
    <span>Bunker URI</span>
    <input bind:value={bunker} autocomplete="off" spellcheck="false" placeholder="bunker://..." />
  </label>
  <button on:click={() => login('bunker')}><PlugZap size={18} /> Connect bunker</button>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
