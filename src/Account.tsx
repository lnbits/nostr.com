import { createMemo, createSignal, Match, onMount, Show, Switch } from "solid-js"
import { getPublicKey, finalizeEvent } from "@nostr/tools/pure"
import { nsecEncode, npubEncode, neventEncode, NEvent } from "@nostr/tools/nip19"
import { BlossomClient } from "@nostr/tools/nipb7"
import { PlainKeySigner } from "@nostr/tools/signer"
import { pool } from "@nostr/gadgets/global"

function Account(props: { secretKey: Uint8Array; showNextSteps: null | (() => void) }) {
  // eslint-disable-next-line solid/reactivity
  const nsec = nsecEncode(props.secretKey)
  // eslint-disable-next-line solid/reactivity
  const publicKey = getPublicKey(props.secretKey)

  const npub = npubEncode(publicKey)
  const [copyResult, setCopyResult] = createSignal<{
    npub: null | true | false
    nsec: null | true | false
  }>({ npub: null, nsec: null })

  const writeRelays = ["wss://nostr.mom", "wss://relay.damus.io"]

  const [keysDownloaded, setKeysDownloaded] = createSignal(false)
  const [profileName, setProfileName] = createSignal("")
  const [profileImage, setProfileImage] = createSignal<File | null>(null)
  const profileImageUrl = createMemo(() => profileImage() && URL.createObjectURL(profileImage()))
  const [isPublishing, setIsPublishing] = createSignal(false)
  const [profilePublishSuccess, setProfilePublishSuccess] = createSignal(false)
  const [profilePublishError, setProfilePublishError] = createSignal("")
  const [noteText, setNoteText] = createSignal(
    "hello world, I just made this account on https://nostr.com! #introductions"
  )
  const [isPublishingNote, setIsPublishingNote] = createSignal(false)
  const [notePublishSuccess, setNotePublishSuccess] = createSignal<false | true | NEvent>(false)
  const [notePublishError, setNotePublishError] = createSignal("")

  onMount(async () => {
    try {
      const evt = await pool.get(writeRelays, { kinds: [0], authors: [publicKey], limit: 1 })
      if (evt) {
        const { name } = JSON.parse(evt.content)
        if (name) {
          setProfilePublishSuccess(true)
        }
      }
    } catch (err) {
      /***/
    }

    try {
      const evt = await pool.get(writeRelays, { kinds: [1], authors: [publicKey], limit: 1 })
      if (evt) {
        setNotePublishSuccess(true)
      }
    } catch (err) {
      /***/
    }
  })

  return (
    <div class="flex-1 min-w-0">
      <Show when={!keysDownloaded()}>
        <div class="mb-4">
          <div class="w-16 h-16 bg-gradient-to-br from-secondary/80 to-secondary/60 dark:from-dotcom-light/80 dark:to-dotcom-light/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span class="material-symbols-outlined text-white dark:text-dotcom-dark text-2xl">
              vpn_key
            </span>
          </div>
          <h3 class="text-xl font-bold text-primary dark:text-white mb-2">Your Nostr Account</h3>
          <p class="text-sm text-primary-lighter dark:text-gray-300">
            This <code class="font-semibold">nsec</code> was generated on your computer and is
            impossible to guess it. It cannot be recovered if it's lost.
          </p>
        </div>
      </Show>

      {/* Profile Setup Header (shown after download) */}
      <Show when={keysDownloaded() && !profilePublishSuccess()}>
        <div class="mb-4">
          <div class="w-16 h-16 bg-gradient-to-br from-secondary/80 to-secondary/60 dark:from-dotcom-light/80 dark:to-dotcom-light/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span class="material-symbols-outlined text-white dark:text-dotcom-dark text-2xl">
              person
            </span>
          </div>
          <h3 class="text-xl font-bold text-primary dark:text-white mb-2">Set Up Your Profile</h3>
          <p class="text-sm text-primary-lighter dark:text-gray-300">
            Let's create your first Nostr profile with your new keys.
          </p>
        </div>
      </Show>

      {/* Success State either for the profile or for the note */}
      <Show when={keysDownloaded()}>
        <Switch>
          <Match when={typeof notePublishSuccess() === "string"}>
            <div class="mb-4">
              <div class="w-16 h-16 bg-gradient-to-br from-green-500/80 to-green-600/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <span class="material-symbols-outlined text-white text-2xl">check_circle</span>
              </div>
              <h3 class="text-xl font-bold text-primary dark:text-white mb-2">Note Published!</h3>
              <p class="text-sm text-primary-lighter dark:text-gray-300">
                Your note was published to your relays (
                {writeRelays.map(r => r.replace("wss://", "")).join(", ")}) and can be seen by
                anyone.
              </p>
            </div>
          </Match>
          <Match when={profilePublishSuccess()}>
            <div class="mb-4">
              <div class="w-16 h-16 bg-gradient-to-br from-green-500/80 to-green-600/60 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <span class="material-symbols-outlined text-white text-2xl">check_circle</span>
              </div>
              <h3 class="text-xl font-bold text-primary dark:text-white mb-2">
                Profile Published!
              </h3>
              <p class="text-sm text-primary-lighter dark:text-gray-300">
                Your Nostr profile has been successfully published!
              </p>
            </div>
          </Match>
        </Switch>
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
                value={nsec}
                readonly
                class="flex-1 h-10 px-3 text-xs bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl font-mono text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition"
                placeholder="Generating..."
              />
              <Show when={nsec}>
                <button
                  onClick={() => {
                    if (copyResult["nsec"] === undefined) copyToClipboard(nsec, "nsec")
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
              This is a permanent "password" that holds your Nostr identity. Store it in a secure
              location.
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
              value={npub}
              readonly
              class="flex-1 px-3 py-3 text-xs bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl font-mono text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-secondary/20 dark:focus:ring-dotcom-light/20 focus:border-secondary dark:focus:border-dotcom-light transition"
              placeholder="Generating..."
            />
            <Show when={npub}>
              <button
                onClick={() => {
                  if (copyResult["npub"] === undefined) copyToClipboard(npub, "npub")
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
            This is your user id on Nostr. You can (and should!) share it with anyone.
          </p>
        </div>

        {/* Profile Form (shown after download) */}
        <Show when={keysDownloaded() && !profilePublishSuccess()}>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-primary dark:text-gray-200 mb-2">
                Profile Picture (optional)
              </label>
              <div class="flex gap-4 items-start">
                {/* Image preview */}
                <Show when={profileImageUrl()}>
                  <div class="relative">
                    <img
                      src={profileImageUrl()}
                      alt="Profile preview"
                      class="w-20 h-20 object-cover rounded-xl border border-secondary dark:border-dotcom-light"
                    />
                    <button
                      onClick={() => {
                        // clear the file input
                        setProfileImage(null)
                        const input = document.querySelector(
                          'input[type="file"]'
                        ) as HTMLInputElement
                        if (input) input.value = ""
                      }}
                      class="cursor-pointer absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition"
                    >
                      ×
                    </button>
                  </div>
                </Show>

                {/* File input */}
                <div class="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    class="hidden"
                    id="profile-image-input"
                  />
                  <label
                    for="profile-image-input"
                    class="cursor-pointer inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary dark:text-gray-200 bg-white dark:bg-primary-lighter border border-secondary dark:border-dotcom-light rounded-xl hover:bg-secondary/10 dark:hover:bg-dotcom-light/10 transition"
                  >
                    <span class="material-symbols-outlined mr-2 text-lg">add_photo_alternate</span>
                    {profileImage() ? "Change Picture" : "Choose Picture"}
                  </label>
                </div>
              </div>
            </div>

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

            <Show when={profilePublishError()}>
              <div class="text-red-500 text-sm">{profilePublishError()}</div>
            </Show>
          </div>
        </Show>

        {/* Action Buttons */}
        <div class="flex flex-col space-y-3 pt-2">
          {/* Download Keys Button (hidden after download) */}
          <Show when={!keysDownloaded()}>
            <button
              onClick={downloadKeys}
              class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-primary dark:text-gray-200 bg-background-light dark:bg-dotcom-dark border border-secondary dark:border-dotcom-light rounded-xl hover:bg-secondary/10 dark:hover:bg-dotcom-light/10 transition"
            >
              <span class="material-symbols-outlined mr-2 text-lg">download</span>
              Download Keys
            </button>
          </Show>

          {/* Publish Profile Button (shown after download) */}
          <Show when={keysDownloaded() && !profilePublishSuccess()}>
            <button
              onClick={publishProfile}
              disabled={!profileName().trim() || isPublishing()}
              class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Show
                when={!isPublishing()}
                fallback={
                  <span class="material-symbols-outlined mr-2 text-lg animate-spin">sync</span>
                }
              >
                <span class="material-symbols-outlined mr-2 text-lg">publish</span>
              </Show>
              <span>{isPublishing() ? "Publishing..." : "Publish Profile"}</span>
            </button>
          </Show>

          {/* View Profile Button (shown after success) */}
          <Show when={profilePublishSuccess()}>
            <a
              href={`https://nostr.band/${npub}`}
              target="_blank"
              class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
            >
              <span class="material-symbols-outlined mr-2 text-lg">open_in_new</span>
              View Your Profile
            </a>
          </Show>

          {/* View Note Button (shown after success) */}
          <Show when={typeof notePublishSuccess() === "string"}>
            <a
              href={`https://njump.me/${notePublishSuccess()}`}
              target="_blank"
              class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
            >
              <span class="material-symbols-outlined mr-2 text-lg">open_in_new</span>
              View Your Note
            </a>
          </Show>

          {/* Initial Note Section (shown after profile published) */}
          <Show when={profilePublishSuccess() && !notePublishSuccess()}>
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
                <Show when={notePublishError()}>
                  <div class="text-red-500 text-sm mt-1">{notePublishError()}</div>
                </Show>
                <button
                  onClick={publishNote}
                  disabled={!noteText().trim() || isPublishingNote()}
                  class="cursor-pointer w-full mt-2 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Show
                    when={!isPublishingNote()}
                    fallback={
                      <span class="material-symbols-outlined mr-2 text-lg animate-spin">sync</span>
                    }
                  >
                    <span class="material-symbols-outlined mr-2 text-lg">send</span>
                  </Show>
                  <span>{isPublishingNote() ? "Publishing..." : "Publish Post"}</span>
                </button>
              </div>
            </div>
          </Show>

          {/* Initial Note Section (shown after profile published) */}
          <Show when={profilePublishSuccess() && !notePublishSuccess()}>
  <div class="bg-gray-800 p-6 rounded-xl shadow-md space-y-3">
    
      <h4
        class="text-lg font-extrabold text-[#44c8f5] mb-2 inline-block border-b-4 border-[#44c8f5] pb-1"
      >
        nostr.com paid services
      </h4>
      <p class="text-sm text-white mb-3">
      You totally don't need to use paid services from nostr.com to access nostr,
      but we do happen to sell nostr services, like very pretty nostr names (yourname@nostr.com). 
      Buying one helps support the development of this site, and will impress all your friends.
      </p>

      <a
        href="https://my.nostr.com"
        target="_blank"
        rel="noopener noreferrer"
        class="cursor-pointer w-full mt-2 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
      >
        <span class="material-symbols-outlined mr-2 text-lg">shopping_cart</span>
        visit my.nostr.com
      </a>
  
  </div>
</Show>



          {/* Next Steps Button (shown before download and not showing next steps) */}
          <Show when={props.showNextSteps !== null}>
            <button
              onClick={() => props.showNextSteps()}
              class="cursor-pointer w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white dark:text-dotcom-dark bg-secondary dark:bg-dotcom-light rounded-xl hover:opacity-90 transition shadow-sm"
            >
              {notePublishSuccess() ? "Keep using Nostr" : "Next Steps"}
              <span class="ml-2 text-lg">→</span>
            </button>
          </Show>
        </div>
      </div>
    </div>
  )

  function downloadKeys() {
    const keyData = `Nostr Key
==========

Secret Key (nsec): ${nsec}
Public Key (npub): ${npub}

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
      setProfilePublishError("Please enter a name")
      return
    }

    setIsPublishing(true)
    setProfilePublishError("")

    try {
      const signer = new PlainKeySigner(props.secretKey)

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
            props.secretKey
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
            props.secretKey
          )
        )
      )

      await Promise.any(
        pool.publish(
          [...writeRelays, "user.kindpag.es", "purplepag.es"],
          finalizeEvent(
            {
              kind: 3,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: ""
            },
            props.secretKey
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
            props.secretKey
          )
        )
      )

      setProfilePublishSuccess(true)
    } catch (error) {
      console.error("Error publishing profile:", error)
      setProfilePublishError("Failed to publish profile. Please try again.")
    } finally {
      setIsPublishing(false)
    }
  }

  async function publishNote() {
    setIsPublishingNote(true)
    setNotePublishError("")

    try {
      const writeRelays = ["wss://nostr.mom", "wss://relay.damus.io"]
      const note = finalizeEvent(
        {
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: noteText().trim()
        },
        props.secretKey
      )

      await Promise.any(
        pool.publish([...writeRelays, "wss://relay.nos.social", "wss://nos.lol"], note)
      )

      setNotePublishSuccess(neventEncode({ id: note.id, relays: writeRelays, author: publicKey }))
    } catch (error) {
      console.error("Error publishing introduction post:", error)
      setNotePublishError("Failed to publish post. Please try again.")
    } finally {
      setIsPublishingNote(false)
    }
  }

  async function copyToClipboard(text: string, type: "nsec" | "npub") {
    try {
      await navigator.clipboard.writeText(text)
      setCopyResult(v => ({ ...v, [type]: true }))
      setTimeout(() => {
        setCopyResult(v => ({ ...v, [type]: null }))
      }, 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      setCopyResult(v => ({ ...v, [type]: false }))
      setTimeout(() => {
        setCopyResult(v => ({ ...v, [type]: null }))
      }, 2000)
    }
  }
}

export default Account
