---
title: What is Nostr?
pageTitle: Nostr, a simple protocol for decentralizing social media that has a chance of working
description: A guide to the simplest decentralized protocol that isn't peer-to-peer, therefore works.
---

Nostr is a simple, open protocol that enables global, decentralized, and censorship-resistant social media. {% .lead %}

{% quick-links %}

{% quick-link title="Get started" icon="installation" href="/get-started" description="Create an account and join thousands of others on Nostr." /%}

{% quick-link title="The protocol" icon="presets" href="/the-protocol" description="Learn more about how the Nostr protocol works and what makes it special." /%}

{% quick-link title="Find a client" icon="plugins" href="/clients" description="Find a client (app) for the web, iOS, Android, or Desktop." /%}

{% quick-link title="Contribute" icon="theming" href="/contribute" description="Find out how you can help the Nostr protocol" /%}

{% /quick-links %}

---

## What is Nostr?

Nostr is a protocol, designed for simplicity, that aims to create a censorship-resistant global social network. Let's unpack that a little:

### Simple

The protocol is based on very simple & flexible `event` objects (which are passed around as plain JSON) and uses standard elliptic-curve cryptography for keys and signing. The only supported transport is websockets connections from clients to relays. This makes it easy to write clients and relays and promotes software diversity.

### Resilient

Because Nostr doesn't rely on a small number of trusted servers for moving or storing data, it's very resilient. The protocol assumes that relays will disappear and allows users to connect and publish to an arbitrary number of relays that they can change over time.

### Verifiable

Because Nostr accounts are based on public-key cryptography it's easy to verify messages were really sent by the user in question.

Like HTTP or TCP-IP, Nostr is a protocol; an open standard upon which anyone can build. Nostr is not an app or service that you sign up for.

## Why we need Nostr

Social media has developed into a key way information flows around the world. Unfortunately, our current social media systems are broken:

1. Uses your attention to sell ads
1. Uses bizarre techniques to keep you addicted (refer to point 1)
1. Decides what content to show you based on a secret algorithm that you can't inspect or change
1. Has complete control over who can participate and who is censored
1. Is overrun with spam and bots

See also the [comparisons with other alternative social media protocols](/comparisons).

## Recommended external content for learning about Nostr

- [Nostr, an Introduction](https://wiki.wellorder.net/post/nostr-intro/), by scsibug
- [Why I’m Betting Big on Nostr](https://hivemind.vc/nostr/), by Max Webster
- [Why Nostr Matters](https://blog.lopp.net/why-nostr-matters/), by Jameson Lopp
- [A vision for content discovery and relay usage](https://fiatjaf.com/3f106d31.html), by fiatjaf
- [Thoughts on relay browsing](https://blog.coracle.social/posts/2f375ecdcefa65f5d7d9ae5b74f3d276a6e2b2c9a4aafad50c48cc6be66407b2), by Jon Staab
- The [Thank God for Nostr podcast](https://tgfb.com/podcasts/thank-god-for-nostr/) is airing interesting Nostr-related interviews every week.

## Micro tools to help you navigate and use Nostr

- [nostr.band](https://nostr.band) is indexing the entirety of Nostr it can find and making it searchable.
- [nostr.watch](https://nostr.watch) has an index and connection stats of all public relays on the internet.
- [njump](https://njump.me) generates nice embeddable link previews for profiles and events and renders them.
- [Nostr Profile Manager](https://metadata.nostr.com/) lets you edit, backup and restore profile metadata, contacts and relay lists.
- [nostr army knife](https://nak.nostr.com/) and [NostrStuff](https://nostrstuff.com/) let you inspect Nostr identifiers, events and relays and convert between formats.
- [zaplife.lol](https://zaplife.lol/) shows a stream of zaps and zapped notes.
