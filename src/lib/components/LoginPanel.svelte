<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronDown, Download, Info, KeyRound, ShieldCheck, Sparkles } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import { hexToBytes } from '@noble/hashes/utils.js';
  import { createGuestSession } from '$lib/nostr/client';
  import { keywordsForInterests, socialInterests } from '$lib/nostr/config';
  import { customFeedSettings, loginDialogOpen, refreshFeed, relays, saveProfile, selectFeedMode, signIn, signInWithImportedNsec } from '$lib/stores/app';
  import { validateImportedNsec, type PomegranateLoginProvider } from '$lib/nostr/pomegranateAuth';
  import { appPath } from '$lib/paths';
  import { canUseNativeSecureSessionStorage } from '$lib/nativeSecureSession';
  import { loginRelaysReady, relayStatus } from '$lib/stores/relayStatus';

  type LoginView = 'sign-in' | 'create';

  let privateKey = '';
  let bunkerUri = '';
  let googleNsec = '';
  let error = '';
  let loggingIn = false;
  let importing = false;
  let showGoogleNsecPrompt = false;
  let nativeSecureKeyAvailable = false;
  let rememberPrivateKeyOnDevice = true;
  let view: LoginView = 'sign-in';
  let generatedKeys: { npub: string; nsec: string; pubkey: string } | null = null;
  let keysDownloaded = false;
  let profileName = '';
  let profileBio = '';
  let selectedInterests: string[] = [];
  let interestsOpen = false;
  let savingProfile = false;
  $: busy = loggingIn || importing || savingProfile;
  $: canLogin = loginRelaysReady($relays, $relayStatus);

  onMount(() => {
    void canUseNativeSecureSessionStorage().then((available) => (nativeSecureKeyAvailable = available));
  });

  async function login(provider: PomegranateLoginProvider) {
    if (loggingIn || !ensureRelaysReady()) return;
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
    if (loggingIn || !ensureRelaysReady()) return;
    error = '';
    loggingIn = true;
    try {
      await signIn('private-key', privateKey, { rememberNativePrivateKey: nativeSecureKeyAvailable && rememberPrivateKeyOnDevice });
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
    if (loggingIn || !ensureRelaysReady()) return;
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
    if (loggingIn || !ensureRelaysReady()) return;
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

  function showCreateKeys() {
    error = '';
    showGoogleNsecPrompt = false;
    generatedKeys = null;
    keysDownloaded = false;
    profileName = '';
    profileBio = '';
    selectedInterests = [];
    interestsOpen = false;
    view = 'create';
  }

  function showSignIn() {
    error = '';
    view = 'sign-in';
  }

  function generateKeys() {
    error = '';
    const next = createGuestSession();
    if (!next.secret) {
      error = 'Could not generate keys.';
      return;
    }
    generatedKeys = {
      pubkey: next.pubkey,
      npub: nip19.npubEncode(next.pubkey),
      nsec: nip19.nsecEncode(hexToBytes(next.secret))
    };
    keysDownloaded = false;
  }

  function downloadKeys() {
    if (!generatedKeys) return;
    const content = `These are your Nostr keys. Keep them very safe.

Public key / npub (the one you can share)
${generatedKeys.npub}

Private key / nsec (the one you must never share)
${generatedKeys.nsec}
`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nostr-keys.txt';
    anchor.click();
    URL.revokeObjectURL(url);
    keysDownloaded = true;
  }

  function toggleInterest(interest: string) {
    selectedInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];
  }

  async function saveCreatedProfile() {
    if (!generatedKeys || savingProfile || !ensureRelaysReady()) return;
    error = '';
    savingProfile = true;
    try {
      await signIn('private-key', generatedKeys.nsec, { rememberNativePrivateKey: nativeSecureKeyAvailable && rememberPrivateKeyOnDevice });
      const keywords = keywordsForInterests(selectedInterests);
      customFeedSettings.update((settings) => ({
        ...settings,
        keywords: [...new Set([...settings.keywords, ...keywords])],
        interests: [...new Set([...settings.interests, ...selectedInterests.map((interest) => interest.trim().toLowerCase()).filter(Boolean)])]
      }));
      const cleanName = profileName.trim();
      const cleanBio = profileBio.trim();
      if (cleanName || cleanBio || selectedInterests.length) {
        void saveProfile({
          pubkey: generatedKeys.pubkey,
          name: cleanName || undefined,
          display_name: cleanName || undefined,
          about: cleanBio || undefined,
          interests: selectedInterests
        }).catch(() => undefined);
      }
      if (keywords.length) selectFeedMode('custom');
      else void refreshFeed('global');
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save profile.';
    } finally {
      savingProfile = false;
    }
  }

  async function importKey(value: string) {
    if (importing || !ensureRelaysReady()) return;
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

  function ensureRelaysReady() {
    if (canLogin) return true;
    error = 'Connecting to relays. Try again in a moment.';
    return false;
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
  {#if view === 'create'}
    <div class="login-create-head">
      <button class="login-back-button" on:click={showSignIn}>Sign in instead</button>
      <p>Generate a new Nostr key pair and download your private key before continuing.</p>
    </div>

    <button class="primary" disabled={busy || !canLogin} on:click={generateKeys}><Sparkles size={18} /> Generate nsec</button>

    {#if generatedKeys}
      <div class="generated-key-preview" aria-live="polite">
        <span>{generatedKeys.npub}</span>
      </div>
      <button disabled={busy} on:click={downloadKeys}><Download size={18} /> Download keys</button>
    {/if}

    {#if keysDownloaded}
      <div class="login-section">
        <label>
          <span>Name</span>
          <input bind:value={profileName} autocomplete="name" spellcheck="false" placeholder="Satoshi" />
        </label>
        <label>
          <span>Bio</span>
          <textarea bind:value={profileBio} placeholder="A little about you"></textarea>
        </label>
        <div class="interest-picker" role="group" aria-label="Interests">
          <span class="field-label">Interests</span>
          <button type="button" class="interest-trigger" aria-expanded={interestsOpen} on:click={() => (interestsOpen = !interestsOpen)}>
            <span>{selectedInterests.length ? selectedInterests.join(', ') : 'Choose interests'}</span>
            <ChevronDown size={18} />
          </button>
          {#if interestsOpen}
            <div class="interest-menu">
              {#each socialInterests as interest}
                <label class="interest-option">
                  <input type="checkbox" checked={selectedInterests.includes(interest)} on:change={() => toggleInterest(interest)} />
                  <span>{interest}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
        {#if nativeSecureKeyAvailable}
          <label class="login-remember-option">
            <input type="checkbox" bind:checked={rememberPrivateKeyOnDevice} />
            <span>Remember securely on this device</span>
          </label>
        {/if}
        <button class="primary" disabled={busy || !canLogin} on:click={() => void saveCreatedProfile()}>
          <KeyRound size={18} /> {savingProfile ? 'Saving profile' : 'Save profile and sign in'}
        </button>
      </div>
    {/if}
  {:else if showGoogleNsecPrompt}
    <div class="login-section">
      <input aria-label="optional nsec to import" type="password" bind:value={googleNsec} on:input={handleGoogleNsecInput} autocomplete="off" spellcheck="false" placeholder="nsec (optional)" />
      <div class="login-method-row">
        <button class="primary google-login-button" disabled={busy || !canLogin} on:click={() => login('google')}><ShieldCheck size={18} /> {loggingIn ? 'Connecting' : 'Login/Signup'}</button>
        <a class="login-info-link" href={appPath('/pomegranate')} aria-label="Learn about Pomegranate" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>
    </div>
  {:else}
    <div class="login-method-row">
      <button class="primary google-login-button" disabled={busy || !canLogin} on:click={promptForGoogleNsec}><ShieldCheck size={18} /> Continue with Google</button>
      <a class="login-info-link" href={appPath('/pomegranate')} aria-label="Learn about Pomegranate" on:click={closeForInfoLink}><Info size={17} /></a>
    </div>

    <div class="login-section">
      <div class="login-method-row">
        <button class="nip07-login-button" disabled={busy || !canLogin} on:click={() => void loginWithNip07()}><KeyRound size={18} /> Connect with NIP-07</button>
        <a class="login-info-link" href={appPath('/nip07')} aria-label="Learn about NIP-07" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>

      <div class="login-method-row">
        <div class="login-input-action">
          <input aria-label="Bunker URI" bind:value={bunkerUri} autocomplete="off" spellcheck="false" placeholder="bunker://..." />
          <button class="login-compact-action" disabled={busy || !canLogin || !bunkerUri.trim()} on:click={() => void loginWithBunker()}><KeyRound size={18} /> Connect</button>
        </div>
        <a class="login-info-link" href={appPath('/nip46')} aria-label="Learn about NIP-46" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>

      <div class="login-method-row">
        <div class="login-method-stack">
          <div class="login-input-action">
            <input aria-label="nsec or hex key" type="password" bind:value={privateKey} autocomplete="off" spellcheck="false" placeholder="nsec1..." />
            <button class="login-compact-action" disabled={busy || !canLogin || !privateKey.trim()} on:click={() => void loginWithPrivateKey()}><KeyRound size={18} /> Sign in</button>
          </div>
          {#if nativeSecureKeyAvailable}
            <label class="login-remember-option">
              <input type="checkbox" bind:checked={rememberPrivateKeyOnDevice} />
              <span>Remember securely on this device</span>
            </label>
          {/if}
        </div>
        <a class="login-info-link" href={appPath('/nostr-keys')} aria-label="Learn about Nostr keys" on:click={closeForInfoLink}><Info size={17} /></a>
      </div>

      <button class="generate-nsec-button" disabled={busy || !canLogin} on:click={showCreateKeys}><Sparkles size={18} /> Generate nsec</button>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
