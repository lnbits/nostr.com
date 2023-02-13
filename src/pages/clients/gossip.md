---
title: Gossip (Desktop)
description: How to get started using Nostr on Desktop with Gossip
---

A step-by-step guide to getting started with Nostr with the Gossip desktop client.

---

## Initial Gossip set-up

1. Download a Gossip Linux binary or Windows installable from the [releases section](https://github.com/mikedilger/gossip/releases). ![](/images/gossip-install.png)
1. When you open the app, go to "You" and generate a keypaur (or import your private key if you already have one). ![](/images/gossip-create.png)
1. Now your keys are set, but you're not following anyone, so your "Feed" section will be empty

## Following people

1. Go to "People" > "Follow Someone New" ![](/images/gossip-follow.png)
1. There you can type a DNS ID, i.e. something like `"fiatjaf.com"` or `"jack@cash.app"`.
1. You can also specify an `nprofile1` containing relay URLs in it, or an `npub1` or hex key manually, but and then specify a relay manually for these (this is so because Gossip follows specific people at specific relays, it doesn't have a global static list of relays).
1. After you've done this you might have to restart Gossip so your feed shows up.

## Refreshing metadata

After restarting, go to the "People" tab and click on "Refresh Metadata". That will make it so Gossip will update the profiles of the people you've decided to follow and show their pictures, which is much nicer than just a public key.
![](/images/gossip-metadata.png)

## Picking write relays

1. You'll notice that Gossip won't let you write anything until you have chosen a set of relays to write to.
1. To solve that, go to "Relays" > "Configure" and pick some relays where you want to publish your posts.
1. The screen will show a list of relays it knows about from seeing them anywhere, so it might contain not many or a lot depending on whom you've added and what notes you've browsed.
1. You can type relay addresses manually if you want.

![](/images/gossip-relays.png)

## Browsing the feed

1. The "Feed" tab shows all notes from people you follow and only that.
1. You can click the notes and fetch replies to them and the notes to which they reply, as long as enough relay information is found that allow Gossip to fetch them.
1. The "Inbox" tab shows mentions you've received and replies to your notes.

![](/images/gossip-feed.png)

## Publishing notes

1. Just write your note in the text box above the feed.
1. You can add a subject or mention people by searching for them in the little text box below.
1. Any `npub1` or `note1` content pasted in the textbox should be automatically picked and parsed into a real mention, they will have different colors.
