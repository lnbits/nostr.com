import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function GetStartedPage() {
  return (
    <>
      <Head>
        <title>Nostr Improvement Possibilities (NIPs)</title>
        <meta name="description" content="Nostr is a protocol, and uses shared standards called NIPs." />
      </Head>
      <Hero />
    </>
  )
}
