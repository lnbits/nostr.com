<script lang="ts">
  import { appPath } from '$lib/paths';
</script>

<article class="info-view article-info-view">
  <header class="info-head article-info-head">
    <a class="info-back" href={appPath('/info')} aria-label="Back to info">← Info</a>
    <div class="info-title-row">
      <h1>Nostr Relays</h1>
      <img src={appPath('/relays.png')} alt="" class="info-robot" />
    </div>
    <p>
      A relay is a server that helps move messages around Nostr. When you post something, your app
      sends it to one or more relays. Other people's apps can then read your post from those relays.
    </p>
    <p>
      You can think of relays like post offices. They help deliver messages, but they do not own
      your account or control your identity. Nostr does not have one central server, so using
      several relays helps make your posts easier to find and harder to lose.
    </p>
    <p>
      If Nostr feels slow or empty, your relays may be the reason. Some relays are fast and
      reliable, while others go offline or stop responding. Adding a few good relays, or removing
      bad ones, can make a big difference.
    </p>
    <p>
      Some relays are free, and some are paid. Paid relays can help reduce spam because running a
      relay costs money and users have more reason to behave. A good place to discover relays is
      <a href="https://nostr.watch" target="_blank" rel="noreferrer">Nostr.watch</a>.
    </p>
  </header>
</article>
