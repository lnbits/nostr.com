import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function GetStartedPage() {
  return (
    <>
      <Head>
        <title>The Protocol</title>
        <meta name="description" content="Information on how the Nostr protocol works." />
      </Head>
      <Hero />
    </>
  )
}
