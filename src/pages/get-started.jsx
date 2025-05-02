import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function GetStartedPage() {
  return (
    <>
      <Head>
        <title>Get started</title>
        <meta name="description" content="Create a nostr account!" />
      </Head>
      <Hero />
    </>
  )
}
