import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function ClientsPage() {
  return (
    <>
      <Head>
        <title>Clients</title>
        <meta name="description" content="Explore the universe of apps built on Nostr – social media, messaging, and more!" />
      </Head>
      <Hero />
    </>
  )
}
