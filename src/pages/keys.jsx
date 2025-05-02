import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function GetStartedPage() {
  return (
    <>
      <Head>
        <title>What are keys?</title>
        <meta name="description" content="Nostr uses public-key cyrptography." />
      </Head>
      <Hero />
    </>
  )
}
