---
title: Relay Implementations
description: A list of Nostr relay implementations
---

This is a list of all known implementations of the Nostr relay spec. You only need this if you're planning on running a relay yourself.

---

## Relays

Relays are (so far) application agnostic. You can run your own or use any or all of the public instances.

### Most used in the wild

- [nostr-rs-relay](https://sr.ht/~gheartsfield/nostr-rs-relay/), a minimalistic, optimized relay written in Rust that uses SQLite.
- [nostream](https://github.com/Cameri/nostream), A Nostr relay written in Typescript backed by PostgreSQL and Redis, optimized for load-balancing and fault-tolerance.
- [me.untethr.nostr-relay](https://github.com/atdixon/me.untethr.nostr-relay), a very strict and performant relay written in Clojure, uses SQLite.
- [strfry](https://github.com/hoytech/strfry), a very performant relay written in C++, uses LMDB for data storage and comes with a built-in set-reconciliation mechanism for syncing.

### Other implementations

- [Relayer Basic](https://github.com/fiatjaf/relayer/tree/master/basic), a simple reference relay backed by Postgres, written as a demo on top of the [Relayer](https://github.com/fiatjaf/relayer) Go framework for building custom relays.
- [NNostr](https://github.com/Kukks/NNostr), a relay written in C#.
- [søstr](https://github.com/metasikander/s0str), a Nostr relay designed for a single writer pubkey.
- [Minds Nostr Relay](https://gitlab.com/minds/infrastructure/nostr-relay), a relay for [Minds](https://www.minds.com), an open-source social network.
- [nostr_relay](https://code.pobblelabs.org/fossil/nostr_relay/), a Nostr relay written in python, backed by SQLite.
- [LNbits Relay](https://github.com/lnbits/nostr-relay-extension), a relay you can launch in your own LNBits server with a click, wrapper over [nostr_relay](https://code.pobblelabs.org/fossil/nostr_relay/).
- [NostrPostr Relay](https://github.com/Giszmo/NostrPostr/tree/master/NostrRelay), a relay written in Kotlin, supports both SQLite and PostgreSQL.
- [knostr](https://github.com/lpicanco/knostr), A Nostr relay implemented in Kotlin with support for Postgres and metrics.
