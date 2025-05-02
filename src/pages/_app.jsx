// src/pages/_app.jsx
import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { Analytics } from '@vercel/analytics/react'

import 'focus-visible'
import '@/styles/tailwind.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <title>Nostr: A Simple Protocol for Decentralized Social Media and More.</title>
        <meta name="description" content="Nostr is a protocol, and uses shared standards called NIPs, which allow different apps to share data seamlessly." />
        <link rel="icon" type="image/png" href="/images/logo.png" />
  {/* ✅ Social Sharing Metadata */}
  <meta property="og:title" content="Nostr: A Simple Protocol for Decentralized Social Media and More." />
  <meta property="og:description" content="Nostr is a protocol, and uses shared standards called NIPs, which allow different apps to share data seamlessly." />
  <meta property="og:image" content="https://nostr.com/images/social-card.png" />
  <meta property="og:url" content="https://nostr.com" />
  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Nostr: A Simple Protocol for Decentralized Social Media" />
  <meta name="twitter:description" content="Nostr is a protocol, and uses shared standards called NIPs, which allow different apps to share data seamlessly." />
  <meta name="twitter:image" content="https://nostr.com/images/social-card.png" />
</Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <Analytics />
    </>
  )
}
