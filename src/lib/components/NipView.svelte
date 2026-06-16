<script lang="ts">
  import { appPath } from '$lib/paths';
  import type { NipInfo } from '$lib/nips';

  export let nip: NipInfo;

  const siteUrl = 'https://nostr.com';
  const previewImageUrl = `${siteUrl}/banner.png`;

  $: pageTitle = `${nip.id}: ${nip.title} explained in plain English | Nostr`;
  $: description = `${nip.id} explained in plain English: ${nip.summary}`;
  $: canonicalUrl = `${siteUrl}/${nip.slug}`;
  $: jsonLd = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${nip.id}: ${nip.title}`,
      description,
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      isAccessibleForFree: true,
      publisher: {
        '@type': 'Organization',
        name: 'nostr',
        url: siteUrl
      },
      citation: nip.sourceUrl
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'nostr',
          item: siteUrl
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Info',
          item: `${siteUrl}/info`
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: nip.id,
          item: canonicalUrl
        }
      ]
    }
  ]);
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="nostr" />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={previewImageUrl} />
  <meta property="og:image:alt" content="nostr information banner" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={previewImageUrl} />
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<article class="info-view nip-info-view">
  <header class="info-head nip-info-head">
    <a class="info-back" href={appPath('/info')} aria-label="Back to info">← Info</a>
    <p class="nip-kicker">{nip.id}</p>
    <h1>{nip.title}</h1>
    {#each nip.paragraphs as paragraph}
      <p>{paragraph}</p>
    {/each}
    <p>
      Read more in the official
      <a href={nip.sourceUrl} target="_blank" rel="noreferrer">{nip.code}.md</a>
      NIP document.
    </p>
  </header>
</article>
