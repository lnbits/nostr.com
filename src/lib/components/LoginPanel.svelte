<script lang="ts">
  import { ChevronDown, Download, KeyRound, PlugZap, ShieldCheck, Sparkles } from '@lucide/svelte';
  import { nip19 } from 'nostr-tools';
  import { hexToBytes } from '@noble/hashes/utils.js';
  import { createGuestSession } from '$lib/nostr/client';
  import { keywordsForInterests, socialInterests } from '$lib/nostr/config';
  import { customFeedSettings, loginDialogOpen, refreshFeed, saveProfile, signIn } from '$lib/stores/app';

  let privateKey = '';
  let bunker = '';
  let error = '';
  let mode: 'sign-in' | 'create' = 'sign-in';
  let generatedKeys: { npub: string; nsec: string; secret: string; pubkey: string } | null = null;
  let keysDownloaded = false;
  let profileName = '';
  let profileBio = '';
  let selectedInterests: string[] = [];
  let interestsOpen = false;
  let savingProfile = false;

  async function login(mode: 'nip07' | 'private-key' | 'bunker') {
    error = '';
    try {
      await signIn(mode, mode === 'private-key' ? privateKey : bunker);
      loginDialogOpen.set(false);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not sign in.';
    }
  }

  function showCreateKeys() {
    error = '';
    generatedKeys = null;
    keysDownloaded = false;
    profileName = '';
    profileBio = '';
    selectedInterests = [];
    interestsOpen = false;
    mode = 'create';
  }

  function generateKeys() {
    const next = createGuestSession();
    if (!next.secret) {
      error = 'Could not generate keys.';
      return;
    }
    generatedKeys = {
      pubkey: next.pubkey,
      secret: next.secret,
      npub: nip19.npubEncode(next.pubkey),
      nsec: nip19.nsecEncode(hexToBytes(next.secret))
    };
    keysDownloaded = false;
  }

  function downloadKeys() {
    if (!generatedKeys) return;
    const content = `These are your nostr keys keep them very safe.

Public key/npub (the one you can share)
${generatedKeys.npub}

Private key/nsec (the one you must never share and keep secure)
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
    if (!generatedKeys) return;
    error = '';
    savingProfile = true;
    try {
      await signIn('private-key', generatedKeys.nsec);
      const interestKeywords = keywordsForInterests(selectedInterests);
      customFeedSettings.update((settings) => ({
        ...settings,
        keywords: [...new Set([...settings.keywords, ...interestKeywords])],
        interests: []
      }));
      const profileDraft = {
        pubkey: generatedKeys.pubkey,
        name: profileName.trim() || undefined,
        display_name: profileName.trim() || undefined,
        about: profileBio.trim() || undefined,
        interests: selectedInterests
      };
      void refreshFeed('global');
      loginDialogOpen.set(false);
      void saveProfile(profileDraft).catch(() => undefined);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save profile.';
    } finally {
      savingProfile = false;
    }
  }
</script>

<section class="login-panel" id="login">
  {#if mode === 'create'}
    <p>Generate a new Nostr key pair and download it before signing in.</p>

    <button class="primary" on:click={generateKeys}><Sparkles size={18} /> Generate keys</button>

    {#if generatedKeys}
      <button on:click={downloadKeys}><Download size={18} /> Download keys</button>
    {/if}

    {#if keysDownloaded}
      <label>
        <span>Name</span>
        <input bind:value={profileName} autocomplete="name" spellcheck="false" placeholder="Satoshi" />
      </label>
      <label>
        <span>Bio</span>
        <textarea bind:value={profileBio} placeholder="A little about you"></textarea>
      </label>
      <div class="interest-picker" role="group" aria-label="Interests" on:mouseleave={() => (interestsOpen = false)}>
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
      <button class="primary" disabled={savingProfile} on:click={() => void saveCreatedProfile()}>
        <KeyRound size={18} /> {savingProfile ? 'Saving profile' : 'Save profile and log in with key'}
      </button>
    {/if}
  {:else}
    <p>NIP-07, local private key, and NIP-46 bunker signing are active.</p>

    <div class="login-actions">
      <button class="primary" on:click={() => login('nip07')}><PlugZap size={18} /> NIP-07</button>
      <button on:click={showCreateKeys}><ShieldCheck size={18} /> Create</button>
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
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</section>
