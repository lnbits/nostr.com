<script lang="ts">
  import { Info, KeyRound, ShieldCheck } from '@lucide/svelte';
  import { loginDialogOpen, signIn, signInWithImportedNsec } from '$lib/stores/app';
  import { validateImportedNsec, type PomegranateLoginProvider } from '$lib/nostr/pomegranateAuth';
  import { appPath } from '$lib/paths';

  let privateKey = '';
  let bunkerUri = '';
  let googleNsec = '';
  let error = '';
  let loggingIn = false;
  let importing = false;
  let showGoogleNsecPrompt = false;
  $: busy = loggingIn || importing;

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

  async function loginWithNip07() {
    if (loggingIn) return;
    error = '';
    loggingIn = true;
    try {
      await signIn('nip07');
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not sign in with your browser extension.';
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

  async function importKey(value: string) {
    if (importing) return;
    error = '';
    importing = true;
    try {
      await signInWithImportedNsec(value, 'google');
      googleNsec = '';
      showGoogleNsecPrompt = false;
      loginDialogOpen.set(false);
    } catch (err) {
      googleNsec = '';
      error = err instanceof Error ? err.message : 'Could not import that key.';
    } finally {
      importing = false;
    }
  }

  function validNsec(value: string) {
    if (!value.trim()) return '';
    try {
      return validateImportedNsec(value).npub;
    } catch {
      return '';
    }
  }

  function promptForGoogleNsec() {
    error = '';
    showGoogleNsecPrompt = true;
  }

  function handleGoogleNsecInput() {
    if (!validNsec(googleNsec)) return;
    void importKey(googleNsec);
  }

  function closeForInfoLink() {
    loginDialogOpen.set(false);
  }
</script>

<section class="login-panel" id="login">
  {#if showGoogleNsecPrompt}
    <div class="login-section">
      <input aria-label="nsec to import" type="password" bind:value={googleNsec} on:input={handleGoogleNsecInput} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
      <div class="login-method-row">
        <button class="primary google-login-button" disabled={busy} on:click={() => login('google')}><ShieldCheck size={18} /> {loggingIn ? 'Connecting' : "I don't have an nsec"}</button>
        <a class="login-info-link" href={appPath('/pomegranate')} aria-label="Learn about Pomegranate" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>
    </div>
  {:else}
    <div class="login-method-row">
      <button class="primary google-login-button" disabled={busy} on:click={promptForGoogleNsec}><ShieldCheck size={18} /> Continue with Google</button>
      <a class="login-info-link" href={appPath('/pomegranate')} aria-label="Learn about Pomegranate" on:click={closeForInfoLink}><Info size={17} /></a>
    </div>

    <div class="login-section">
      <div class="login-method-row">
        <button class="nip07-login-button" disabled={busy} on:click={() => void loginWithNip07()}><KeyRound size={18} /> Connect with NIP-07</button>
        <a class="login-info-link" href={appPath('/nip07')} aria-label="Learn about NIP-07" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>

      <div class="login-method-row">
        <div class="login-input-action">
          <input aria-label="Bunker URI" bind:value={bunkerUri} autocomplete="off" spellcheck="false" placeholder="bunker://..." />
          <button disabled={busy || !bunkerUri.trim()} on:click={() => void loginWithBunker()}><KeyRound size={18} /> Connect</button>
        </div>
        <a class="login-info-link" href={appPath('/nip46')} aria-label="Learn about NIP-46" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>

      <div class="login-method-row">
        <div class="login-input-action">
          <input aria-label="nsec or hex key" type="password" bind:value={privateKey} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
          <button disabled={busy || !privateKey.trim()} on:click={() => void loginWithPrivateKey()}><KeyRound size={18} /> Sign in</button>
        </div>
        <a class="login-info-link" href={appPath('/nostr-keys')} aria-label="Learn about Nostr keys" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
