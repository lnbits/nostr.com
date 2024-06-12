/* globals caches */

export default {
  async fetch(request, _, ctx) {
    let url = new URL(request.url)
    let path = url.pathname

    // ben's fancy pubkeys
    if (path === '/.well-known/nostr.json') {
      return fetch('https://nostrfy.com/nostr.json', cacheOnFetch(48)).then(
        cacheOnBrowser(72)
      )
    }

    // redirect to nip
    if (path.startsWith('/nip/')) {
      let nipNumber = path.split('/')[2]
      return Response.redirect(
        `https://github.com/nostr-protocol/nips/blob/master/${nipNumber}.md`,
        302
      )
    }

    // proxy njump
    if (
      path.startsWith('/e/') ||
      path.startsWith('/p/') ||
      path.startsWith('/r/') ||
      path.startsWith('/npub1') ||
      path.startsWith('/nprofile1') ||
      path.startsWith('/nevent1') ||
      path.startsWith('/naddr') ||
      path.startsWith('/note1') ||
      path.startsWith('/nostr:npub1') ||
      path.startsWith('/nostr:nprofile1') ||
      path.startsWith('/nostr:nevent1') ||
      path.startsWith('/nostr:naddr') ||
      path.startsWith('/nostr:note1') ||
      path.startsWith('/njump/')
    ) {
      let next = `https://nostr.at/${path}${url.search}`
      let ua = request.headers.get('user-agent').toLowerCase()
      let bots = ['bot', 'spider', 'google', 'bing', 'yandex']

      if (bots.filter(b => ua.includes(b)).length) {
        // if it's a bot, we redirect
        return Response.redirect(`https://njump.me/${path}${url.search}`, 301)
      }

      // if it's a normal person or anything like that, we proxy
      let response = await fetch(next, {
        headers: {
          'User-Agent': request.headers.get('User-Agent'),
          Accept: request.headers.get('Accept')
        }
      })

      // remove umami tracker so melvin carvalho can be quiet
      let text = await response.text()
      let stripped = text
        .replace(/<script>let umami.*<\/script>/, '')
        .replace(/<script .*umami\.is.*<\/script>/, '')

      return new Response(stripped, response)
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
