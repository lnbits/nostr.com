<script lang="ts">
  import { appPath } from '$lib/paths';
</script>

<article class="info-view article-info-view">
  <header class="info-head article-info-head">
    <a class="info-back" href={appPath('/info')} aria-label="Back to info">← Info</a>
    <div class="info-title-row">
      <h1>Nostr Keys</h1>
      <img src={appPath('/keys.png')} alt="" class="info-robot" />
    </div>
    <p>
      <i>Keep your private key safe and private, avoid signing into apps directly with your nsec!</i>
    </p>
    <p>
      Every Nostr account has two keys: a public key and a private key. Your public key is like your
      username. It is safe to share, and people use it to find you, follow you, and send you
      messages.
    </p>
    <p>
      Your private key is the secret part. It is more like a password, house key, or bank card PIN.
      Anyone who gets it can act as you on Nostr, including posting as you, changing your profile,
      and sending messages from your account.
    </p>
    <p>
      When you publish a note, your app signs it with your private key. That signature proves the
      note really came from you and was not secretly changed later. This happens automatically in
      the background.
    </p>
    <p>
      The main thing to remember is simple: share your public key freely, but protect your private
      key carefully. If you lose your private key and have no backup, there is usually no "Forgot
      Password" button to get your account back.
    </p>
  </header>
</article>
