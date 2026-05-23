<script lang="ts">
  const nips = [
    {
      id: 'NIP-01',
      description: 'The basic protocol: signed events, filters, relay subscriptions, and how clients talk to relays.'
    },
    {
      id: 'NIP-02',
      description: 'Contact lists, which power follow lists and let clients share who a user follows.'
    },
    {
      id: 'NIP-04',
      description: 'Legacy encrypted direct messages between users.'
    },
    {
      id: 'NIP-05',
      description: 'Human-readable identifiers like name@example.com that resolve to Nostr public keys.'
    },
    {
      id: 'NIP-07',
      description: 'Browser extension signing, so users can log in without giving the app their private key.'
    },
    {
      id: 'NIP-10',
      description: 'Thread and reply markers that help clients build conversations around notes.'
    },
    {
      id: 'NIP-18',
      description: 'Reposts, so clients can show shared notes without copying the original content.'
    },
    {
      id: 'NIP-19',
      description: 'Readable Bech32 identifiers such as npub, nsec, note, and nevent.'
    },
    {
      id: 'NIP-25',
      description: 'Reactions, including likes, dislikes, and other emoji responses.'
    },
    {
      id: 'NIP-26',
      description: 'Delegated events, used when one key is allowed to publish on behalf of another.'
    },
    {
      id: 'NIP-50',
      description: 'Relay search, used here to suggest profiles while editing follow lists.'
    },
    {
      id: 'NIP-57',
      description: 'Lightning zaps, which let users send and count payment receipts on notes.'
    }
  ];
</script>

<section class="info-view">
  <header class="info-head">
    <h1>Info</h1>
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
    <p>
      Learn more at <a href="https://nostr.org" target="_blank" rel="noreferrer">nostr.org</a>
    </p>
  </header>

  <section class="panel info-panel">
    <h2>This client uses</h2>
    <div class="nips-list">
      {#each nips as nip}
        <div class="nip-row">
          <strong>{nip.id}</strong>
          <span>{nip.description}</span>
        </div>
      {/each}
    </div>
  </section>
</section>
