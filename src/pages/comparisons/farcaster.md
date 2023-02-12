---
title: Why isn't Farcaster good enough?
pageTitle: Farcaster vs Nostr
description: What are the problems of Farcaster that Nostr solves?
---

Farcaster is a social network protocol that uses the Ethereum blockchain for its identity system.

Farcaster is highly centralized. Its development is lead entirely by one company with a huge amount of funds to burn in the process and the network is invite-only. That is a temporary measure for what they intend the network to become in the future, but the centralization is already showing its issues:

In the beginning its architecture looked similar to Nostr's, but they wanted "hubs" -- their own version of "relays" -- to actually store the entirety of the data produced in the network.

After realizing that wouldn't be possible, they decided to come up with a very complicated scheme to turn the "hubs" into actual nodes in a consensus protocol that involves data syncing of multiple sharded graphs.
