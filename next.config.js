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
    }
  },
}
