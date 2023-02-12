---
title: Why isn't Mastodon good enough?
pageTitle: Mastodon vs Nostr
description: What are the problems of Mastodon that Nostr solves?
---

Mastodon is an implementation of the ActivityPub protocol. Everything said here is equally valid for other implementations.

---

Mastodon looked like a great initiative for decentralizating social media a decade ago when the internet was friendlier and server owners could be trusted to be cooperative, but it doesn't really address the crucial issue of censorship.

## Problems

1. User identities are attached to domain names which are controlled by third-parties.
1. These third-parties can ban you, just like centralized social media platforms. Server owners can also block other servers.
1. Migration between servers is difficult and can only be accomplished if servers cooperate.
1. The ActivityPub protocol is complex and hard to implement. No one really implements it in full, most servers just try to be compatible with whatever Mastodon does, and even then it is not efficient.
1. There are no clear incentives to run servers, therefore they tend to be run by enthusiasts and people who want to have their name attached to a cool domain. Because of this, users are subject to the despotism of a single person, which is often worse than that of a big company like Twitter, and they can't migrate out.
1. Since servers tend to be run by amateurs, they are often abandoned. This effectively bans everybody that signed up via that server.
1. There are huge issues with data duplication across servers.

## Good Ideas

One good idea Nostr takes from Mastodon is that it uses a network of servers, and therefore users don't have to run the servers themselves. More than that, these servers generally have their own _characters_, and they're run and used by people who think alike, have thematic friendly conversations. These are properties that can be replicated on Nostr relays without compromising any of the other Nostr features.
