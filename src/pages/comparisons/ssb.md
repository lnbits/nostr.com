---
title: Why isn't SSB good enough?
pageTitle: SSB vs Nostr
description: What are the problems of SSB that Nostr solves?
---

## Good Ideas

SSB is the first relatively successful social-networking protocol using public-keys that had any traction, it showed the way to Nostr.

## Problems

1. Because it is optimized for "local" social networks -- i.e. people that actually meet each other, SSB has some design choices around the structuring of each person's feed (each note must reference the previous one in a single chain of events) to make it easy to sync. These choices are actually very limiting in practice and contributed for SSB to not gain the adoption it deserved.
1. For the same reason above, SSB has a the UX problem of not allowing people to hold the same identity in multiple devices and apps, which drastically limits its scope and scale.
1. Moreover, since sharing feeds on the internet is an afterthought for SSB, it is really hard to get started and browse others' feeds, and thus to gain traction outside of well-established closed groups of interest.
1. The protocol is unnecessarily complex.
