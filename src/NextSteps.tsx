function NextSteps(props: { npub: string }) {
  return (
    <div class="flex-1 min-w-0 md:border-l border-secondary dark:border-dotcom-light md:pl-8">
      <div class="mb-6">
        <h3 class="text-xl font-bold text-primary dark:text-white mb-2">
          How to actually use my Nostr account
        </h3>
        <p class="text-sm text-primary-lighter dark:text-gray-300">
          Wherever you take your secret key there will be Nostr:
        </p>
      </div>

      <div class="space-y-6 text-sm">
        {/* Option 1: Trusted Apps */}
        <div class="border border-secondary dark:border-dotcom-light rounded-xl p-4">
          <h4 class="font-semibold text-primary dark:text-white mb-2 flex items-center">
            <span class="material-symbols-outlined mr-2 text-secondary dark:text-dotcom-light">
              apps
            </span>
            Use in trusted Nostr apps
          </h4>
          <p class="text-primary-lighter dark:text-gray-300 mb-3">
            Copy your nsec and paste it directly into a Nostr app you trust. These apps will store
            your key locally.
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              href={"https://jumble.social/users/" + props.npub}
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Jumble
            </a>
            <a
              href="https://chachi.chat/"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Chachi
            </a>
            <a
              href="https://yakihonne.com/yakihonne-mobile-app"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              YakiHonne
            </a>
            <a
              href="https://github.com/mikedilger/gossip"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Gossip
            </a>
            <a
              href="https://nostur.com/"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Nostur
            </a>
          </div>
        </div>

        {/* Option 2: Browser Extensions */}
        <div class="border border-secondary dark:border-dotcom-light rounded-xl p-4">
          <h4 class="font-semibold text-primary dark:text-white mb-2 flex items-center">
            <span class="material-symbols-outlined mr-2 text-secondary dark:text-dotcom-light">
              extension
            </span>
            Use with browser extensions
          </h4>
          <p class="text-primary-lighter dark:text-gray-300 mb-3">
            Install a browser extension that stores your nsec and signs messages for web apps
            without exposing your secret key.
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              href="https://github.com/fiatjaf/nos2x"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              nos2x
            </a>
            <a
              href="https://getalby.com/products/browser-extension"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Alby
            </a>
            <a
              href="https://apps.apple.com/us/app/nostash/id6744309333"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Nostash
            </a>
          </div>
        </div>

        {/* Option 3: Android Signer */}
        <div class="border border-secondary dark:border-dotcom-light rounded-xl p-4">
          <h4 class="font-semibold text-primary dark:text-white mb-2 flex items-center">
            <span class="material-symbols-outlined mr-2 text-secondary dark:text-dotcom-light">
              phone_android
            </span>
            Use with Android signer
          </h4>
          <p class="text-primary-lighter dark:text-gray-300 mb-3">
            Install an Android dedicated signer and bunker provider that stores your nsec and can
            sign for other Android or web apps.
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              href="https://github.com/greenart7c3/Amber"
              target="_blank"
              class="text-xs bg-secondary/10 dark:bg-dotcom-light/10 text-secondary dark:text-dotcom-light px-2 py-1 rounded hover:bg-secondary/20 dark:hover:bg-dotcom-light/20 transition"
            >
              Amber
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NextSteps
