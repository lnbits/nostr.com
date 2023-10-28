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
- [Coracle](https://coracle.social), an experimental client that is advancing the UX and internals of social media.
- [noStrudel](https://nostrudel.ninja), a chaotically good client that has everything and more, very fast.
- [Satellite](https://satellite.earth), a client with excellent views for threaded conversations.
- [Iris](https://iris.to), a client that throws you in instantly.
- [nos.today](https://nos.today/), a small client that just provides search.

### iOS

- [Damus](https://damus.io), the first Nostr client to be banned in China.
- [Nos](https://nos.social), a beautiful and safe client for non-bitcoiners.
- [Nostur](https://nostur.com), a feature-complete client.

### iOS and Android

- [Plebstr](https://plebstr.com), a closed-source client that is beautiful, fast and smooth.
- [Primal](https://primal.net/downloads), a very fast client that relies on server-side caching.
- [Current](https://app.getcurrent.io/), a client that comes with a built-in Bitcoin wallet.
- [ZBD](https://zbd.gg), a custodial, hosted client for ZBD users.

### Android

- [Yana](https://github.com/frnandu/yana/releases), a smooth and fully-featured multi-platform client.
- [Spring](https://spring.site/), a client for safely using web clients on your Android.
- [Amethyst](https://play.google.com/store/apps/details?id=com.vitorpamplona.amethyst), a client that has all the features you might imagine.
- [Nozzle](https://github.com/dluvian/Nozzle/releases), a very lean client, but still a work-in-progress.
- [Plasma](https://github.com/plasma-social/plasma/releases/tag/v0.0.29), an early-stage native Android client.

### Desktop

- [Gossip](https://github.com/mikedilger/gossip), a native client that tries to efficiently follow people in wherever relay they happen to be, made in Rust with egui.
- [more-speech](https://github.com/unclebob/more-speech), a client that gives you a powerful global view and way of interacting with custom filtering based on web-of-trust and relay selection, made in Clojure. [Check out a guide here](https://www.youtube.com/watch?v=q3gQ42aUhls).
- [Lume](https://lume.nu), an ambitious client made with Tauri.

### Non-microblogging clients

- [zap.stream](https://zap.stream), a video livestreaming browser and hosting platform.
- [Yakihonne](https://yakihonne.com), an app for reading, writing and curating long-form articles.
- [Highlighter](https://highlighter.com/), an app for annotating and curating content.
- [Habla.news](https://habla.news), an app for reading and writing long-form articles.
- [wikistr](https://wikistr.com), an early-stage decentralized Wikipedia replacement.
