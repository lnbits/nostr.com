import {useCallback, useEffect, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/router'
import clsx from 'clsx'
import Image from 'next/image'

import {Hero} from '@/components/Hero'
import {MobileNavigation} from '@/components/MobileNavigation'
import {Navigation} from '@/components/Navigation'
import {Prose} from '@/components/Prose'
import {ThemeSelector} from '@/components/ThemeSelector'
import nostrLogo from '/src/images/nostr.svg'

const relays = [
  'nostr.wine',
  'relay.stoner.com',
  'powrelay.xyz',
  'relayable.org'
]

const navigation = [
  {
    title: 'The Basics',
    links: [
      {title: 'What is Nostr?', href: '/'},
      {title: 'Get started', href: '/get-started'}
    ]
  },
  {
    title: 'The Protocol',
    links: [
      {title: 'The Nostr Protocol', href: '/the-protocol'},
      {title: 'Events', href: '/the-protocol/events'},
      {title: 'NIPs', href: '/the-protocol/nips'}
    ]
  },
  {
    title: 'Clients and relays',
    links: [
      {title: 'Clients', href: '/clients'},
      {title: 'Relays?', href: '/relays'}
    ]
  },
  {
    title: 'Contributing',
    links: [{title: 'How to help Nostr', href: '/contribute'}]
  }
]

function Header({navigation}) {
  let [isScrolled, setIsScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, {passive: true})
    return () => {
      window.removeEventListener('scroll', onScroll, {passive: true})
    }
  }, [])

  const handleSearch = event => {
    event.preventDefault()
    if (!searchQuery.trim()) {
      return
    }
    window.location.href = `https://my.${location.host}?q=${searchQuery.trim()}`
  }

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 flex flex-wrap items-center justify-between bg-white px-4 py-5 shadow-md shadow-slate-900/5 transition duration-500 dark:shadow-none sm:px-6 lg:px-8',
        isScrolled
          ? 'dark:bg-slate-900/95 dark:backdrop-blur dark:[@supports(backdrop-filter:blur(0))]:bg-slate-900/75'
          : 'dark:bg-transparent'
      )}
    >
      <div className="mr-6 flex lg:hidden">
        <MobileNavigation navigation={navigation} />
      </div>
      <div className="relative flex flex-grow basis-0 items-center">
        <Link href="/" aria-label="Home page" className="flex items-center">
          <Image
            src={nostrLogo}
            alt="Nostr Logo"
            width={40}
            height={40}
            className="mr-2"
          />
          <span className="flex font-display text-2xl font-bold text-slate-900 dark:text-sky-100 md:text-3xl">
            Nostr
          </span>
        </Link>
      </div>
      <div className="relative flex basis-0 items-center justify-end gap-2 sm:gap-4 md:flex-grow">
        <form
          onSubmit={handleSearch}
          className="flex items-center rounded-full bg-slate-700 p-1"
          title="get your NIP05 name!"
        >
          <input
            type="text"
            placeholder="@nostr.com"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-24 bg-transparent text-white placeholder-slate-400 focus:outline-none sm:w-32"
          />
          <button
            type="submit"
            className="ml-2 rounded-full bg-sky-400 px-3 py-1 text-sm text-slate-900"
          >
            Search
          </button>
        </form>
        <div className="hidden sm:block">
          <ThemeSelector className="relative z-10" />
        </div>
      </div>
    </header>
  )
}

function useTableOfContents(tableOfContents) {
  let [currentSection, setCurrentSection] = useState(tableOfContents[0]?.id)

  let getHeadings = useCallback(tableOfContents => {
    return tableOfContents
      .flatMap(node => [node.id, ...node.children.map(child => child.id)])
      .map(id => {
        let el = document.getElementById(id)
        if (!el) return

        let style = window.getComputedStyle(el)
        let scrollMt = parseFloat(style.scrollMarginTop)

        let top = window.scrollY + el.getBoundingClientRect().top - scrollMt
        return {id, top}
      })
  }, [])

  useEffect(() => {
    if (tableOfContents.length === 0) return
    let headings = getHeadings(tableOfContents)
    function onScroll() {
      let top = window.scrollY
      let current = headings[0].id
      for (let heading of headings) {
        if (top >= heading.top) {
          current = heading.id
        } else {
          break
        }
      }
      setCurrentSection(current)
    }
    window.addEventListener('scroll', onScroll, {passive: true})
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll, {passive: true})
    }
  }, [getHeadings, tableOfContents])

  return currentSection
}

