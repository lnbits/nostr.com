---
title: The Protocol
description: Information on how the Nostr protocol works
---

Details on how the Nostr Protocol works and why

---

Nostr is very simple and yet very powerful.

There are no owners, no certification authorities, no central server with an API that requires access, it is just a _language that programs speak between each other_.

The language is basically a set of **WebSocket** messages that [clients](/clients) and [relays](/relays) exchange between each other. The messages often contain [events](/events), which are **JSON** documents (e.g. a tweet-like note), or _filters_, which are a description of what _events_ a _client_ is interested in receiving from the _relay_.

_Clients_ always act on behalf of users (they are the apps that users run on their devices), while _relays_ are servers that anyone can host.

_Clients_ connect to _relays_ and subscribe to _events_, and then _relays_ will send _events_ to the clients. What events? The events that other clients are publishing to these relays.

Finally, in order for clients to easily know who really authored each _event_ without having to trust the _relay_, they must always check the cryptographic signature contained in them, produced only by the _secret key_ of the signer.

---

If you are interested in the details and in how to learn to start developing Nostr applications, try reading [NIP-01](https://nips.nostr.com/1) directly.
