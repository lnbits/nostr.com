export default {
  async fetch(request: Request, _env: any, ctx: any): Promise<Response> {
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
      path.startsWith('npub1') ||
      path.startsWith('nprofile1') ||
      path.startsWith('nevent1') ||
      path.startsWith('naddr') ||
      path.startsWith('note1')
    ) {
      let cacheKey = new Request(request.url.toString(), request)
      let cached = await caches.default.match(cacheKey)
      if (cached) return cached
      return fetch(`https://gateway.nostr.com/${path}${query}`)
        .then(cacheIfOk(ctx, cacheKey, 48))
        .then(cacheOnBrowser(72))
    }

    return fetch(
      `https://www.nostr.com/${path}${query}`,
      cacheOnFetch(24)
    ).then(cacheOnBrowser(36))
  }
}

function cacheIfOk(ctx, cacheKey, hours) {
  return (res: Response) => {
    if (res.ok) {
      ctx.waitUntil(caches.default.put(cacheKey, res.clone()))
    }
    return res
  }
}

function cacheOnFetch(hours: number): any {
  return {
    cf: {
      cacheTtl: 60 * 60 * hours,
      cacheEverything: true
    }
  }
}

function cacheOnBrowser(hours: number) {
  return (res: Response) => {
    let modifiedResponse = new Response(res.body, res)
    modifiedResponse.headers.set('Cache-Control', `max-age=${60 * 60 * hours}`)
    return modifiedResponse
  }
}
