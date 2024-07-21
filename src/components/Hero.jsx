import Image from 'next/image'

import { Button } from '@/components/Button'
import { HeroBackground } from '@/components/HeroBackground'
import blurCyanImage from '@/images/blur-cyan.webp'
import blurIndigoImage from '@/images/blur-indigo.webp'

export function Hero() {
  return (
    <div className="overflow-hidden bg-slate-900 dark:-mb-32 dark:mt-[-4.5rem] dark:pb-32 dark:pt-[4.5rem] dark:lg:mt-[-4.75rem] dark:lg:pt-[4.75rem]">
      <div className="py-16 sm:px-2 lg:relative lg:py-20 lg:px-0">
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
              <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                A better internet is possible: decentralize Twitter, eBay, IoT and other stuff.
              </p>
              <p className="mt-3 text-2xl tracking-tight text-slate-400">
                Smart-client/dumb-server architecture that can create the free and open internet we were promised.
              </p>
              <div className="mt-8 flex gap-4 md:justify-center lg:justify-start">
                <Button href="https://github.com/nostr-protocol/nostr">GitHub</Button>
                <Button href="https://nostr.org">
                  Nostr.org
                </Button>
                <Button href="https://shop.lnbits.com/product-category/nostr" variant="secondary">
                  Shop
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
    </div>
  )
}
