import Image from 'next/image'

import { Button } from '@/components/Button'
import { HeroBackground } from '@/components/HeroBackground'
import { Nip05SearchBar } from '@/components/Nip05SearchBar'
import blurCyanImage from '@/images/blur-cyan.webp'
import blurIndigoImage from '@/images/blur-indigo.webp'
import hwNsecBunker from '/src/images/nsecbunker.png'
import nostrMerch from '/src/images/nostrmerch.png'

export function Hero() {
  return (
    <div className="overflow-hidden bg-slate-900 dark:-mb-32 dark:mt-[-4.5rem] dark:pb-32 dark:pt-[4.5rem] dark:lg:mt-[-4.75rem] dark:lg:pt-[4.75rem]">
      <div className="relative hidden max-sm:block px-4 pt-2 mx-8 mx-auto z-20">
        <Nip05SearchBar></Nip05SearchBar>
      </div>
      <div className="pt-14 pb-16 sm:px-2 lg:relative lg:pt-20 lg:px-0">
        <div className="mx-auto grid max-w-2xl grid-cols-1 items-center gap-y-16 gap-x-8 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
          <div className="relative z-10 md:text-center lg:text-left">
            <Image
              className="absolute bottom-full right-full -mr-72 -mb-56 opacity-50"
              src={blurCyanImage}
              alt=""
              width={530}
              height={530}
              unoptimized
              priority
            />
            <div className="relative">
              <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl md:text-5xl tracking-tight text-transparent">
                A better internet is possible: decentralize Twitter, eBay, IoT and other stuff.
              </p>
              <p className="mt-3 text-xl md:text-2xl tracking-tight text-slate-400">
                Smart-client/dumb-server architecture that can create the free and open internet we were promised.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 md:justify-center lg:justify-start">
                <Button href="https://github.com/nostr-protocol/nostr" target="_blank">GitHub</Button>
                <Button href="https://nostr.org" target="_blank">
                  Nostr.org
                </Button>
                <Button href="https://shop.lnbits.com/product-category/nostr" target="_blank" variant="secondary">
                  Shop
                </Button>
                <Button href="https://my.nostr.com" target="_blank" variant="secondary">
                  My Nostr Identity
                </Button>
              </div>
              <p className="mt-3 text-xs tracking-tight text-slate-400">
                Nostr is a protocol; explore the GitHub or visit nostr.org to learn more. Nostr.com has commercial features.
              </p>
            </div>
          </div>
          <div className="relative lg:static xl:pl-10">
            <div className="absolute inset-x-[-50vw] -top-32 -bottom-48 [mask-image:linear-gradient(transparent,white,white)] dark:[mask-image:linear-gradient(transparent,white,transparent)] lg:left-[calc(50%+14rem)] lg:right-0 lg:-top-32 lg:-bottom-32 lg:[mask-image:none] lg:dark:[mask-image:linear-gradient(white,white,transparent)]">
              <HeroBackground className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 lg:left-0 lg:translate-x-0 lg:translate-y-[-60%]" />
            </div>
            <div className="relative">
              <Image
                className="absolute -top-64 -right-64"
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
                <div className="relative z-20">
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

      <div className="flex justify-center items-center">
        <Image
          src={hwNsecBunker}
          alt="Hardware Nsec Bunker"
          width={200}
          className="mr-2"
        />
        <div className="relative">
          <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl md:text-3xl tracking-tight text-transparent">
            Nsec Remote Signer pre-sale!
          </p>
          <p className="mt-3 text-lg md:text-1x1 tracking-tight text-slate-400">
            Use Nostr everywhere, keep your nsec secure at home.
          </p>
          <div className="mt-4">
            <Button href="https://shop.lnbits.com/product/nsec-remote-signer" target="_blank" variant="secondary">
              Order now $99!
            </Button></div>
        </div>
        <div className="hidden md:flex items-center">
          <Image
            src={nostrMerch}
            alt="Hardware Nsec Bunker"
            width={200}
            className="ml-8"
          />
          <div className="relative">
            <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl md:text-3xl tracking-tight text-transparent">
              Nostr merch
            </p>
            <p className="mt-3 text-lg md:text-1x1 tracking-tight text-slate-400">
              Nostr merch, to help you spread the word.
            </p>
            <div className="mt-4">
              <Button href="https://shop.lnbits.com/product-category/nostr" target="_blank" variant="secondary">Visit Shop</Button></div>
          </div>
        </div>
      </div>
    </div>

  )
}
