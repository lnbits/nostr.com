const withMarkdoc = require('@markdoc/next.js')

module.exports = withMarkdoc({
  mode: 'static'
})({
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'md'],
  experimental: {
    scrollRestoration: false
  },
  images: {
    unoptimized: true
  }
})
