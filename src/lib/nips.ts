export type NipInfo = {
  id: string;
  code: string;
  slug: string;
  title: string;
  summary: string;
  paragraphs: string[];
  sourceUrl: string;
};

const summaries: Record<string, { title: string; summary: string }> = {
  '01': {
    title: 'Basic protocol flow',
    summary: 'NIP-01 is the foundation of Nostr. It explains how apps create signed messages called events, how relays store and send those events, and how clients ask relays for the data they need.'
  },
  '02': {
    title: 'Follow lists',
    summary: 'NIP-02 describes how your follow list is stored on Nostr. It lets clients understand who you follow and move that social graph between apps instead of locking it inside one service.'
  },
  '03': {
    title: 'OpenTimestamps attestations',
    summary: 'NIP-03 lets a Nostr event be linked to an independent timestamp proof. That can help show that a note or record existed at a certain time.'
  },
  '04': {
    title: 'Encrypted direct messages',
    summary: 'NIP-04 describes an older way to send private messages between two people. It encrypts the message text, but newer messaging NIPs are preferred because they protect more metadata.'
  },
  '05': {
    title: 'Human-readable identifiers',
    summary: 'NIP-05 lets a public key be connected to a familiar address like alice@example.com. It makes accounts easier to recognize without asking people to compare long strings of letters and numbers.'
  },
  '06': {
    title: 'Seed phrase key generation',
    summary: 'NIP-06 explains how a Nostr private key can be created from a mnemonic seed phrase. This gives wallets and apps a shared way to restore the same identity from backup words.'
  },
  '07': {
    title: 'Browser extension signing',
    summary: 'NIP-07 lets a browser extension hold your Nostr key and sign events for websites. The website can publish as you without directly seeing or storing your private key.'
  },
  '08': {
    title: 'Mentions',
    summary: 'NIP-08 described an older way to mention people and notes inside text. Newer Nostr clients generally use NIP-27 for this job.'
  },
  '09': {
    title: 'Deletion requests',
    summary: 'NIP-09 lets a user publish a request asking relays and clients to treat one of their previous events as deleted. It is a public request, not a guarantee that every copy disappears.'
  },
  '10': {
    title: 'Text notes and threads',
    summary: 'NIP-10 explains how short notes point to replies, roots, and mentions. This is what lets clients build conversation threads instead of showing every note as isolated text.'
  },
  '11': {
    title: 'Relay information documents',
    summary: 'NIP-11 lets a relay publish a simple information document about itself. Apps can use it to learn what the relay supports, who runs it, and what limits or policies it has.'
  },
  '12': {
    title: 'Tag queries',
    summary: 'NIP-12 defines how clients can search relays by event tags. That makes it possible to ask for events connected to a person, topic, note, or other reference.'
  },
  '13': {
    title: 'Proof of work',
    summary: 'NIP-13 adds a way to attach proof-of-work difficulty to events. Relays and clients can use that as a spam-resistance signal when deciding what to accept or show.'
  },
  '14': {
    title: 'Subject tags',
    summary: 'NIP-14 adds a subject field for text events. It is useful when a note behaves more like an email, forum post, or titled discussion.'
  },
  '15': {
    title: 'Nostr marketplace',
    summary: 'NIP-15 describes marketplace listings and related events. It gives apps a common way to represent products, stalls, and commerce activity on Nostr.'
  },
  '16': {
    title: 'Event treatment',
    summary: 'NIP-16 explains special event lifetimes, such as replaceable and ephemeral events. This lets some data update cleanly while other data remains as a normal historical record.'
  },
  '17': {
    title: 'Private direct messages',
    summary: 'NIP-17 describes modern private messages using wrapped events. It helps keep message contents private while making direct messages work more consistently across clients.'
  },
  '18': {
    title: 'Reposts',
    summary: 'NIP-18 defines how someone can repost another event. It gives clients a shared way to show boosts, shares, and repost counts.'
  },
  '19': {
    title: 'Readable Nostr identifiers',
    summary: 'NIP-19 defines readable identifiers like npub, nsec, note, nevent, and nprofile. These make Nostr keys and events safer to copy, paste, and share.'
  },
  '20': {
    title: 'Command results',
    summary: 'NIP-20 standardizes how relays reply when a client publishes something. It lets apps show clearer success and error messages instead of guessing what happened.'
  },
  '21': {
    title: 'nostr: links',
    summary: 'NIP-21 defines nostr: links for profiles, notes, and other Nostr objects. These links let websites and apps open Nostr content in a compatible client.'
  },
  '22': {
    title: 'Comments',
    summary: 'NIP-22 defines a general comment format. It lets apps attach comments to Nostr events or external content in a way other clients can understand.'
  },
  '23': {
    title: 'Long-form content',
    summary: 'NIP-23 describes long articles and blog-style posts on Nostr. It gives writers a portable format for publishing longer pieces outside a central platform.'
  },
  '24': {
    title: 'Extra profile metadata',
    summary: 'NIP-24 adds common profile fields beyond the basics, such as display names, banners, websites, and other details that make profiles richer.'
  },
  '25': {
    title: 'Reactions',
    summary: 'NIP-25 defines reactions such as likes. It gives clients a common way to count and display lightweight responses to notes and other events.'
  },
  '26': {
    title: 'Delegated event signing',
    summary: 'NIP-26 describes how one key can delegate limited signing rights to another key. This can support special workflows, but it is not widely recommended for everyday use.'
  },
  '27': {
    title: 'Text note references',
    summary: 'NIP-27 explains how mentions and links to profiles or notes can appear inside note text. Clients use it to turn plain text references into clickable Nostr links.'
  },
  '28': {
    title: 'Public chat',
    summary: 'NIP-28 defines public chat channels and messages. It gives Nostr clients a shared structure for chat rooms that are visible to anyone.'
  },
  '29': {
    title: 'Relay-based groups',
    summary: 'NIP-29 describes groups managed by relays. It lets communities have membership, moderation, and group-specific conversations while still using Nostr events.'
  },
  '30': {
    title: 'Custom emoji',
    summary: 'NIP-30 lets users and communities define custom emoji. Clients can then render short emoji codes as images in notes and profiles.'
  },
  '31': {
    title: 'Unknown event kinds',
    summary: 'NIP-31 explains how clients should handle event types they do not recognize. This helps Nostr evolve without older apps breaking or misrepresenting new data.'
  },
  '32': {
    title: 'Labels',
    summary: 'NIP-32 defines labels that can be attached to content or users. Labels can support moderation, content warnings, topics, and other classification systems.'
  },
  '33': {
    title: 'Parameterized replaceable events',
    summary: 'NIP-33 lets a user publish named records that can be updated over time. It is useful for profiles, lists, articles, and app data where the latest version matters.'
  },
  '34': {
    title: 'Git collaboration',
    summary: 'NIP-34 describes how git repositories, issues, patches, and related development activity can be represented on Nostr.'
  },
  '35': {
    title: 'Torrents',
    summary: 'NIP-35 defines torrent-related events. It gives clients a common way to share torrent metadata and discovery information through Nostr.'
  },
  '36': {
    title: 'Sensitive content warnings',
    summary: 'NIP-36 lets a note mark itself as sensitive or attach a content warning. Clients can use that signal to blur, hide, or label content before showing it.'
  },
  '37': {
    title: 'Draft wraps',
    summary: 'NIP-37 describes a way to save encrypted draft events. It helps users keep drafts portable without exposing unfinished private content to relays.'
  },
  '38': {
    title: 'User statuses',
    summary: 'NIP-38 lets users publish short status information, such as availability or what they are currently doing. Clients can show it near a profile or chat presence.'
  },
  '39': {
    title: 'External identities',
    summary: 'NIP-39 lets a profile claim identities from other platforms. It can help people connect a Nostr account with accounts they already recognize elsewhere.'
  },
  '40': {
    title: 'Expiration timestamps',
    summary: 'NIP-40 lets an event say when it should expire. Relays and clients can use that timestamp to stop showing temporary content after it is no longer relevant.'
  },
  '42': {
    title: 'Relay authentication',
    summary: 'NIP-42 lets a relay ask a client to prove which Nostr key it controls. This supports private relays, paid relays, and relay features that require identity.'
  },
  '43': {
    title: 'Relay access requests',
    summary: 'NIP-43 describes metadata and requests around relay access. It helps clients understand how a relay handles admission, payment, or other access rules.'
  },
  '44': {
    title: 'Versioned encryption',
    summary: 'NIP-44 defines a modern encrypted payload format. It gives Nostr apps a safer shared way to encrypt private content between users.'
  },
  '45': {
    title: 'Event counts',
    summary: 'NIP-45 lets clients ask relays for counts instead of full event lists. That is useful for showing reply, reaction, repost, or search totals efficiently.'
  },
  '46': {
    title: 'Bunker / Remote signing',
    summary: 'NIP-46 lets one app ask another signer to approve and sign Nostr events. This supports bunker-style login, where your private key stays outside the website using it.'
  },
  '47': {
    title: 'Nostr Wallet Connect',
    summary: 'NIP-47 lets apps request Lightning wallet actions through Nostr. It can power payments, invoices, and wallet interactions without embedding wallet credentials in every app.'
  },
  '48': {
    title: 'Proxy tags',
    summary: 'NIP-48 defines tags for content that is mirrored or proxied from somewhere else. It helps clients understand where content came from and how to reference it.'
  },
  '49': {
    title: 'Private key encryption',
    summary: 'NIP-49 describes how to encrypt a private key with a password. This helps people back up or transfer keys without storing them as plain text.'
  },
  '50': {
    title: 'Search',
    summary: 'NIP-50 lets relays advertise and handle search queries. Clients can use it to find profiles, notes, and other content without relying on one central search service.'
  },
  '51': {
    title: 'Lists',
    summary: 'NIP-51 defines common list formats, such as mute lists, bookmarks, pinned notes, and relay sets. Lists make personal preferences portable between clients.'
  },
  '52': {
    title: 'Calendar events',
    summary: 'NIP-52 describes calendar events on Nostr. It gives apps a shared way to publish meetups, appointments, and schedules.'
  },
  '53': {
    title: 'Live activities',
    summary: 'NIP-53 defines live activities such as streams or live rooms. It helps clients discover what is happening now and show related chat or participation.'
  },
  '54': {
    title: 'Wiki',
    summary: 'NIP-54 describes wiki pages and edits on Nostr. It supports collaborative knowledge pages that can be read and updated across compatible clients.'
  },
  '55': {
    title: 'Android signer apps',
    summary: 'NIP-55 lets Android apps ask a separate signer app to approve Nostr actions. This keeps the private key in one trusted app instead of sharing it with every client.'
  },
  '56': {
    title: 'Reporting',
    summary: 'NIP-56 defines reports for spam, abuse, impersonation, and other problems. Clients and relays can use reports as signals for moderation and safety tools.'
  },
  '57': {
    title: 'Lightning zaps',
    summary: 'NIP-57 describes zaps, which are Lightning payments connected to Nostr events or profiles. It lets people send money and public payment reactions through Nostr.'
  },
  '58': {
    title: 'Badges',
    summary: 'NIP-58 defines badges that can be awarded to users. Badges can represent achievements, memberships, credentials, or other social signals.'
  },
  '59': {
    title: 'Gift wrap',
    summary: 'NIP-59 wraps private events so relays can carry them without seeing the inner message. It is an important part of modern private messaging on Nostr.'
  },
  '5A': {
    title: 'Static websites',
    summary: 'NIP-5A describes nsites, a way to publish static websites through Nostr-related infrastructure. It helps make web content more portable and censorship-resistant.'
  },
  '60': {
    title: 'Cashu wallets',
    summary: 'NIP-60 defines how Cashu wallet information can be represented on Nostr. It supports ecash wallets that can move between compatible apps.'
  },
  '61': {
    title: 'Nutzaps',
    summary: 'NIP-61 describes zaps using Cashu ecash. It offers another way to send value on Nostr without relying only on standard Lightning zap flows.'
  },
  '62': {
    title: 'Request to vanish',
    summary: 'NIP-62 lets a user ask relays to remove their events. Like deletion requests, it is a request that cooperative relays can honor, not a universal eraser.'
  },
  '64': {
    title: 'Chess games',
    summary: 'NIP-64 describes chess games using portable game notation. It lets Nostr clients publish, follow, and display chess matches.'
  },
  '65': {
    title: 'Relay list metadata',
    summary: 'NIP-65 lets users publish which relays they read from and write to. This helps other clients find a user’s content without guessing blindly.'
  },
  '66': {
    title: 'Relay discovery and liveness',
    summary: 'NIP-66 defines ways to monitor and share relay availability. Clients can use it to choose healthier relays and improve network reliability.'
  },
  '68': {
    title: 'Picture-first feeds',
    summary: 'NIP-68 defines event formats for image-focused posts. It helps clients build feeds where photos or visual media are the main object.'
  },
  '69': {
    title: 'Peer-to-peer orders',
    summary: 'NIP-69 describes order events for peer-to-peer trading. It gives apps a common structure for offers, orders, and marketplace coordination.'
  },
  '70': {
    title: 'Protected events',
    summary: 'NIP-70 lets clients mark events as protected. Relays and clients can use that marker to limit unwanted copying or display in certain contexts.'
  },
  '71': {
    title: 'Video events',
    summary: 'NIP-71 describes video posts and video metadata. It gives clients a shared way to publish and display video content on Nostr.'
  },
  '72': {
    title: 'Moderated communities',
    summary: 'NIP-72 describes community spaces with moderators and approved posts. It supports Reddit-style communities while keeping content in the Nostr protocol.'
  },
  '73': {
    title: 'External content IDs',
    summary: 'NIP-73 defines references to content outside Nostr, such as URLs, books, movies, or other media IDs. It helps Nostr discussions point to the same outside object.'
  },
  '75': {
    title: 'Zap goals',
    summary: 'NIP-75 defines fundraising or payment goals that can receive zaps. Clients can show progress toward a target and connect contributions to a goal.'
  },
  '77': {
    title: 'Negentropy syncing',
    summary: 'NIP-77 describes an efficient way for clients and relays to compare sets of events. It helps sync missing data without downloading everything again.'
  },
  '78': {
    title: 'Custom app data',
    summary: 'NIP-78 lets apps store their own custom data on Nostr. It can support settings, preferences, or app-specific records that follow the user between devices.'
  },
  '7D': {
    title: 'Threads',
    summary: 'NIP-7D defines a dedicated thread format. It gives clients another way to represent structured conversations beyond simple reply chains.'
  },
  '84': {
    title: 'Highlights',
    summary: 'NIP-84 describes highlighted quotes or excerpts. It lets users save and share meaningful snippets from articles, books, or other content.'
  },
  '85': {
    title: 'Trusted assertions',
    summary: 'NIP-85 defines statements that one party can make about another account or object. These assertions can support reputation, verification, and trust signals.'
  },
  '86': {
    title: 'Relay management API',
    summary: 'NIP-86 lets relay operators manage relay behavior through an API. It is mainly useful for administration tools rather than everyday users.'
  },
  '87': {
    title: 'Ecash mint discovery',
    summary: 'NIP-87 helps users and apps discover Cashu ecash mints. It gives wallet software a shared way to find and describe mint services.'
  },
  '88': {
    title: 'Polls',
    summary: 'NIP-88 describes polls and votes on Nostr. It lets clients create and display surveys without a central polling service.'
  },
  '89': {
    title: 'Recommended app handlers',
    summary: 'NIP-89 lets people and apps recommend which clients handle certain kinds of Nostr events well. It helps users open content in an appropriate app.'
  },
  '90': {
    title: 'Data vending machines',
    summary: 'NIP-90 defines a marketplace for requesting and paying for computation or data processing. It can support AI jobs, media processing, and other paid tasks.'
  },
  '92': {
    title: 'Media attachments',
    summary: 'NIP-92 describes metadata for attached media such as images, videos, and files. Clients use it to show previews, alt text, dimensions, and fallback URLs.'
  },
  '94': {
    title: 'File metadata',
    summary: 'NIP-94 defines events that describe uploaded files. It helps clients share file URLs, hashes, MIME types, and other useful file details.'
  },
  '96': {
    title: 'HTTP file storage',
    summary: 'NIP-96 described a way for Nostr clients to upload files to HTTP storage services. Newer Blossom-based approaches are generally preferred.'
  },
  '98': {
    title: 'HTTP authentication',
    summary: 'NIP-98 lets a Nostr key sign HTTP requests. Services can use that signature to know which Nostr user is making an upload or API request.'
  },
  '99': {
    title: 'Classified listings',
    summary: 'NIP-99 describes classified ads and listings. It gives apps a common way to publish offers, wants, and marketplace posts.'
  },
  A0: {
    title: 'Voice messages',
    summary: 'NIP-A0 describes voice messages on Nostr. It gives clients a shared way to attach and display short audio messages.'
  },
  A4: {
    title: 'Public messages',
    summary: 'NIP-A4 defines public message events. It supports chat-like public communication that can be understood by compatible clients.'
  },
  B0: {
    title: 'Web bookmarking',
    summary: 'NIP-B0 describes bookmark events for web pages. It lets users save and share links in a portable way.'
  },
  B7: {
    title: 'Blossom media',
    summary: 'NIP-B7 describes Blossom media storage. It helps Nostr clients upload, reference, and manage media files through compatible servers.'
  },
  BE: {
    title: 'Bluetooth Low Energy communication',
    summary: 'NIP-BE describes how Nostr-related communication can happen over Bluetooth Low Energy. It is useful for local or device-to-device scenarios.'
  },
  C0: {
    title: 'Code snippets',
    summary: 'NIP-C0 describes code snippet events. It lets developers publish and share small pieces of code with language and metadata hints.'
  },
  C7: {
    title: 'Chats',
    summary: 'NIP-C7 describes chat-style conversations. It gives clients a shared structure for messages that feel closer to chat than public timeline posts.'
  },
  EE: {
    title: 'MLS encrypted messaging',
    summary: 'NIP-EE described end-to-end encrypted group messaging using the Messaging Layer Security protocol. It has been superseded by other work.'
  }
};

