export default {
  async fetch(request, env, ctx) {
    let url = new URL(request.url)
    let path = url.pathname
    let query = url.search

    if (path === '/.well-known/nostr.json') {
      return fetch('https://nostrfy.com/nostr.json', cacheOnFetch(48)).then(
        cacheOnBrowser(72)
      )
    }

    if (
      path.startsWith('/e/') ||
      path.startsWith('/p/') ||
      path.startsWith('/npub1') ||
      path.startsWith('/nprofile1') ||
      path.startsWith('/nevent1') ||
      path.startsWith('/naddr') ||
      path.startsWith('/note1')
    ) {
      let accept = request.headers.get('accept')
      console.log('accept', accept)
      if (accept.includes('text/html')) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://gateway.nostr.com' + path
          }
        })
      } else {
        return fetch(`https://nostr-gateway.vercel.app${path}${query}`)
      }
    }

    return new Response('not found', {status: 404})
  }
}

function cacheOnFetch(hours) {
  return {
    cf: {
      cacheTtl: 60 * 60 * hours,
      cacheEverything: true
    }
  }
}

function cacheOnBrowser(hours) {
  return res => {
    let modifiedResponse = new Response(res.body, res)
    modifiedResponse.headers.set('Cache-Control', `max-age=${60 * 60 * hours}`)
    return modifiedResponse
  }
}
