import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import Image from 'next/image'

import { Button } from '@/components/Button'
import { Hero } from '@/components/Hero'
import { ThemeSelector } from '@/components/ThemeSelector'
import nostrLogo from '/src/images/nostr.png'

const navigation = []

function Header({ navigation }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 flex flex-wrap items-center justify-between bg-teal-600 dark:bg-teal-700 px-4 py-5 shadow-md shadow-slate-900/5 transition duration-500 dark:shadow-none sm:px-6 lg:px-8',
        isScrolled
          ? 'bg-teal-600/95 dark:bg-teal-600/95 dark:backdrop-blur dark:[@supports(backdrop-filter:blur(0))]:bg-teal-600/75'
          : 'dark:bg-teal-800'
      )}
    >
      <div className="relative mr-6 flex">

        <div className="relative flex flex-grow basis-0 items-center">
          <Link href="/" aria-label="Home page" className="flex items-center">
            <Image src={nostrLogo} alt="Nostr Logo" width={32} height={32} className="mr-2" />
            <span className="flex font-display text-2xl font-bold text-white md:text-3xl">nostr</span>
          </Link>
        </div>
      </div>
      <div className="relative flex flex-auto basis-0 items-center justify-end gap-2 sm:gap-4 md:flex-grow">
        <div className="relative z-10 mr-3">
          <button
                    type="button"
                    className="py-2 px-4 bg-white hover:bg-teal-100 text-teal-900 dark:bg-white dark:hover:bg-teal-100 dark:text-teal-900"
                    onClick={() => window.open('https://my.nostr.com/login', '_blank')}
                  >
                    Account
                  </button>
          <Button
            className="ml-3"
            href="https://shop.lnbits.com/product-category/nostr"
            target="_blank"
            variant="secondary"
          >
            Shop
          </Button>
        </div>
        <ThemeSelector className="relative z-10" style={{ display: 'none' }} />
      </div>
    </header>
  )
}

export function Layout({ children }) {
  const router = useRouter()
  const isHomePage = router.pathname === '/'

  return (
    <>
      <Header navigation={navigation} />
      {isHomePage && <Hero />}
    </>
  )
}
