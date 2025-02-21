import Image from 'next/image'

import {Button} from '@/components/Button'
import {HeroBackground} from '@/components/HeroBackground'
import {Nip05SearchBar} from '@/components/Nip05SearchBar'
import {KeyDialog} from '@/components/KeyDialog'
import blurCyanImage from '@/images/blur-cyan.webp'
import blurIndigoImage from '@/images/blur-indigo.webp'
import hwNsecBunker from '/src/images/nsecbunker.png'
import FDroid from '/src/images/f_droid_nostr.png'
import AndroidLink from '/src/images/nostr_android_google_play.png'
import AppleLink from '/src/images/nostr_app_store.png'
import WebBrowser from '/src/images/nostr_web_browser.png'
import NostrApps from '/src/images/nostr_apps.png'
import NostrNetApps from '/src/images/nostr_net_apps.png'
import NostrGitHub from '/src/images/nostr_github.png'
import nostrMerch from '/src/images/nostrmerch.png'

export function Hero() {
  return (
    <div className="overflow-hidden bg-slate-900 dark:-mb-32 dark:mt-[-4.5rem] dark:pb-32 dark:pt-[4.5rem] dark:lg:mt-[-4.75rem] dark:lg:pt-[4.75rem]">
      <div className="relative z-20 mx-8 mx-auto hidden px-4 pt-2 max-sm:block">
        <Nip05SearchBar></Nip05SearchBar>
      </div>
      <div className="pb-16 sm:px-2 lg:relative lg:px-0">
        {/* CREATE ACCOUNT AREA */}
        <div className="relative z-10 -mb-20 h-screen">
          <Image
            className="absolute bottom-full right-full -mb-56 -mr-72 opacity-50"
            src={blurCyanImage}
            alt=""
            width={530}
            height={530}
            unoptimized
            priority
          />
          <div className="relative -mt-20 flex h-3/4 items-center justify-center">
            <div className="pt-15 relative z-10 flex flex-col items-start space-y-4">
              {/* Title with pronunciation */}
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl md:text-5xl">
                <br /> <br />
                <br />
                Nostr{' '}
                <span className="italic text-slate-500 dark:text-slate-400">
                  /ˈnɒstʃrə/
                </span>{' '}
                <br />
                <span className="text-xl text-slate-600 dark:text-slate-300 md:text-3xl">
                  (Notes and Other Stuff Transmitted by Relays)
                </span>
              </h1>

              {/* Separate line for "A better internet is possible." */}
              <p
                className="bg-indigo-200 bg-clip-text text-center font-display text-3xl font-bold tracking-tight text-transparent md:text-3xl lg:text-6xl"
                style={{color: 'rgb(125, 211, 252)'}}
              >
                A better internet is possible.
              </p>

              {/* Button container */}
              <div className="relative z-10 flex flex-col items-start space-y-4 pt-5 md:flex-row md:items-center md:space-y-0">
                <KeyDialog></KeyDialog>
                <button
                  type="button"
                  onClick={() => window.open('https://my.nostr.com', '_blank')}
                  className="rounded-full border-2 border-sky-300 py-5 text-lg font-bold text-sky-300 transition-colors duration-200 hover:border-sky-400 hover:bg-transparent hover:text-sky-400 md:ml-4 md:text-2xl"
                >
                  I just want a @nostr.com address
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* CREATE ACCOUNT AREA END */}
        <div className="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
          <div className="relativemd:text-center lg:text-left">
            <div className="relative">
              <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-4xl tracking-tight text-transparent md:text-5xl">
                Social media and other stuff everyone can access.
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
            <div className="absolute inset-x-[-50vw] -bottom-48 -top-32 [mask-image:linear-gradient(transparent,white,white)] dark:[mask-image:linear-gradient(transparent,white,transparent)] lg:-bottom-32 lg:-top-32 lg:left-[calc(50%+14rem)] lg:right-0 lg:[mask-image:none] lg:dark:[mask-image:linear-gradient(white,white,transparent)]">
              <HeroBackground className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50 lg:left-0 lg:translate-x-0 lg:translate-y-[-60%]" />
            </div>
            <div className="relative">
              <Image
                className="absolute -right-64 -top-64"
                src={blurCyanImage}
                alt=""
                width={530}
                height={530}
                unoptimized
                priority
              />
              <div className="relative">
                <Image
                  className="absolute -bottom-40 -right-44"
                  src={blurIndigoImage}
                  alt=""
                  width={567}
                  height={567}
                  unoptimized
                  priority
                />
                <div className="relative">
                  <div className="video-container">
                    <iframe
                      src="https://www.youtube.com/embed/5W-jtbbh3eA"
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl  flex-wrap items-center justify-between gap-y-5 pb-10">
        <a
          href="https://play.google.com/store/search?q=nostr&c=apps"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={AndroidLink}
            alt="Android Download Link"
            width={200}
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
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
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
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
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
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
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
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
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
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
            className="relative flex-1 sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px]"
          />
        </a>
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
          <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl tracking-tight text-transparent md:text-3xl">
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
            <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl tracking-tight text-transparent md:text-3xl">
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