export function Layout({children, title, tableOfContents}) {
  let router = useRouter()
  let isHomePage = router.pathname === '/'
  let section = navigation.find(section =>
    section.links.find(link => link.href === router.pathname)
  )
  let currentSection = useTableOfContents(tableOfContents)

  function isActive(section) {
    if (section.id === currentSection) {
      return true
    }
    if (!section.children) {
      return false
    }
    return section.children.findIndex(isActive) > -1
  }

  return (
    <>
      <Header navigation={navigation} />

      {isHomePage && <Hero />}

      <div className="relative mx-auto flex max-w-8xl justify-center sm:px-2 lg:px-8 xl:px-12">
        <div className="hidden lg:relative lg:block lg:flex-none">
          <div className="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden" />
          <div className="absolute bottom-0 right-0 top-16 hidden h-12 w-px bg-gradient-to-t from-slate-800 dark:block" />
          <div className="absolute bottom-0 right-0 top-28 hidden w-px bg-slate-800 dark:block" />
          <div className="sticky top-[4.5rem] -ml-0.5 h-[calc(100vh-4.5rem)] overflow-y-auto overflow-x-hidden py-16 pl-0.5">
            <Navigation
              navigation={navigation}
              className="w-64 pr-8 xl:w-72 xl:pr-16"
            />
          </div>
        </div>
        <div className="min-w-0 max-w-2xl flex-auto px-4 py-16 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
          <article>
            {(title || section) && (
              <header className="mb-9 space-y-1">
                {section && (
                  <p className="font-display text-sm font-medium text-sky-500">
                    {section.title}
                  </p>
                )}
                {title && (
                  <h1 className="font-display text-3xl tracking-tight text-slate-900 dark:text-white">
                    {title}
                  </h1>
                )}
              </header>
            )}
            <Prose>{children}</Prose>
          </article>
        </div>
        <div className="hidden xl:sticky xl:top-[4.5rem] xl:-mr-6 xl:block xl:h-[calc(100vh-4.5rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6">
          <nav aria-labelledby="on-this-page-title" className="w-56">
            {tableOfContents.length > 0 && (
              <>
                <h2
                  id="on-this-page-title"
                  className="font-display text-sm font-medium text-slate-900 dark:text-white"
                >
                  On this page
                </h2>
                <ol role="list" className="mt-4 space-y-3 text-sm">
                  {tableOfContents.map(section => (
                    <li key={section.id}>
                      <h3>
                        <Link
                          href={`#${section.id}`}
                          className={clsx(
                            isActive(section)
                              ? 'text-sky-500'
                              : 'font-normal text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                          )}
                        >
                          {section.title}
                        </Link>
                      </h3>
                      {section.children.length > 0 && (
                        <ol
                          role="list"
                          className="mt-2 space-y-3 pl-5 text-slate-500 dark:text-slate-400"
                        >
                          {section.children.map(subSection => (
                            <li key={subSection.id}>
                              <Link
                                href={`#${subSection.id}`}
                                className={
                                  isActive(subSection)
                                    ? 'text-sky-500'
                                    : 'hover:text-slate-600 dark:hover:text-slate-300'
                                }
                              >
                                {subSection.title}
                              </Link>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <h2 className="mt-5 font-display text-sm font-medium text-slate-900 dark:text-white">
              Example relays
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {relays.map(hostname => (
                <div key={hostname}>
                  <a
                    className="mt-2 text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                    href={`https://njump.me/r/${hostname}`}
                    target="_blank"
                  >
                    Browse {hostname}
                  </a>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
