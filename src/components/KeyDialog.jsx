import { useState } from 'react'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { NIP05NameSearchDialog } from '@/components/NIP05NameSearchDialog'
import * as nip19 from 'nostr-tools/nip19'

export function KeyDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [keys, setKeys] = useState({ sk: null, pk: null })
  const [isSecretVisible, setIsSecretVisible] = useState(false)
  const [notification, setNotification] = useState(null) // Declare notification state

  const handleScroll = () => {
    const target = document.getElementById('get-nostr')
    if (target) {
      setIsDialogOpen(false)
      target.scrollIntoView({ behavior: 'smooth' })
    } else {
      console.error('Element with id "hero-section" not found.')
    }
  }

  const openDialog = () => {
    setNotification('Generating keys...')
    setTimeout(() => {
      const sk = generateSecretKey() // `sk` is a Uint8Array
      const pk = getPublicKey(sk) // `pk` is a hex string
      let nsec = nip19.nsecEncode(sk)
      let npub = nip19.npubEncode(pk)
      setKeys({ nsec, npub })
      setIsDialogOpen(true)
      setNotification(null)
    }, 1000)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setIsSecretVisible(false)
  }

  const copyNsecToClipboard = () => {
    if (keys.nsec) {
      navigator.clipboard.writeText(keys.nsec)
      showNotification('Copied to clipboard.')
    }
  }

  const copyNpubToClipboard = () => {
    if (keys.nsec) {
      navigator.clipboard.writeText(keys.npub)
      showNotification('Copied to clipboard.')
    }
  }

  const downloadKey = () => {
    if (keys.nsec) {
      const blob = new Blob(
        [
          '############ NOSTR KEYS ############\n\n',
          'Your public key (npub):\n',
          keys.npub,
          '\n\n',
          'Your private key (nsec). Keep it PRIVATE:\n',
          keys.nsec
        ],
        { type: 'text/plain' }
      )
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'nostr-keys.txt'
      link.click()
      showNotification('Keys downloaded.')
    }
  }
  const showNotification = message => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Button */}

      <button
        type="button"
        className="rounded-full dark:bg-white bg-teal-600 hover:bg-teal-500 px-10 py-5 text-lg font-bold dark:text-teal-700 text-white dark:hover:bg-teal-100 md:text-2xl"
        onClick={openDialog}
      >
        Start your journey
      </button>

      {/* Dialog Box */}
      {isDialogOpen && (
        <div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 text-left p-4 overflow-y-auto"
  onClick={closeDialog}
>
  <div
    className="w-full max-w-4xl rounded-lg p-6 shadow-lg bg-slate-100 dark:bg-[rgb(32,34,36)]"
    onClick={(e) => e.stopPropagation()}
  >
            <div className="relative">
              <p className="inline text-teal-600 dark:text-white bg-clip-text font-display text-3xl tracking-tight md:text-5xl">
                Welcome to nostr!
              </p>
              {/* Display Public Key */}
              <div className="mt-4 flex flex-col items-start space-y-4">
                <div className="group relative">
                  <p className="pb-2 tracking-tight text-slate-400 sm:text-2xl md:text-xl">
                    This is your public key. You can share this.
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      className="group relative rounded bg-sky-300 px-2 py-1 text-xs font-bold dark:bg-white bg-teal-600 hover:bg-teal-500 dark:text-teal-700 text-white dark:hover:bg-teal-100"
                      onClick={copyNpubToClipboard}
                    >
                      <span className="material-icons text-xs">
                        content_copy
                      </span>
                      <span className="absolute left-0 top-full mt-1 hidden w-max rounded bg-gray-700 px-3 py-1 text-sm text-xs text-white group-hover:block">
                        Copy to Clipboard
                      </span>
                    </button>
                    <span
                      id="npub"
                      className="rounded bg-gray-800 px-2 py-1 text-xs text-slate-400"
                    >
                      {keys.npub}
                    </span>
                  </div>
                </div>
              </div>

              {/* Display Secret Key */}
              <div className="z-10 mt-6 flex flex-col items-start space-y-4">
                <div className="group relative">
                  <p className="pb-2 tracking-tight text-slate-400 sm:text-2xl md:text-xl">
                    This is your private key. Keep it private.
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      className="group relative rounded bg-sky-300 px-2 py-1 text-xs font-bold dark:bg-white bg-teal-600 hover:bg-teal-500 dark:text-teal-700 text-white dark:hover:bg-teal-100"
                      onClick={copyNsecToClipboard}
                    >
                      <span className="material-icons text-xs">
                        content_copy
                      </span>
                      <span className="absolute left-0 top-full mt-1 hidden w-max rounded bg-gray-700 px-3 py-1 text-sm text-xs text-white group-hover:block">
                        Copy to Clipboard
                      </span>
                    </button>
                    <span className="rounded bg-gray-800 px-2 py-1 text-xs text-slate-400">
                      {isSecretVisible
                        ? keys.nsec
                          ? keys.nsec
                          : 'N/A'
                        : '****************************************************************'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center space-x-4">
                  {/* Download Button */}
                  <button
                    type="button"
                    className="group relative rounded dark:bg-white bg-teal-600 hover:bg-teal-500 text-sm sm:text-lg dark:text-teal-700 text-white dark:hover:bg-teal-100"
                    onClick={downloadKey}
                  >
                    Download keys
                    <span className="absolute left-0 top-full mt-1 hidden w-max rounded bg-gray-700 px-3 py-1 text-sm text-white group-hover:block">
                      Download Keys
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSecretVisible(!isSecretVisible)}
                    className="group relative rounded dark:bg-white bg-teal-600 hover:bg-teal-500  text-sm sm:text-lg dark:text-teal-700 text-white dark:hover:bg-teal-100"
                  >
                    {isSecretVisible ? 'Hide Private Key' : 'Show Private Key'}
                    <span className="absolute left-0 top-full mt-1 hidden w-max rounded bg-gray-700 px-3 py-1 text-sm text-white group-hover:block">
                      Toggle Visibility
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative mt-10">
                <p className="inline text-teal-600 dark:text-white bg-clip-text font-display text-2xl tracking-tight md:text-4xl">
                  I have saved my keys, what next?
                </p>
                <div className="relative z-10 flex flex-col items-start space-y-4 pt-5 md:flex-row md:items-center md:space-y-0">
                  <div className="relative flex flex-col sm:w-1/4 lg:w-2/5 lg:max-w-[34vw]">
                    <NIP05NameSearchDialog></NIP05NameSearchDialog>
                  </div>
                  <button
                    type="button"
                    button
                    onClick={handleScroll}
                    className="rounded-full py-5 text-lg font-bold text-teal-600 hover:text-teal-500 dark:text-white dark:hover:text-teal-100 transition-colors duration-200 hover:border-sky-400 hover:bg-transparent md:ml-4 md:text-2xl"
                  >
                    Skip and checkout Nostr apps
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="absolute right-1 top-1 flex items-center justify-center rounded-full text-lg font-bold text-teal-700 transition-colors duration-200 hover:border-teal-500 hover:bg-transparent hover:text-teal-500 md:text-2xl"
                  title="Close"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Notification */}
      {notification && (
        <div className="fixed bottom-4 left-1/2 z-[101] -translate-x-1/2 transform rounded bg-black px-4 py-2 text-white shadow-md">
          {notification}
        </div>
      )}
    </div>
  )
}
