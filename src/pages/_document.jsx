import {Head, Html, Main, NextScript} from 'next/document'
import {NostricaBanner} from '../components/NostricaBanner'

export default function Document() {
  return (
    <Html className="antialiased [font-feature-settings:'ss01']" lang="en">
      <Head></Head>
      <body className="bg-white dark:bg-slate-900">
        <NostricaBanner />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
