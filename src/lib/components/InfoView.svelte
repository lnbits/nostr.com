<script lang="ts">
  const activeNips = [
    {
      id: 'NIP-01',
      description: 'The basic protocol: signed events, filters, relay subscriptions, event validation, and relay publishing.'
    },
    {
      id: 'NIP-02',
      description: 'Contact lists, used for follow lists and follow-list publishing with relay hints preserved where possible.'
    },
    {
      id: 'NIP-04',
      description: 'Legacy encrypted direct messages between users; useful for compatibility, but can leak metadata.'
    },
    {
      id: 'NIP-17',
      description: 'Modern private messages, read and published as gift-wrapped events when the active signer can handle NIP-44 payloads.'
    },
    {
      id: 'NIP-05',
      description: 'Human-readable identifiers like name@example.com that resolve to Nostr public keys and relay hints.'
    },
    {
      id: 'NIP-07',
      description: 'Browser extension login and signing, so users can publish without giving the app their private key.'
    },
    {
      id: 'NIP-10',
      description: 'Thread and reply markers for building conversations around notes and publishing marked replies.'
    },
    {
      id: 'NIP-11',
      description: 'Relay information documents, used to understand relay capabilities, limits, and supported NIPs.'
    },
    {
      id: 'NIP-18',
      description: 'Reposts, used for repost counts and publishing shared notes without copying the original content.'
    },
    {
      id: 'NIP-19',
      description: 'Readable Bech32 identifiers such as npub, nsec, note, nevent, and nprofile.'
    },
    {
      id: 'NIP-21',
      description: 'nostr: URI links, so Nostr references in notes can be opened from the client.'
    },
    {
      id: 'NIP-25',
      description: 'Reactions, used for like counts and publishing reaction events.'
    },
    {
      id: 'NIP-27',
      description: 'Inline references, used to turn indexed profile and note mentions into clickable links.'
    },
    {
      id: 'NIP-36',
      description: 'Sensitive content labels, used by the feed filters to keep warned content out of the default feed.'
    },
    {
      id: 'NIP-40',
      description: 'Expiration timestamps, used to hide expired events from feeds.'
    },
    {
      id: 'NIP-45',
      description: 'Relay COUNT queries, used best-effort for reply, repost, reaction, and zap totals when relays support it.'
    },
    {
      id: 'NIP-46',
      description: 'Bunker remote signing, used to connect to a remote signer for login, event signing, and supported DM decryption.'
    },
    {
      id: 'NIP-50',
      description: 'Relay search, used here to suggest profiles while editing follow lists.'
    },
    {
      id: 'NIP-56',
      description: 'Reports, used to publish report events for spam, abuse, and unsafe content.'
    },
    {
      id: 'NIP-57',
      description: 'Lightning zaps, used for counting zap receipts on notes.'
    },
    {
      id: 'NIP-65',
      description: 'Relay list metadata, used for sane relay discovery and publishing a user’s read/write relays.'
    },
    {
      id: 'NIP-92',
      description: 'Media attachments, used to read imeta tags such as alt text, dimensions, blurhash, and fallback URLs.'
    },
    {
      id: 'NIP-96',
      description: 'HTTP file storage integration, used for profile image and banner uploads where supported by the media host.'
    },
    {
      id: 'NIP-98',
      description: 'HTTP authentication, used to sign upload requests without exposing the user’s private key.'
    }
  ];

  const partialNips: { id: string; description: string }[] = [];
</script>

<section class="info-view">
  <header class="info-head">
    <a class="info-back" href="/" aria-label="Back to feed">← Feed</a>
    <div class="info-title-row">
      <h1>Info</h1>
      <img src="/robot.png" alt="" class="info-robot" />
    </div>
    <p>
      Nostr is a completely free and open-source protocol that nobody controls. It enables
      social media and many other applications without creating walled gardens or centralized
      platforms.
    </p>
    <p>
      Nostr is modular and evolves through Nostr Improvement Proposals (NIPs). Because clients
      share the same open protocol, users are free to choose whichever client they prefer. The
      freedom to move between clients is what makes Nostr a commons, not a walled garden that
      can be controlled. You can even build your own client!
    </p>
    <p>This Nostr social client is just one of the kazillion clients that exist.</p>
    <p>
      Learn more at <a href="https://nostr.org" target="_blank" rel="noreferrer">nostr.org</a>
    </p>
  </header>

  <section class="panel info-panel">
    <h2>This client uses</h2>
    <div class="nips-list">
      {#each activeNips as nip}
        <div class="nip-row">
          <strong>{nip.id}</strong>
          <span>{nip.description}</span>
        </div>
      {/each}
    </div>
  </section>

  {#if partialNips.length}
    <section class="panel info-panel">
      <h2>In progress</h2>
      <div class="nips-list">
        {#each partialNips as nip}
          <div class="nip-row">
            <strong>{nip.id}</strong>
            <span>{nip.description}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
