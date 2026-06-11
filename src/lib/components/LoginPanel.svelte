<script lang="ts">
  import { KeyRound, ShieldCheck } from '@lucide/svelte';
  import { loginDialogOpen, signIn, signInWithImportedNsec } from '$lib/stores/app';
  import { validateImportedNsec, type PomegranateLoginProvider } from '$lib/nostr/pomegranateAuth';

  let nsec = '';
  let error = '';
  let loggingIn = false;
  let importing = false;
  let showImport = false;
  let replaceExisting = false;
  $: importPreview = previewNsec(nsec);

  async function login(provider: PomegranateLoginProvider) {
    if (loggingIn) return;
    error = '';
    loggingIn = true;
    try {
      await signIn('pomegranate', provider);
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Could not sign in.';
    } finally {
      loggingIn = false;
    }
  }

  async function importKey() {
    if (importing) return;
    error = '';
    importing = true;
    try {
      if (replaceExisting && !confirm('Replace the Pomegranate identity for this login? This revokes the current Pomegranate account connections for this login, but it does not change the imported npub.')) {
        importing = false;
        return;
      }
      await signInWithImportedNsec(nsec, 'google', { replaceExisting });
      nsec = '';
      replaceExisting = false;
      loginDialogOpen.set(false);
    } catch (err) {
      nsec = '';
      error = err instanceof Error ? err.message : 'Could not import that key.';
    } finally {
      importing = false;
    }
  }

  function previewNsec(value: string) {
    if (!value.trim()) return '';
    try {
      return validateImportedNsec(value).npub;
    } catch {
      return '';
    }
  }
</script>

<section class="login-panel" id="login">
  <button class="primary" disabled={loggingIn} on:click={() => login('google')}><ShieldCheck size={18} /> {loggingIn ? 'Connecting' : 'Continue with Google'}</button>
  <button class="primary" disabled={loggingIn} on:click={() => login('github')}><KeyRound size={18} /> Continue with GitHub</button>

  <details class="login-advanced" bind:open={showImport}>
    <summary>Import existing Nostr key</summary>
    <label>
      <span>Private key</span>
      <input type="password" bind:value={nsec} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
    </label>
    {#if importPreview}
      <p>Logging in as {importPreview}</p>
    {:else if nsec.trim()}
      <p class="error">Enter a valid nsec private key.</p>
    {/if}
    <label class="login-replace-option">
      <input type="checkbox" bind:checked={replaceExisting} />
      <span>Replace the Pomegranate identity for this login</span>
    </label>
    {#if replaceExisting}
      <p>This resets the Pomegranate account for the login you approve, then imports this key. Your npub will be the imported npub.</p>
    {/if}
    <button disabled={importing || !importPreview} on:click={() => void importKey()}><KeyRound size={18} /> {importing ? 'Importing' : replaceExisting ? 'Replace and import' : 'Import with Pomegranate'}</button>
  </details>

  <p>Pomegranate handles identity and signing through NIP-46. This app never stores your raw nsec.</p>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
