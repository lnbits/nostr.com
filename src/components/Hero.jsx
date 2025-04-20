import Image from 'next/image'

import { Button } from '@/components/Button'
import { KeyDialog } from '@/components/KeyDialog'
import Animation from './Animation'
import blurCyanImage from '@/images/blur-cyan.webp'
import blurIndigoImage from '@/images/blur-indigo.webp'
import hwNsecBunker from '/src/images/nsecbunker.png'
import FDroid from '/src/images/f_droid_nostr.png'
import Capybara from '/src/images/capybara.png'
import CapybaraTest from '/src/images/capybaratest.png'
import AndroidLink from '/src/images/nostr_android_google_play.png'
import AppleLink from '/src/images/nostr_app_store.png'
import WebBrowser from '/src/images/nostr_web_browser.png'
import NostrApps from '/src/images/nostr_apps.png'
import NostrNetApps from '/src/images/nostr_net_apps.png'
import nostrMerch from '/src/images/nostrmerch.png'

export function Hero() {
  return (
    <div className="overflow-hidden dark:-mb-32 dark:mt-[-4.5rem] dark:pb-32 dark:pt-[4.5rem] dark:lg:mt-[-4.75rem] dark:lg:pt-[4.75rem]">

      <div className="pb-16 sm:px-2 lg:relative lg:px-0">
        {/* CREATE ACCOUNT AREA */}
        <div className="relative z-10 pb-40 pt-60 dark:bg-teal-700">
          <div className="relative -mt-20 flex h-3/4 items-center justify-center">
            <div className="relative z-10 flex w-full max-w-7xl px-6 md:flex-row flex-col items-center justify-between">

              {/* Left: Text (3/4 width) */}
              <div className="w-full md:w-3/4 flex flex-col items-start space-y-4">
                <p className="bg-clip-text text-center font-display text-3xl font-bold tracking-tight md:text-3xl lg:text-6xl text-teal-600 dark:text-white">
                  A better internet is possible!
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl md:text-5xl">
                  <span className="text-xl text-slate-900 dark:text-white md:text-3xl">
                  Social media and other stuff everyone can access.
                  </span>
                </h1>
                <div className="relative z-10 flex flex-col items-start space-y-4 pt-5 md:flex-row md:items-center md:space-y-0">
                  <KeyDialog />
                </div>
              </div>

              {/* Right: Capybara (1/4 width) */}
              <div className="w-full md:w-1/4 flex justify-center mt-10 md:mt-0">

                <Image
            src={Capybara}
            alt="F-Droid Download Link"
            width={200}
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
          />
              </div>
            </div>
          </div>
        </div>


        {/* CREATE ACCOUNT AREA END */}
        <div className=" pt-20 mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
          <div className="relativemd:text-center lg:text-left">
            <div className="relative">
              <p className="bg-clip-text font-display text-4x1 text-teal-600 dark:text-white md:text-4xl">
              Open-source/apolitical/free-speech commons.
              </p>
              <p className="mt-3 text-xl tracking-tight text-slate-400 md:text-2xl">
                Smart-client/dumb-server architecture that can create the free
                and open internet we were promised.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 md:justify-center lg:justify-start">
                <Button
                  href="https://github.com/nostr-protocol/nostr"
                  target="_blank"
                >
                  GitHub
                </Button>
                <Button href="https://nostr.org" target="_blank">
                  Nostr.org
                </Button>
                <Button
                  href="https://shop.lnbits.com/product-category/nostr"
                  target="_blank"
                  variant="secondary"
                >
                  Shop
                </Button>
                <Button
                  href="https://my.nostr.com"
                  target="_blank"
                  variant="secondary"
                >
                  My Nostr Identity
                </Button>
              </div>
              <p
                id="get-nostr"
                className="mt-3 text-xs tracking-tight text-slate-400"
              >
                Nostr is a protocol; explore the GitHub or visit nostr.org to
                learn more. Nostr.com has commercial features.
              </p>
            </div>
          </div>

          <div className="relative lg:static xl:pl-10">
            <div className="relative">
            <Animation />
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:grid-cols-2 md:grid-cols-3 pb-10">
  <a
    href="https://play.google.com/store/search?q=nostr&c=apps"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={AndroidLink}
      alt="Android Download Link"
      width={200}
      className="mx-auto"
    />
  </a>
  <a
    href="https://search.f-droid.org/?q=nostr&lang=en"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={FDroid}
      alt="F-Droid Download Link"
      width={200}
      className="mx-auto"
    />
  </a>
  <a
    href="https://www.apple.com/us/search/nostr?src=globalnav"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={AppleLink}
      alt="Apple App Store Download Link"
      width={200}
      className="mx-auto"
    />
  </a>
  <a
    href="https://coracle.social/"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={WebBrowser}
      alt="Web Browser Version"
      width={200}
      className="mx-auto"
    />
  </a>
  <a
    href="https://nostrapps.com"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={NostrApps}
      alt="All Nostr Apps"
      width={200}
      className="mx-auto"
    />
  </a>
  <a
    href="https://nostr.net"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src={NostrNetApps}
      alt="More Nostr Apps"
      width={200}
      className="mx-auto"
    />
  </a>
</div>

            </div>

          </div>
        </div>
      </div>
     
      <div className="flex items-center justify-center">
        <a
          href="https://shop.lnbits.com/product/nsec-remote-signer"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={hwNsecBunker}
            alt="Hardware Nsec Bunker"
            width={200}
            className="mr-2"
          />
        </a>
        <div className="relative">
          <p className="inline text-teal-600 dark:text-white bg-clip-text font-display text-2xl tracking-tight md:text-3xl">
            Nsec Remote Signer pre-sale!
          </p>
          <p className="md:text-1x1 mt-3 text-lg tracking-tight text-slate-400">
            Use Nostr everywhere, keep your nsec secure at home.
          </p>
          <div className="mt-4">
            <Button
              href="https://shop.lnbits.com/product/nsec-remote-signer"
              target="_blank"
              variant="secondary"
            >
              Order now $99!
            </Button>
          </div>
        </div>
        <div className="hidden items-center md:flex">
          <a
            href="https://shop.lnbits.com/product-category/nostr"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src={nostrMerch}
              alt="Hardware Nsec Bunker"
              width={200}
              className="ml-8"
            />
          </a>
          <div className="relative">
            <p className="text-teal-600 dark:text-white bg-clip-text font-display text-2xl tracking-tight md:text-3xl">
              Nostr merch
            </p>
            <p className="md:text-1x1 mt-3 text-lg tracking-tight text-slate-400">
              Nostr merch, to help you spread the word.
            </p>
            <div className="mt-4">
              <Button
                href="https://shop.lnbits.com/product-category/nostr"
                target="_blank"
                variant="secondary"
              >
                Visit Shop
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
