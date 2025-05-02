import Head from 'next/head'
import { Hero } from '@/components/Hero'

export default function GetStartedPage() {
  return (
    <>
      <Head>
        <title>What are relays?</title>
        <meta name="description" content="Data is shared between users via relays." />
      </Head>
      <Hero />
    </>
  )
}