const expandedSummaries: Record<string, string[]> = {
  '01': [
    'NIP-01 is the foundation that makes Nostr work. It explains the basic shape of a Nostr message, called an event, and how apps send those events to relays so other people can read them. If Nostr were a postal system, this NIP would describe what an envelope looks like, how it is signed, and how post offices should accept and deliver it.',
    'For a normal user, this is the reason your notes, replies, follows, and other activity can move between different Nostr apps. The apps may look different, but they agree on this basic format, so your identity and content are not trapped inside one company\'s database.'
  ],
  '02': [
    'NIP-02 explains how your follow list is stored on Nostr. Instead of one app secretly keeping the list of people you follow, your account can publish that list as a normal Nostr event that other clients understand.',
    'That means switching apps does not have to mean starting your social life from zero. It is a bit like carrying your address book with you: a new app can read who you follow and help rebuild your feed around the same people.'
  ],
  '04': [
    'NIP-04 is an older direct-message format. It encrypts the text of a private message so only the sender and receiver should be able to read it, but it does not hide as much surrounding information as newer private-message designs.',
    'You can think of it as putting a note inside a locked box, while still leaving the box shape and delivery route fairly visible. It was useful early on, but modern Nostr clients usually prefer newer private messaging NIPs when they can.'
  ],
  '05': [
    'NIP-05 lets a Nostr public key be connected to a human-readable name like alice@example.com. Without this, people would have to recognize each other by long public keys, which is a bit like asking everyone to memorize a bank-card number instead of a name.',
    'The identifier does not replace your Nostr key, but it makes discovery and trust easier. When a client verifies a NIP-05 address, it is checking that the domain owner has published a file saying this name belongs to this public key.'
  ],
  '07': [
    'NIP-07 lets a browser extension act as your Nostr signer. The website can ask the extension to identify you or sign an event, but the private key stays inside the extension instead of being typed into every site you visit.',
    'A simple analogy is a chip-and-PIN card reader: the shop asks for approval, but it does not get to keep your card secret. This makes web clients more convenient while reducing the chance that a random website stores your private key.'
  ],
  '09': [
    'NIP-09 defines deletion requests. If you publish something and later want it removed, your client can publish a new signed event saying which older event you want relays and clients to treat as deleted.',
    'This is more like asking libraries to stop shelving a book than magically erasing every copy on earth. Cooperative relays and clients can honor the request, but anything already copied elsewhere may still exist.'
  ],
  '10': [
    'NIP-10 explains how text notes connect to each other as replies, threads, and mentions. It gives clients a shared way to say “this note replies to that note” or “this note is part of this conversation.”',
    'For users, this is what turns a pile of separate posts into a readable discussion. Without it, a client would struggle to know which comment belongs under which original post.'
  ],
  '11': [
    'NIP-11 lets a relay publish an information document about itself. That document can include the relay name, description, contact details, supported features, limits, and policies.',
    'It is like a noticeboard on the front door of a relay. Before an app relies on that relay, it can read the noticeboard to understand what the relay can do and whether it has any special rules.'
  ],
  '15': [
    'NIP-15 describes marketplace data on Nostr, such as stalls, products, and listings. It gives shops and clients a shared language for publishing commerce information without one central marketplace owning the records.',
    'For a normal user, the idea is similar to sellers bringing their own catalog to a public market. Different apps can display the same listings, because the listing format is open and portable.'
  ],
  '17': [
    'NIP-17 is a modern private-message design for Nostr. It uses wrapped events so the private message can travel through relays while keeping the actual message content hidden from people who should not read it.',
    'The goal is to make direct messages feel normal for users while leaking less information than older approaches. It works with related encryption and wrapping NIPs to make private chats more portable between clients.'
  ],
  '18': [
    'NIP-18 defines reposts, which are Nostr\'s version of sharing or boosting someone else\'s event. Instead of copying the original text into a new post, the repost points back to the original event.',
    'That pointer matters because clients can count shares, show who boosted something, and still keep the original author and event clear. It is like saying “look at this” while handing people the original page, not a photocopy.'
  ],
  '19': [
    'NIP-19 defines friendly-looking Nostr identifiers such as npub, nsec, note, nevent, and nprofile. These are encoded forms of keys and event references that are easier and safer to copy than raw technical data.',
    'They work a bit like QR-code text or tracking numbers: still precise, but packaged for humans and apps to pass around. When someone shares an npub, a client can decode it and know exactly which public key it means.'
  ],
  '21': [
    'NIP-21 defines nostr: links, which let profiles, notes, and other Nostr objects be opened from websites or other apps. A link can point to a Nostr identity or event without depending on a single social-media website.',
    'For users, this is the difference between “open this on one company\'s site” and “open this in whatever Nostr app you prefer.” It helps Nostr content behave more like email links or phone links.'
  ],
  '24': [
    'NIP-24 adds extra profile fields and common tags. Basic Nostr profiles can say who you are, but this NIP helps clients understand richer details like display names, banners, websites, and other profile information.',
    'That makes profiles feel more complete across different apps. If one client lets you set a banner image, another client can read the same published metadata and show it too.'
  ],
  '25': [
    'NIP-25 defines reactions such as likes. A reaction is its own signed event that points at another event, which lets clients count and display responses without changing the original post.',
    'In everyday terms, it is the open-protocol version of pressing a like button. Because it is a Nostr event, other apps can see the reaction and show it in their own way.'
  ],
  '27': [
    'NIP-27 explains how Nostr references can appear inside note text. A note can include a mention of a person or another note, and clients can turn that reference into a useful link.',
    'This is what makes @mentions and quoted-note references feel natural. Instead of only showing a block of strange encoded text, a client can recognize the reference and help readers open the right profile or conversation.'
  ],
  '36': [
    'NIP-36 lets a post mark itself as sensitive or include a content warning. The author can signal that the content may need care before it is shown directly in a feed.',
    'Clients can then choose to blur, hide, label, or filter the post depending on user settings. It is similar to putting a warning label on a package before someone opens it.'
  ],
  '40': [
    'NIP-40 gives events an expiration timestamp. That lets a post or record say “this should stop being shown after this time,” which is useful for temporary announcements, offers, or short-lived status updates.',
    'It does not guarantee every copy disappears, but it gives cooperative relays and clients a clear instruction. Think of it like a flyer with an event date: after the date passes, most places stop displaying it.'
  ],
  '44': [
    'NIP-44 defines a modern encrypted payload format for Nostr. It gives apps a shared way to encrypt private content so only the intended people can read what is inside.',
    'For users, this is one of the building blocks behind safer private messages and other private data. It is less about a visible button and more about making sure different clients encrypt and decrypt in the same careful way.'
  ],
  '45': [
    'NIP-45 lets clients ask relays for counts instead of downloading all matching events. For example, an app can ask “how many replies are there?” without fetching every reply just to count them.',
    'That makes interfaces faster and lighter. It is like asking a librarian how many books match a topic before deciding whether you need the whole stack.'
  ],
  '46': [
    'NIP-46 describes remote signing, often called bunker-style signing. One app can ask a separate signer to approve Nostr actions, so the app you are using does not need to hold your private key directly.',
    'This is useful when you want to use a web app but keep your key somewhere more controlled. A simple analogy is letting a bank approve a payment request without giving the shop your bank password.'
  ],
  '50': [
    'NIP-50 describes relay search. A relay can advertise that it supports search queries, and clients can ask it to find profiles, notes, or other content matching a word or phrase.',
    'Search is hard in a decentralized system because there is no single master database. This NIP gives clients and relays a shared way to offer search without forcing everyone through one central service.'
  ],
  '51': [
    'NIP-51 defines portable lists, such as mute lists, bookmarks, pinned notes, and relay sets. Instead of keeping these preferences hidden inside one app, a user can publish them in a format other clients understand.',
    'That makes your preferences more like luggage you can take with you. If you switch clients, the new app can read your lists and give you a familiar experience much faster.'
  ],
  '56': [
    'NIP-56 defines reports for spam, abuse, impersonation, and other problems. A report is a signed event that points to the account or content being reported and says what kind of problem the reporter saw.',
    'Reports do not create one central moderator for all of Nostr. Instead, they provide signals that clients, relays, communities, or user tools can use when deciding what to filter or review.'
  ],
  '57': [
    'NIP-57 defines Lightning zaps, which are Bitcoin Lightning payments connected to Nostr profiles or events. A zap can be both a payment and a public signal of appreciation.',
    'For users, it feels like tipping someone for a post, podcast, project, or profile. The NIP explains how the payment request, receipt, and visible Nostr event fit together so different apps can show zaps consistently.'
  ],
  '59': [
    'NIP-59 defines gift wraps, a way to wrap private events before sending them through relays. The relay can carry the package, but it should not be able to see the private event inside.',
    'The analogy is close to sealed mail inside an outer envelope. The delivery system sees enough to move it along, while the real contents are protected for the intended recipient.'
  ],
  '65': [
    'NIP-65 lets a user publish their preferred read and write relays. In Nostr, people can use different relays, so clients need hints about where to look for someone\'s posts and where to publish replies.',
    'This is like leaving forwarding addresses for your Nostr identity. Other apps can use those relay hints to find your content more reliably instead of guessing at random relays.'
  ],
  '92': [
    'NIP-92 describes media attachment metadata. When a post includes an image, video, or file, this NIP lets the event include helpful details such as alt text, dimensions, hashes, and fallback URLs.',
    'That extra information improves the reading experience. Clients can lay out media better, show accessible descriptions, and verify or recover attachments more gracefully.'
  ],
  '94': [
    'NIP-94 defines file metadata events. These events describe uploaded files, including their URL, type, size, hash, and related information.',
    'For users, it helps files become more than mystery links. A client can understand what a file is before opening it, show useful previews, and connect uploads to Nostr posts or profiles.'
  ],
  '96': [
    'NIP-96 describes an older HTTP file-storage flow for Nostr clients. It gave apps a way to upload files to storage services and receive metadata that could be used in Nostr events.',
    'Newer media-storage approaches are generally preferred now, but this NIP is still useful context for understanding how Nostr clients have handled uploads. It is part of the story of making media portable rather than tied to one app.'
  ],
  '98': [
    'NIP-98 lets a Nostr key sign HTTP requests. A website or upload service can check that signature to know which Nostr user is making the request, without needing a normal username and password.',
    'This is useful for actions like uploading media or calling an API as your Nostr identity. It is like showing a signed permission slip instead of creating a separate account for every service.'
  ]
};

