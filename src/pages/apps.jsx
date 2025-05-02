import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function ClientsPage() {
  return (
    <>
      <Head>
        <title>Apps</title>
        <meta name="description" content="A Universe of Nostr Apps" />
      </Head>
      <Hero />
    </>
  )
}
