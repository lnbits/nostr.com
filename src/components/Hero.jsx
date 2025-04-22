import Image from 'next/image'

import { Button } from '@/components/Button'
import { KeyDialog } from '@/components/KeyDialog'
import Animation from './Animation'

import FDroid from '/src/images/f_droid_nostr.png'
import Capybara from '/src/images/capybara.png'
import AndroidLink from '/src/images/nostr_android_google_play.png'
import AppleLink from '/src/images/nostr_app_store.png'
import WebBrowser from '/src/images/nostr_web_browser.png'
import NostrApps from '/src/images/nostr_apps.png'
import NostrNetApps from '/src/images/nostr_net_apps.png'

export function Hero() {
  return (
    <div className="overflow-hidden dark:-mb-32 dark:mt-[-4.5rem] dark:pt-[4.5rem] dark:lg:mt-[-4.75rem] dark:lg:pt-[4.75rem]">

      <div className="pb-5 sm:px-2 lg:relative lg:px-0">

        {/* Section: Hero + Cloud Background */}
        <div className="relative z-10 pb-20 pt-10 md:pt-40 dark:bg-teal-700">
          {/* Clouds */}
          <img src="images/cloud1.png" className="absolute top-10 -left-32 w-64 opacity-40 z-0 pointer-events-none" aria-hidden="true" />
          <img src="images/cloud2.png" className="absolute top-40 -right-32 w-72 opacity-40 z-0 pointer-events-none" aria-hidden="true" />
          <img src="images/cloud2.png" className="absolute top-80 left-16 w-64 opacity-40 z-0 pointer-events-none" aria-hidden="true" />

          <div className="relative flex h-3/4 items-center justify-center z-10">
            <div className="relative z-10 flex w-full max-w-7xl px-6 md:flex-row flex-col items-center justify-between">

              {/* Left: Text */}
              <div className="w-full md:w-3/4 flex flex-col items-start space-y-4">
                <p className="bg-clip-text text-center font-display text-3xl font-bold tracking-tight md:text-3xl lg:text-6xl text-teal-600 dark:text-white">
                  A better internet is possible!
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl md:text-5xl">
                  <span className="text-xl text-slate-900 dark:text-white md:text-3xl">
                    Social media and other stuff everyone can access.
                  </span>
                </h1>
                <div className="relative z-50 flex flex-col items-start space-y-4 pt-5 md:flex-row md:items-center md:space-y-0">
                  <KeyDialog />
                </div>
              </div>

              {/* Right: Capybara */}
              <div className="w-full md:w-1/4 flex justify-center mt-10 md:mt-0">
                <Image
                  src={Capybara}
                  alt="F-Droid Download Link"
                  className="w-full max-w-[150px] sm:max-w-[180px] md:max-w-[150px] lg:max-w-[200px]"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Nostr Pitch */}
        <div className="w-full bg-slate-100 dark:bg-[rgb(32,34,36)] py-24 px-4 lg:px-8">
          <div className="relative max-w-7xl mx-auto grid grid-cols-1 items-center gap-x-8 gap-y-16 xl:gap-x-16 xl:px-12">
            <img src="images/cloud1.png" className="absolute top-4 -right-80 w-80 opacity-40 z-0 pointer-events-none" aria-hidden="true" />

            <div className="text-center relative">
              <p className="bg-clip-text font-display text-4xl text-teal-600 dark:text-white md:text-5xl">
                nostr = freedom
              </p>
              <p className="pt-7 text-xl tracking-tight text-slate-400 md:text-2xl">
                YOU control your identity and data NOT the corporate platform or government.
              </p>

              <div className="pt-10 flex flex-wrap justify-center gap-4">
                <Button className="md:text-xl font-bold" href="https://github.com/nostr-protocol/nostr" target="_blank">GitHub</Button>
                <Button id="get-nostr" className="md:text-xl ml-10 font-bold" href="https://nostr.org" target="_blank">Nostr.org</Button>
              </div>

            </div>
          </div>
        </div>

        {/* Section: App Universe Text */}

        <div className="sm:mt-16 relative flex h-3/4 items-center justify-center z-8">
          <div className="relative z-8 flex w-full max-w-7xl px-6 md:flex-row flex-col items-center justify-between">
            <p className="bg-clip-text font-display text-4xl text-teal-600 dark:text-white md:text-4xl">
              A universe of apps all working together.
            </p>
          </div>
        </div>


        {/* Section: App Ecosystem */}
        <div className="mt-8 px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-16 max-w-7xl mx-auto">

            {/* Left: Overlapping phones */}
            <div className="relative w-[200px] sm:w-[260px] h-[520px]">
              <a href="https://amethyst.social" target="_blank" rel="noopener noreferrer">
                <Image
                  src="/images/amethyst.png"
                  alt="Amethyst"
                  className="absolute top-0 left-0 w-[220px] rounded-xl shadow-lg z-5"
                  width={220}
                  height={440}
                />
              </a>
              <a href="https://damus.io" target="_blank" rel="noopener noreferrer">
                <Image
                  src="/images/damus.png"
                  alt="Damus"
                  className="absolute top-16 left-12 w-[220px] rounded-xl shadow-md z-8"
                  width={220}
                  height={440}
                />
              </a>
            </div>

            {/* Right: Overlapping desktop apps */}
            <div className="relative w-full max-w-[770px] h-[360px] sm:h-[520px]">
              <a href="https://primal.net" target="_blank" rel="noopener noreferrer">
                <Image
                  src="/images/primal.png"
                  alt="Primal App"
                  className="absolute top-0 left-0 w-full rounded-xl shadow-lg z-5"
                  width={770}
                  height={520}
                />
              </a>
              <a href="https://jumble.press" target="_blank" rel="noopener noreferrer">
                <Image
                  src="/images/jumble.png"
                  alt="Jumble App"
                  className="absolute top-20 left-16 w-full rounded-xl shadow-md z-8"
                  width={770}
                  height={520}
                />
              </a>
            </div>

          </div>
        </div>

        {/* Section: App Links */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-5 md:pt-10">
          <a href="https://play.google.com/store/search?q=nostr&c=apps" target="_blank" rel="noopener noreferrer">
            <Image src={AndroidLink} alt="Android Download Link" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
          <a href="https://search.f-droid.org/?q=nostr&lang=en" target="_blank" rel="noopener noreferrer">
            <Image src={FDroid} alt="F-Droid Download Link" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
          <a href="https://www.apple.com/us/search/nostr?src=globalnav" target="_blank" rel="noopener noreferrer">
            <Image src={AppleLink} alt="Apple App Store Download Link" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
          <a href="https://coracle.social/" target="_blank" rel="noopener noreferrer">
            <Image src={WebBrowser} alt="Web Browser Version" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
          <a href="https://nostrapps.com" target="_blank" rel="noopener noreferrer">
            <Image src={NostrApps} alt="All Nostr Apps" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
          <a href="https://nostr.net" target="_blank" rel="noopener noreferrer">
            <Image src={NostrNetApps} alt="More Nostr Apps" className="relative flex-1 max-w-[150px] sm:max-w-[100px] md:max-w-[150px] lg:max-w-[200px]" />
          </a>
        </div>

        <section className="bg-slate-100 dark:bg-teal-700 text-white dark:bg-teal-700 relative z-8">
          {/* Top wave */}
          <div className="w-full overflow-hidden leading-none">
            <svg
              className="text-white dark:text-[rgb(32,34,36)]"
              viewBox="0 0 1440 80"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,32 C360,96 1080,0 1440,64 L1440,0 L0,0 Z"
              />
            </svg>
          </div>

          {/* Section Content */}
          <div className="px-6 pt-10 max-w-7xl mx-auto">
            <div className="text-slate-900 dark:text-white grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* Column 1 */}
              <div>
                <h3 className="text-xl font-semibold mb-2">Public-key cryptography</h3>
                <p className="text-base opacity-90">
                  Nostr uses public-key cyrptography. Users can easily verify the data you sent is yours and has not been altered.
                  You can also encrypt messages to send privately.
                </p>
              </div>

              {/* Column 2 */}
              <div>
                <h3 className="text-xl font-semibold mb-2">Relays</h3>
                <p className="text-base opacity-90">
                  Data is shared between users via relays. Users can choose which relays to use and can run their own.
                  No single entity, corporation or government can control the flow of information.
                </p>
              </div>

              {/* Column 3 */}
              <div>
                <h3 className="text-xl font-semibold mb-2">Nostr Improvement Possibilities (NIPs)</h3>
                <p className="text-base opacity-90">
                  Nostr is a protocol, and uses shared standards called NIPs, which allow different apps to share data seamlessly.
                  Nostr is permissionless so ANYONE can create an application.
                </p>
              </div>
            </div>
          </div>
          <div className="relative center">
            <Animation />
          </div>


          {/* Bottom wave */}
          <div className="w-full overflow-hidden leading-none">
            <svg
              className="text-white dark:text-[rgb(32,34,36)] rotate-180 -mb-[1px]"
              viewBox="0 0 1440 80"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,32 C360,96 1080,0 1440,64 L1440,0 L0,0 Z"
              />
            </svg>
          </div>
        </section>


        <figure className="max-w-screen-md mx-auto text-center pt-12">
          <svg
            className="w-20 h-20 mx-auto mb-10 text-teal-700 dark:text-teal-700"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 18 14"
          >
            <path d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z" />
          </svg>
          <blockquote>
            <p className="text-2xl italic font-medium text-gray-900 dark:text-white">
              "nostr is an open protocol. If a platform is a silo, a protocol is a river: no one owns it, and everyone is free to swim."
            </p>
          </blockquote>
          <figcaption className="flex items-center justify-center mt-6 space-x-3">
            <div className="flex items-center divide-x-2 divide-gray-500 dark:divide-gray-700">
              <cite className="pr-3 font-medium text-gray-900 dark:text-white">Edward Snowden</cite>
              <cite className="pl-3 text-sm text-gray-500 dark:text-gray-400">Whistleblower & Privacy Advocate</cite>
            </div>
          </figcaption>
        </figure>


        <figure className="max-w-screen-md mx-auto text-center pt-20">
          <blockquote>
            <p className="text-2xl italic font-medium text-gray-900 dark:text-white">
              "So I just decided to delete my account on Bluesky, and really focus on Nostr, and funding that to the best of my ability. I asked to get off the board as well, because I just don't think a protocol needs a board or wants a board..."
            </p>
          </blockquote>
          <figcaption className="flex items-center justify-center mt-6 space-x-3">
            <div className="flex items-center divide-x-2 divide-gray-500 dark:divide-gray-700">
              <cite className="pr-3 font-medium text-gray-900 dark:text-white">Jack Dorsey</cite>
              <cite className="pl-3 text-sm text-gray-500 dark:text-gray-400">ex-CEO of Twitter</cite>
            </div>
          </figcaption>
        </figure>


        {/* Section: Hero + Cloud Background */}
        <div className="relative z-8 pb-20 pt-20 mt-40 dark:bg-teal-700">
          {/* Clouds */}
          <div className="relative max-w-7xl mx-auto grid grid-cols-1 items-center gap-x-8 gap-y-16 xl:gap-x-16 xl:px-12">

            <div className="text-center relative">
              <p className="bg-clip-text font-display text-4xl text-teal-600 dark:text-white md:text-5xl">
                Get your nostr.com nostr identifier!
              </p>
              <p className="pt-5 text-xl tracking-tight text-slate-400 md:text-2xl">
                Buy and sell nostr identifiers, and much more...
              </p>
              <div className="relative pt-10 flex flex-wrap justify-center gap-4">
                <KeyDialog />
                <div className="flex flex-col items-center justify-center">
                  <button
                    type="button"
                    className="rounded-full dark:bg-white bg-teal-600 hover:bg-teal-500 px-10 py-5 text-lg font-bold dark:text-teal-700 text-white dark:hover:bg-teal-100 md:text-2xl"
                    onClick={() => window.open('https://my.nostr.com', '_blank')}
                  >
                    Go to my.nostr.com
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      <p className="mx-auto text-center pb-5 text-xs tracking-tight text-slate-400">
        When captchas and passwords become too difficult, humanity will empower itself with public-key cryptography — a byproduct will be widespread free speech.
      </p>
    </div>
  )
}
