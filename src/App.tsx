import { createSignal, Match, onMount, Show, Switch } from "solid-js"
import { generateSecretKey, getPublicKey } from "@nostr/tools/pure"
import { npubEncode } from "@nostr/tools/nip19"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import Account from "./Account"
import NextSteps from "./NextSteps"

function App(props: { onClose: () => void }) {
  let secretKey: Uint8Array
  let storedKey = sessionStorage.getItem("secretkey")
  if (storedKey) secretKey = hexToBytes(storedKey)
  else {
    secretKey = generateSecretKey()
    sessionStorage.setItem("secretkey", bytesToHex(secretKey))
  }
  const publicKey = getPublicKey(secretKey)
  const npub = npubEncode(publicKey)

  const [showingAccount, setShowingAccount] = createSignal(Boolean(storedKey))
  const [showingNextSteps, setShowingNextSteps] = createSignal(false)

  onMount(() => {
    setTimeout(() => {
      setShowingAccount(true)
    }, 3000)
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
          <Switch>
            <Match when={showingAccount()}>
              <Account
                secretKey={secretKey}
                showNextSteps={showingNextSteps() ? null : () => setShowingNextSteps(true)}
              />
            </Match>
            <Match when={true}>generating account...</Match>
          </Switch>
          <Show when={showingNextSteps()}>
            <NextSteps npub={npub} />
          </Show>
        </div>
      </div>
    </>
  )
}

export default App
