![Nostr](static/banner.png)

![Beta](https://img.shields.io/badge/status-beta-f59e0b)

This Nostr social client is just one of the kazillion clients that exist.

Built by the LNbits team.

Learn more at [nostr.org](https://nostr.org).

<table>
  <tr>
    <td><img src="static/screenshot-profile-dark.png" alt="Profile view in dark mode" width="420"></td>
    <td><img src="static/screenshot-messages-dark.png" alt="Messages view in dark mode" width="420"></td>
  </tr>
  <tr>
    <td><img src="static/screenshot-feed-dark.png" alt="Feed view in dark mode" width="420"></td>
    <td><img src="static/screenshot-feed-light.png" alt="Feed view in light mode" width="420"></td>
  </tr>
</table>

## About

Nostr is a SvelteKit web client for reading, posting, and managing a Nostr social feed. It supports logged-out browsing, signed-in feeds, profiles, post threads, replies, reactions, reposts, messages, notifications, relay settings, light and dark themes, and installable PWA behavior.

The app is designed to work as a static web app, so it can be hosted on services such as GitHub Pages after building.

## Install

Install dependencies:

```bash
npm ci
```

Run the development server:

```bash
npm run dev
```

Build the web app:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run checks and tests:

```bash
npm run check
npm test -- --run
```
