const { readFileSync, writeFileSync } = require('node:fs');

const origin = 'https://nostr.com';
const nipUrls = nipCodes()
  .map((code) => `${origin}/nip${code.toLowerCase()}`)
  .sort();

function nipCodes() {
  const source = readFileSync('src/lib/nips.ts', 'utf8');
  return [...source.matchAll(/^  '([0-9A-F]{2})': \{/gim)].map((match) => match[1].toUpperCase()).sort();
}

const urls = [
  { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
  { loc: `${origin}/info`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${origin}/clients`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${origin}/nostr-keys`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${origin}/pomegranate`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${origin}/relays`, changefreq: 'monthly', priority: '0.7' },
  ...nipUrls.map((loc) => ({ loc, changefreq: 'monthly', priority: '0.6' }))
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

writeFileSync('static/sitemap.xml', xml);
