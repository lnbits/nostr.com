module.exports = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx'],
  experimental: {
    scrollRestoration: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  async exportPathMap() {
    return {
      '/': { page: '/' },
      '/clients': { page: '/clients' },
      '/get-started': { page: '/get-started' },
      '/relays': { page: '/relays' },
      '/nips': { page: '/nips' },
      '/keys': { page: '/keys' },
      '/protocol': { page: '/protocol' },
      '/apps': { page: '/apps' },
    }
  },
}
