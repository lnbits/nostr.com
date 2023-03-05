export default {
  async fetch(request: Request): Promise<Response> {
    let url = new URL(request.url)
    let path = url.pathname
    let query = url.search

    if (path === '/.well-known/nostr.json') {
      return fetch('https://nostrfy.com/nostr.json')
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
      return fetch(`https://gateway.nostr.com/${path}${query}`)
    }

    return fetch(`https://www.nostr.com/${path}${query}`)
  }
}
