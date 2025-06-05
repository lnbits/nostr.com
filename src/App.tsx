import { createSignal, Match, onMount, Show, Switch } from "solid-js"
import { render } from "solid-js/web"
import { generateSecretKey, getPublicKey, finalizeEvent } from "@nostr/tools/pure"
import { nsecEncode, npubEncode } from "@nostr/tools/nip19"
import { BlossomClient } from "@nostr/tools/nipb7"
import { PlainKeySigner } from "@nostr/tools/signer"
import { pool } from "@nostr/gadgets/global"

function App(props: { onClose: () => void }) {
  const [secretKey, setSecretKey] = createSignal<Uint8Array | null>(null)
  const [nsec, setNsec] = createSignal("")
  const [npub, setNpub] = createSignal("")
  const [copyResult, setCopyResult] = createSignal<{
    npub: null | true | false
    nsec: null | true | false
  }>({ npub: null, nsec: null })
  const [showingNextSteps, setShowingNextSteps] = createSignal(false)
  const [keysDownloaded, setKeysDownloaded] = createSignal(false)
  const [profileName, setProfileName] = createSignal("")
  const [profileImage, setProfileImage] = createSignal<File | null>(null)
  const [isPublishing, setIsPublishing] = createSignal(false)
  const [publishSuccess, setPublishSuccess] = createSignal(false)
  const [publishError, setPublishError] = createSignal("")
  const [noteText, setNoteText] = createSignal(
    "hello world, I just made this account on https://nostr.com! #introductions"
  )
  const [isPublishingIntro, setIsPublishingIntro] = createSignal(false)
  const [introPublishSuccess, setIntroPublishSuccess] = createSignal(false)
  const [introPublishError, setIntroPublishError] = createSignal("")

  onMount(async () => {
    try {
      const newSecretKey = generateSecretKey()
      setSecretKey(newSecretKey)
      setNsec(nsecEncode(newSecretKey))
      setNpub(npubEncode(getPublicKey(newSecretKey)))
    } catch (error) {
      console.error("Error generating keys:", error)
    }
  })

  return (
    <>
      <button
        onClick={() => props.onClose()}
        class="cursor-pointer absolute top-4 right-4 p-2 text-primary-lighter dark:text-gray-400 hover:text-primary dark:hover:text-gray-200 transition z-50"
      >
        <span class="material-symbols-outlined text-lg">close</span>
      </button>

      <div
        class="w-full h-full max-h-screen sm:max-h-screen overflow-y-auto mx-auto py-8 px-16 bg-background-light dark:bg-dotcom-dark shadow-xl border border-grayish transition-all duration-300"
        classList={{
          "sm:max-w-5xl sm:h-auto sm:rounded-3xl": showingNextSteps(),
          "sm:max-w-md sm:h-auto sm:rounded-3xl": !showingNextSteps()
        }}
      >
        <div class="flex flex-col md:flex-row gap-8 min-h-full">
          {/* Main Panel */}
          <div class="flex-1 min-w-0">
            <Show when={!keysDownloaded()}>
              <div class="mb-4">
                <div class="w-16 h-16 bg-gradient-to-br from-secondary/80 to-secondary/60 dark:from-dotcom-light/80 dark:to-dotcom-light/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <span class="material-symbols-outlined text-white dark:text-dotcom-dark text-2xl">
                    vpn_key
                  </span>
                </div>
                <h3 class="text-xl font-bold text-primary dark:text-white mb-2">
                  Your Nostr Account
                </h3>
                <p class="text-sm text-primary-lighter dark:text-gray-300">
                  You can just use this <code>nsec</code> and it will be your account, or you can
                  create another later.
                </p>
              </div>
            </Show>

            {/* Profile Setup Header (shown after download) */}
            <Show when={keysDownloaded() && !publishSuccess()}>
              <div class="mb-4">
                <div class="w-16 h-16 bg-gradient-to-br from-secondary/80 to-secondary/60 dark:from-dotcom-light/80 dark:to-dotcom-light/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <span class="material-symbols-outlined text-white dark:text-dotcom-dark text-2xl">
                    person
                  </span>
                </div>
                <h3 class="text-xl font-bold text-primary dark:text-white mb-2">
                  Set Up Your Profile
                </h3>
                <p class="text-sm text-primary-lighter dark:text-gray-300">
                  Let's create your first Nostr profile with your new keys.
                </p>
              </div>
            </Show>

            {/* Success State */}
            <Show when={publishSuccess()}>
              <div class="mb-4">
                <div class="w-16 h-16 bg-gradient-to-br from-green-500/80 to-green-600/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <span class="material-symbols-outlined text-white text-2xl">check_circle</span>
                </div>
                <h3 class="text-xl font-bold text-primary dark:text-white mb-2">
                  Profile Published!
                </h3>
                <p class="text-sm text-primary-lighter dark:text-gray-300">
                  Your Nostr profile has been successfully published to the network.
                </p>
              </div>
            </Show>

            <div class="space-y-3">
              {/* Secret Key (hidden after download) */}
              <Show when={!keysDownloaded()}>
                <div>
                  <label class="block text-xs font-semibold text-primary dark:text-gray-200 mb-2">
                    Secret Key (nsec)
                  </label>
                  <div class="flex items-center justify-center gap-2">
                    <input
                      value={nsec()}
                      readonly
                      class="flex-1 h-10 px-3 text-xs bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl font-mono text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition"
                      placeholder="Generating..."
                    />
                    <Show when={nsec()}>
                      <button
                        onClick={() => {
                          if (copyResult["nsec"] === undefined) copyToClipboard(nsec(), "nsec")
                        }}
                        class="cursor-pointer h-10 w-10 flex items-center justify-center bg-secondary dark:bg-dotcom-light text-white dark:text-dotcom-dark border border-secondary dark:border-dotcom-light hover:opacity-90 rounded-xl transition"
                        title="Copy to clipboard"
                      >
                        <span class="material-symbols-outlined text-sm">
                          <Switch>
                            <Match when={copyResult().nsec === true}>check</Match>
                            <Match when={copyResult().nsec === false}>warning</Match>
                            <Match when={copyResult().nsec === null}>content_copy</Match>
                          </Switch>
                        </span>
                      </button>
                    </Show>
                  </div>
                  <p class="text-xs text-primary-lighter dark:text-gray-400 mt-1">
                    Keep this secret and secure.
                  </p>
                </div>
              </Show>

              {/* Public Key (always shown, moved up after download) */}
              <div>
                <label class="block text-xs font-semibold text-primary dark:text-gray-200 mb-2">
                  Public Key (npub)
                </label>
                <div class="flex gap-2">
                  <input
                    value={npub()}
                    readonly
                    class="flex-1 px-3 py-3 text-xs bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl font-mono text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition"
                    placeholder="Generating..."
                  />
                  <Show when={npub()}>
                    <button
                      onClick={() => {
                        if (copyResult["npub"] === undefined) copyToClipboard(npub(), "npub")
                      }}
                      class="h-10 w-10 flex items-center justify-center bg-secondary dark:bg-dotcom-light text-white dark:text-dotcom-dark border border-secondary dark:border-dotcom-light hover:opacity-90 rounded-xl transition"
                      title="Copy to clipboard"
                    >
                      <span class="material-symbols-outlined text-sm">
                        <Switch>
                          <Match when={copyResult().npub === true}>check</Match>
                          <Match when={copyResult().npub === false}>warning</Match>
                          <Match when={copyResult().npub === null}>content_copy</Match>
                        </Switch>
                      </span>
                    </button>
                  </Show>
                </div>
                <p class="text-xs text-primary-lighter dark:text-gray-400 mt-1">
                  This is your user id you can share with anyone.
                </p>
              </div>

              {/* Profile Form (shown after download) */}
              <Show when={keysDownloaded() && !publishSuccess()}>
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-primary dark:text-gray-200 mb-2">
                      Your Name
                    </label>
                    <input
                      value={profileName()}
                      onInput={e => setProfileName(e.target.value)}
                      type="text"
                      placeholder="Enter your name"
                      class="w-full h-10 px-3 text-sm bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-primary dark:text-gray-200 mb-2">
                      Profile Picture (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      class="w-full text-sm text-primary dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-secondary dark:file:bg-dotcom-light file:text-white dark:file:text-dotcom-dark hover:file:opacity-90"
                    />
                  </div>

                  <Show when={publishError()}>
                    <div class="text-red-500 text-sm">{publishError()}</div>
                  </Show>
                </div>
              </Show>

              {/* Action Buttons */}
              <div class="flex flex-col space-y-3 pt-2">
                {/* Download Keys Button (hidden after download) */}
                <Show when={nsec() && npub() && !keysDownloaded()}>
                  <button
                    onClick={downloadKeys}
                    class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-primary dark:text-gray-200 bg-background-light dark:bg-dotcom-dark border border-secondary dark:border-dotcom-light rounded-xl hover:bg-secondary/10 dark:hover:bg-dotcom-light/10 transition"
                  >
                    <span class="material-symbols-outlined mr-2 text-lg">download</span>
                    Download Keys
                  </button>
                </Show>

                {/* Publish Profile Button (shown after download) */}
                <Show when={keysDownloaded() && !publishSuccess()}>
                  <button
                    onClick={publishProfile}
                    disabled={!profileName().trim() || isPublishing()}
                    class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Show
                      when={!isPublishing()}
                      fallback={
                        <span class="material-symbols-outlined mr-2 text-lg animate-spin">
                          sync
                        </span>
                      }
                    >
                      <span class="material-symbols-outlined mr-2 text-lg">publish</span>
                    </Show>
                    <span>{isPublishing() ? "Publishing..." : "Publish Profile"}</span>
                  </button>
                </Show>

                {/* View Profile Button (shown after success) */}
                <Show when={publishSuccess()}>
                  <a
                    href={`https://njump.me/${npub()}`}
                    target="_blank"
                    class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
                  >
                    <span class="material-symbols-outlined mr-2 text-lg">open_in_new</span>
                    View Your Profile
                  </a>
                </Show>

                {/* Introduction Post Section (shown after success) */}
                <Show when={publishSuccess() && !introPublishSuccess()}>
                  <div class="space-y-3">
                    <div class="border-t border-secondary dark:border-dotcom-light pt-4">
                      <h4 class="text-sm font-semibold text-primary dark:text-white mb-2">
                        Publish your first note
                      </h4>
                      <textarea
                        value={noteText()}
                        onInput={e => setNoteText(e.target.value)}
                        rows="3"
                        class="w-full px-3 py-2 text-sm bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition resize-none"
                        placeholder="Write your introduction post..."
                      />
                      <Show when={introPublishError()}>
                        <div class="text-red-500 text-sm mt-1">{introPublishError()}</div>
                      </Show>
                      <button
                        onClick={publishNote}
                        disabled={!noteText().trim() || isPublishingIntro()}
                        class="cursor-pointer w-full mt-2 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Show
                          when={!isPublishingIntro()}
                          fallback={
                            <span class="material-symbols-outlined mr-2 text-lg animate-spin">
                              sync
                            </span>
                          }
                        >
                          <span class="material-symbols-outlined mr-2 text-lg">send</span>
                        </Show>
                        <span>{isPublishingIntro() ? "Publishing..." : "Publish Post"}</span>
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Introduction Post Success (shown after intro post success) */}
                <Show when={introPublishSuccess()}>
                  <div class="border-t border-secondary dark:border-dotcom-light pt-4">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-green-500/80 to-green-600/60 rounded-xl mx-auto mb-3 flex items-center justify-center">
                        <span class="material-symbols-outlined text-white text-lg">
                          check_circle
                        </span>
                      </div>
                      <h4 class="text-sm font-semibold text-primary dark:text-white mb-1">
                        Post published!
                      </h4>
                      <p class="text-xs text-primary-lighter dark:text-gray-300">
                        Your introduction post has been shared on Nostr.
                      </p>
                    </div>
                  </div>
                </Show>

                {/* Next Steps Button (shown before download and not showing next steps) */}
                <Show when={nsec() && npub() && !showingNextSteps()}>
                  <button
                    onClick={() => setShowingNextSteps(true)}
                    class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
                  >
                    Next Steps
                    <span class="ml-2 text-lg">→</span>
                  </button>
                </Show>
              </div>
            </div>
          </div>

          {/* Next Steps Panel */}
          <Show when={showingNextSteps()}>
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
                    Copy your nsec and paste it directly into a Nostr app you trust. These apps will
                    store your key locally.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <a
                      href="https://jumble.social/"
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
                    Install a browser extension that stores your nsec and signs messages for web
                    apps without exposing your secret key.
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
                    Install an Android dedicated signer and bunker provider that stores your nsec
                    and can sign for other Android or web apps.
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
          </Show>
        </div>
      </div>
    </>
  )

  function downloadKeys() {
    if (!nsec() || !npub()) {
      console.error("Keys not available for download")
      return
    }

    const keyData = `Nostr Key
==========

Secret Key (nsec): ${nsec()}
Public Key (npub): ${npub()}

IMPORTANT: Keep your secret key (nsec) safe and private!
Your public key (npub) should be shared with others so they know who you are on Nostr.

Generated on: ${new Date().toLocaleString()} on https://nostr.com/
`

    const blob = new Blob([keyData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "nostr-keys.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setKeysDownloaded(true)
  }

  function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setProfileImage(file)
    }
  }

  async function publishProfile() {
    if (!profileName().trim()) {
      setPublishError("Please enter a name")
      return
    }

    setIsPublishing(true)
    setPublishError("")

    try {
      const signer = new PlainKeySigner(secretKey()!)

      const writeRelays = ["wss://nostr.mom", "wss://relay.primal.net"]

      let imageUrl = ""
      if (profileImage()) {
        const servers = ["blossom.primal.net", "24242.io"]
        for (const server of servers) {
          const blossom = new BlossomClient(server, signer)
          try {
            const desc = await blossom.uploadBlob(profileImage()!)
            imageUrl = desc?.url
          } catch (err) {
            console.warn("failed to upload to", server, err)
          }
        }
      }

      const metadata: any = {
        name: profileName().trim()
      }
      if (imageUrl) {
        metadata.picture = imageUrl
      }

      await Promise.any(
        pool.publish(
          [...writeRelays, "user.kindpag.es", "relay.nos.social", "purplepag.es"],
          finalizeEvent(
            {
              kind: 0,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: JSON.stringify(metadata)
            },
            secretKey()!
          )
        )
      )

      await Promise.any(
        pool.publish(
          [...writeRelays, "user.kindpag.es", "indexer.coracle.social", "purplepag.es"],
          finalizeEvent(
            {
              kind: 10002,
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ...writeRelays.map(relay => ["r", relay, "write"]),
                ...[
                  "wss://nostrelites.org",
                  "wss://wot.nostr.net",
                  "wss://nostr.wine",
                  "wss://nostr.lol"
                ].map(relay => ["r", relay, "read"])
              ],
              content: ""
            },
            secretKey()!
          )
        )
      )

      await Promise.any(
        pool.publish(
          writeRelays,
          finalizeEvent(
            {
              kind: 10063,
              created_at: Math.floor(Date.now() / 1000),
              tags: ["blossom.primal.net", "24242.io"].map(server => [
                "server",
                `https://${server}`
              ]),
              content: ""
            },
            secretKey()!
          )
        )
      )

      setPublishSuccess(true)
    } catch (error) {
      console.error("Error publishing profile:", error)
      setPublishError("Failed to publish profile. Please try again.")
    } finally {
      setIsPublishing(false)
    }
  }

  async function publishNote() {
    setIsPublishingIntro(true)
    setIntroPublishError("")

    try {
      const writeRelays = ["wss://nostr.mom", "wss://relay.damus.io"]

      await Promise.any(
        pool.publish(
          [...writeRelays, "wss://relay.nos.social", "wss://nos.lol"],
          finalizeEvent(
            {
              kind: 1,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: noteText().trim()
            },
            secretKey()!
          )
        )
      )

      setIntroPublishSuccess(true)
    } catch (error) {
      console.error("Error publishing introduction post:", error)
      setIntroPublishError("Failed to publish post. Please try again.")
    } finally {
      setIsPublishingIntro(false)
    }
  }

  async function copyToClipboard(text: string, type: "nsec" | "npub") {
    try {
      await navigator.clipboard.writeText(text)
      setCopyResult(v => ({ ...v, [type]: true }))
      setTimeout(() => {
        setCopyResult(v => ({ ...v, [type]: undefined }))
      }, 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      setCopyResult(v => ({ ...v, [type]: false }))
      setTimeout(() => {
        setCopyResult(v => ({ ...v, [type]: undefined }))
      }, 2000)
    }
  }
}

export function renderModal(root: HTMLElement, onClose: () => void) {
  render(<App onClose={onClose} />, root)
}
