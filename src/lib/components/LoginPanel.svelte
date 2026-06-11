<script lang="ts">
  import { KeyRound, ShieldCheck } from '@lucide/svelte';
  import { loginDialogOpen, signIn, signInWithImportedNsec } from '$lib/stores/app';
  import { validateImportedNsec, type PomegranateLoginProvider } from '$lib/nostr/pomegranateAuth';

  let nsec = '';
  let privateKey = '';
  let bunkerUri = '';
  let error = '';
  let loggingIn = false;
  let importing = false;
  let showOtherMethods = false;
  let replaceExisting = false;
  $: busy = loggingIn || importing;
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

  async function loginWithPrivateKey() {
    if (loggingIn) return;
    error = '';
    loggingIn = true;
    try {
      await signIn('private-key', privateKey);
      privateKey = '';
      loginDialogOpen.set(false);
    } catch (err) {
      privateKey = '';
      error = err instanceof Error ? err.message : 'Could not sign in with that private key.';
    } finally {
      loggingIn = false;
    }
  }

  async function loginWithBunker() {
    if (loggingIn) return;
    error = '';
    loggingIn = true;
    try {
      await signIn('bunker', bunkerUri);
      bunkerUri = '';
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not sign in to that remote signer.';
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
  <div class="login-input-action">
    <input aria-label="Bunker URI" bind:value={bunkerUri} autocomplete="off" spellcheck="false" placeholder="bunker://..." />
    <button disabled={busy || !bunkerUri.trim()} on:click={() => void loginWithBunker()}><KeyRound size={18} /> Connect</button>
  </div>

  <div class="login-input-action">
    <input aria-label="nsec or hex key" type="password" bind:value={privateKey} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
    <button disabled={busy || !privateKey.trim()} on:click={() => void loginWithPrivateKey()}><KeyRound size={18} /> Sign in</button>
  </div>

  <button class="primary google-login-button" disabled={busy} on:click={() => login('google')}><ShieldCheck size={18} /> {loggingIn ? 'Connecting' : 'Continue with Google'}</button>
  <p>
    Google auth uses <a href="https://viewsource.win/fiatjaf.com/pomegranate" target="_blank" rel="noreferrer">Pomegranate</a>
    to split your nsec across operators and sign remotely without compromising your key.
  </p>

  <details class="login-advanced" bind:open={showOtherMethods}>
    <summary>Import existing Nostr key to pomegranate</summary>

    <div class="login-section">
      <input aria-label="Private key" type="password" bind:value={nsec} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
      {#if importPreview}
        <p>Matches {importPreview}</p>
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
      <button disabled={busy || !importPreview} on:click={() => void importKey()}><KeyRound size={18} /> {importing ? 'Importing' : replaceExisting ? 'Replace and import' : 'Import with Pomegranate'}</button>
    </div>
  </details>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