function defaultParagraphs(id: string, title: string, summary: string) {
  if (/older|deprecated|superseded|preferred/i.test(summary)) {
    return [
      summary,
      `This page is still useful because older or superseded NIPs explain why some clients behave the way they do. Even when the wider Nostr ecosystem moves toward newer designs, understanding ${id} helps people recognize legacy content and see how the protocol has evolved.`
    ];
  }

  return [
    summary,
    `${id} is one of the small agreements that lets different Nostr apps understand the same kind of activity. In everyday terms, it is like agreeing on the shape of a form: once everyone uses the same form for ${title.toLowerCase()}, people can move between apps without losing the meaning of what they created.`
  ];
}

export const nips: NipInfo[] = Object.entries(summaries).map(([code, info]) => ({
  id: `NIP-${code}`,
  code,
  slug: `nip${code.toLowerCase()}`,
  title: info.title,
  summary: info.summary,
  paragraphs: expandedSummaries[code] ?? defaultParagraphs(`NIP-${code}`, info.title, info.summary),
  sourceUrl: `https://github.com/nostr-protocol/nips/blob/master/${code}.md`
}));

export const nipBySlug = Object.fromEntries(nips.map((nip) => [nip.slug, nip]));
export const nipById = Object.fromEntries(nips.map((nip) => [nip.id, nip]));

export function slugForNipId(id: string) {
  return id.toLowerCase().replace('-', '');
}
