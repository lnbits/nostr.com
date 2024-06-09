---
title: Events
description: The basic atomic unit on the Nostr protocol
---

Events are the atomic unit of the Nostr protocol. This is a short overview of various types of events.

---

## What is an Event?

Events are the only object type on the Nostr network. Here is one example:

```json
{
  "id": "4376c65d2f232afbe9b882a35baa4f6fe8667c4e684749af565f981833ed6a65",
  "pubkey": "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93",
  "created_at": 1673347337,
  "kind": 1,
  "content": "Walled gardens became prisons, and nostr is the first step towards tearing down the prison walls.",
  "tags": [
    ["e", "3da979448d9ba263864c4d6f14984c423a3838364ec255f03c7904b1ae77f206"],
    ["p", "bf2376e17ba4ec269d10fcc996a4746b451152be9031fa48e74553dde5526bce"]
  ],
  "sig": "908a15e46fb4d8675bab026fc230a0e3542bfade63da02d542fb78b2a8513fcd0092619a2c8c1221e581946e0191f2af505dfdf8657a414dbca329186f009262"
}
```

The event above has kind `1`, which means it is a "text note", i.e. a normal, simple, short, plaintext note, intended to be used in Twitter-like feeds, replies and comments.

Each `kind` number means something. For example, `0` is a "metadata" event, used for users to give details about themselves, such as their name and a profile picture. Relays can give different treatment to different kinds. For example, relays will generally delete older versions of `kind:0` events and keep only the last one, while they will generally keep multiple `1` for each key.

You generally don't need more than kinds `0` and `1` to build a basic social-networking Nostr app, but other kinds were invented out of necessity by clients to provide other functionalities. They are specified in the [NIPs](/the-protocol/nips). Some kinds are unrelated to social-networking and serve other needs from clients specific to these other functionalities. The idea is that, for each new use case one can think of in Nostr, a subprotocol must be thought about and proposed as a NIP, for maximum interoperability with existing and future clients that may be interested in implementing that functionality -- while also ensuring backwards-compatibility and nice fallbacks for everything that exists and does not want to change.

The `created_at` property is a UNIX timestamp set by the event creator, normally to the time it was created. While there are no checks made against that, that is not a problem.

The `content` is dependent of what the `kind` means. In the case of `kind:1`, it is just a plaintext string meant to be read by others.

Similarly, `tags` also dependent on the `kind`, but some common tags that usually show up in `kind:1` events but also in other kinds are `"p"`, which is used to mention a public key, and `"e"`, used to refer to another event.
