<script lang="ts">
  import { appPath } from '$lib/paths';
</script>

<article class="info-view article-info-view">
  <header class="info-head article-info-head">
    <a class="info-back" href={appPath('/info')} aria-label="Back to info">← Info</a>
    <h1>Nostr Clients</h1>
    <p>
      A Nostr client is simply an app for using Nostr. It lets you read posts, write notes, send
      messages, update your profile, and interact with people on the network.
    </p>
    <p>
      There are many clients because Nostr is open. Anyone can build an app that works with it. Some
      clients feel like social media, while others focus on writing, streaming, payments, games, or
      private messages.
    </p>
    <p>
      Your account is not tied to one client. You can use one app today and another tomorrow, or use
      several at the same time. Your identity belongs to your key, not to the app.
    </p>
    <p>
      Be careful with your private key. It controls your account, so you should avoid pasting it
      into every app you try. Safer options include Pomegranate, a browser extension signer, or a
      remote signer, because they keep your private key separate from the clients you use.
    </p>
    <p>
      A good place to discover Nostr clients is
      <a href="https://nostrapps.com" target="_blank" rel="noreferrer">nostrapps.com</a>.
    </p>
  </header>
</article>
