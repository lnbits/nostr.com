---
title: Clients
description: An overview of how Nostr clients work and a comparison of the available clients
---

Clients are the way that you access and interact with the Nostr protocol.

---

## What's a client?

A client in Nostr is just the app that you use to access and interact with the protocol. It's like the Twitter iOS app or web app that you use to interact with Twitter's feed of tweets.

Because the Nostr protocol is very simple and flexible, different clients have approached the protocol in different ways: some try to make the experience look exactly like Twitter, others try to highlight the importance of relays to the protocol and expose that to users, and others try to use heuristics and algorithms to ensure the maximum degree of censorship-resistance without burdening users too much.

## Can I switch clients?

Yes. Because a client is just a way to access the underlying data held by relays, you can switch clients or sign into as many clients as you'd like. As long as each client is looking at the same set of relays for their data, you'll see the same messages in each client.

## Should I enter my private key in the client?

Generally, it's better not to enter your private key into any client. Most clients that ask for private keys do their absolute best to keep your key secure but given the nature of software, there are always breaches, exploits, and bugs that could potentially expose your private key.

Remember, your private key is your identity in Nostr, so if it is compromised you'll lose your followers and will have to start from scratch rebuilding your identity.

## A few of our favorite clients

### Web

- [Coracle](https://coracle.social), an experimental client that uses custom heuristics for relay selection. [Check out our guide here](/clients/coracle).
- [Snort](https://snort.social), an easy-to-use client with simple onboarding.

### Desktop

- [Gossip](https://github.com/mikedilger/gossip), a native client that tries to efficiently follow people in wherever relay they happen to be. [Check out our guide here](/clients/gossip).

### iOS

- [Damus](https://apps.apple.com/app/damus/id1628663131), the first client for Nostr to be banned in China. [Check out our guide here](/clients/damus).

### Android

- [Nostros](https://github.com/KoalaSat/nostros/releases), a feature-complete client with experimental relay tricks. [Check out our guide here](/clients/nostros).
- [Amethyst](https://play.google.com/store/apps/details?id=com.vitorpamplona.amethyst), a feature-complete client.
- [Nozzle](https://github.com/kaiwolfram/Nozzle/releases), a relay-first fast and efficient client, work-in-progress.
