---
title: Get started
description: How to get started using Nostr
---

A step-by-step guide to getting started with Nostr.

---

## Understanding keys

Each Nostr account is based on a public/private key pair. A simple way to think about this is that your public key is your username and your private key is your password, with one major caveat. Unlike a password, your private key cannot be reset if lost.

The public key is generally presented as a string with the prefix `npub1` and the private key with the prefix `nsec1`. Make sure you store you private key somewhere safe, like a password manager.

## Protocol vs Client

Nostr itself is just a protocol; an agreed upon procedure for passing messages around on the internet.

You will access Nostr (the protocol) via a client. Clients can be web, desktop, or mobile apps. Clients can fetch data from relays and also generate new data and push that to relays so others can read.

The only form of "data" that exists in Nostr is the [`event`](/the-protocol/event).

### Signing events

These events must contain a signature (`sig`). The signature ensures that it can be proven mathematically that they were created by whoever happens to be their true author.

To be able to construct the signature, clients will need your private key. Native apps will generally have a place where you can paste your private key when first opening them. From the private key they can derive your public key too.

For web apps it is not recommended to paste the private key, we instead recomment using a browser extension that implements the [Nostr-related functionality](https://nips.be/7) that allows web clients to use your keys without ever learning them. Some examples include [Flamingo](https://www.getflamingo.org/), [Alby](https://getalby.com) and [nos2x](https://github.com/fiatjaf/nos2x).

## Let's do this!

Here are guides to a few different clients we recommend.

- [Coracle](/clients/coracle) (Web)
- [Damus](/clients/damus) (iOS)
- [Gossip](/clients/gossip) (Desktop)
- [Nostros](/clients/nostros) (Android)

## Find friends to follow

- If you are a Twitter user, you can use [nostr.directory](https://nostr.directory) to find Twitter people that you follow that have linked their Twitter accounts to Nostr public keys. [Snort](https://snort.social) also does a seamless import of followers on your behalf.
- Otherwise, you can just start following a dozen of prominent Nostr keys, for example, by checking [nostr.band](https://nostr.band) and looking at their interactions, replies and so on.

## Can I use other clients?

Yes! Now that you have created your public/private key pair, you can use this pair on any Nostr client to access your account. Remember, the client is just an interface to see messages broadcast on the Nostr protocol.

Since it's so early in Nostr's development, not all clients support all protocol features in the same way. It's worth checking out our [clients page](/clients) to find the best client for you, or jump into the chaos of all the other available clients at [nostr.net](https://nostr.net).
