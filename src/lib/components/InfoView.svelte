<script lang="ts">
  import { appPath } from '$lib/paths';
  import { slugForNipId } from '$lib/nips';

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
      id: 'NIP-05',
      description: 'Human-readable identifiers like name@example.com that resolve to Nostr public keys and relay hints.'
    },
    {
      id: 'NIP-07',
      description: 'Browser extension login and signing, so users can publish without giving the app their private key.'
    },
    {
      id: 'NIP-09',
      description: 'Deletion requests, used when editing your own short notes by publishing the corrected note and disowning the old one.'
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
      id: 'NIP-15',
      description: 'End-of-stored-events notices, used by relay queries to know when the initial batch of stored events has finished.'
    },
    {
      id: 'NIP-17',
      description: 'Modern private messages, read and published as gift-wrapped events when the active signer can handle NIP-44 payloads.'
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
      id: 'NIP-24',
      description: 'Extra profile metadata fields such as display names, banners, websites, and other common profile details.'
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
      id: 'NIP-44',
      description: 'Versioned encryption, used by modern NIP-17/NIP-59 direct messages when the active signer supports it.'
    },
    {
      id: 'NIP-45',
      description: 'Relay COUNT queries, used best-effort for reply, repost, and reaction totals when relays support it.'
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
      id: 'NIP-51',
      description: 'Standard lists, used for mute lists so hidden accounts stay out of feeds and notifications.'
    },
    {
      id: 'NIP-56',
      description: 'Reports, used to publish report events for spam, abuse, and unsafe content.'
    },
    {
      id: 'NIP-57',
      description: 'Lightning zaps, used to request invoices, render QR codes, and listen for zap receipts when the recipient supports them.'
    },
    {
      id: 'NIP-59',
      description: 'Gift wraps and seals, used to route modern private messages without exposing the inner chat event publicly.'
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
      id: 'NIP-94',
      description: 'File metadata responses, used when upload services return Nostr file metadata alongside media URLs.'
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
    <a class="info-back" href={appPath('/')} aria-label="Back to feed">← Feed</a>
    <div class="info-title-row">
      <h1>Info</h1>
      <img src={appPath('/robot.png')} alt="" class="info-robot" />
    </div>
    <p>
      Nostr (Notes and Other Stuff Transmitted by Relays) is a free and open network that nobody
      owns or controls. Instead of one company running everything, Nostr uses
      <a href={appPath('/relays')}>relays</a> (servers) to store and share information, and
      <a href={appPath('/clients')}>clients</a> (apps) to let people read, write, and interact with
      that information.
    </p>
    <p>
      Every account has <a href={appPath('/nostr-keys')}>Nostr keys</a>. Your public key is like
      your username and can be shared with anyone. Your private key is like your password and must
      be kept safe. These keys give you ownership of your identity, rather than a company owning it
      for you.
    </p>
    <p>
      Because your identity belongs to your keys, not a specific app, you can move between
      different Nostr clients while keeping the same profile, followers, and content. Unlike
      traditional social media platforms, your digital identity is not locked into a single company
      or controlled by a CEO.
    </p>
    <p>
      Learn more at <a href="https://nostr.org" target="_blank" rel="noreferrer">nostr.org</a>
    </p>
  </header>

  <section class="panel info-panel">
    <h2>This client uses</h2>
    <div class="nips-list">
      {#each activeNips as nip}
        <div class="nip-row">
          <strong><a href={appPath(`/${slugForNipId(nip.id)}`)}>{nip.id}</a></strong>
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
            <strong><a href={appPath(`/${slugForNipId(nip.id)}`)}>{nip.id}</a></strong>
            <span>{nip.description}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
