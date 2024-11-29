---
title: What are relays?
description: What are Relays and how do they work
---

What are Relays and how do they work?

---

## What are relays?

Relays are like the backend servers for Nostr. They allow Nostr clients to send them messages, and they store those messages and broadcast those messages to all other connected clients.

## Do relays store all the data?

No, each relay only stores whatever it wants. The basic idea is that users are attached to some relays they choose and they publish their notes to those, and other users learn about relay preferences of their friends, then connect to their friends' relays to download their notes.

## That sounds cumbersome.

Yes, but it should all be done automatically by your client software, you shouldn't have to worry too much.

## Should I run my own relay?

For most people, no, it's better to just pick a few public relays or relays from people you know and trust, or even relays that offer paid services.

With that said, if you want to ensure that your speech is absolutely uncensorable or if you want to run a special-purpose relay for you and maybe some friends or a community you totally should!

[Relay Wizard](https://relaywizard.com/) has a one-click setup script ready for you with multiple relay software options, while [Relay Runner](https://relayrunner.org/) has more detailed explanations and step-by-step guides.

## How can someone find me in a personal or obscure relay?

That's a long explanation, but [hodlbod](https://njump.me/nprofile1qqsf03c2gsmx5ef4c9zmxvlew04gdh7u94afnknp33qvv3c94kvwxgspp4mhxue69uhkummn9ekx7mqpr4mhxue69uhkummnw3ez6ur4vgh8wetvd3hhyer9wghxuet5qyfhwumn8ghj7un9d3shjctzd3jjummjvuq3yamnwvaz7tmsw4e8qmr9wpskwtn9wvq3xamnwvaz7tmwdaehgu3wxcurstn0wfns4hdyej) tried his hand at explaining it [here](https://yakihonne.com/article/naddr1qvzqqqr4gupzp978pfzrv6n9xhq5tvenl9e74pklmskh4xw6vxxyp3j8qkke3cezqq2nskt2w9vx6dznfdvj64rpw4mk5nmxf3v9xsd0gdy) and [Jeff](https://njump.me/nprofile1qyw8wumn8ghj7mn0wd68ytfsxyh8jcttd95x7mnwv5hxxmmdqyw8wumn8ghj7mn0wd68ytfsxgh8jcttd95x7mnwv5hxxmmdqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsz9nhwden5te0wfjkccte9ehx7um5wghxyctwvsqzq9eemymaerqvwdc25f6ctyuvzx0zt3qld3zp5hf5cmfc2qlrzdh0c8xvr7) gave it a shot [here](https://yakihonne.com/article/naddr1qqxnzde3xy6rvwpnx56rvdpkqgspwwwexlwgcrrnwz4zwkze8rq3ncjug8mvgsd96dxx6wzs8ccndmcrqsqqqa28jnw7un).

[This is interactive demo](https://how-nostr-works.pages.dev/#/outbox) that shows how Nostr clients find the relays for others and keep updating their findings as conditions change.

## OK, but where do I find some relays to use?

It's pointless to maintain a list of known relays and you shouldn't worry about it. Once you install a [client](/clients) it will probably give you some default relays. From there you can start learning about other options, who controls each relay, what are the peculiarities of each and then be able to pick and choose as you become an advanced user.
