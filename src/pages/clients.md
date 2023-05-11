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

- [Snort](https://snort.social), an easy-to-use client with great onboarding.
- [Coracle](https://coracle.social), an experimental client that is advancing the UX and internals of social media. [Check out our guide here](/clients/coracle).
- [Iris](https://iris.to), a client that throws you in instantly.
- [Yosup](https://yosup.app), a minimalistic client.
- [Primal](https://primal.net), a very fast client that relies on server-side caching.

### iOS

- [Nos](https://nos.social), a beautiful and safe client for non-bitcoiners.
- [Damus](https://apps.apple.com/app/damus/id1628663131), the first client for Nostr to be banned in China. [Check out our guide here](/clients/damus).

### iOS and Android

- [Plebstr](https://plebstr.com), a closed-source client that is beautiful, fast and smooth.
- [Current](https://app.getcurrent.io/), a client that comes with a built-in Bitcoin wallet.

### Android

- [Nostros](https://github.com/KoalaSat/nostros/releases), a feature-complete client with experimental relay tricks. [Check out our guide here](/clients/nostros).
- [Amethyst](https://play.google.com/store/apps/details?id=com.vitorpamplona.amethyst), a client that has all the features you might imagine.
- [Camelus](https://camelus.app), a very lean client with good fundamentals, but still a work-in-progress.
- [Nozzle](https://github.com/kaiwolfram/Nozzle/releases), a very lean client, but still a work-in-progress.

### Desktop

- [Gossip](https://github.com/mikedilger/gossip), a native client that tries to efficiently follow people in wherever relay they happen to be, made in Rust with egui. [Check out our guide here](/clients/gossip).
- [more-speech](https://github.com/unclebob/more-speech), a client that gives you a powerful global view and way of interacting with custom filtering based on web-of-trust and relay selection, made in Clojure. [Check out a guide here](https://www.youtube.com/watch?v=q3gQ42aUhls).
- [Lume](https://uselume.xyz), an ambitious client running with Tauri.
