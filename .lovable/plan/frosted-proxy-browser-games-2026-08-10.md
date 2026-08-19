# Frosted — proxy browser + games

A black-and-white browser-style web app named **Frosted**, matching the reference screenshot: chrome-style tab strip, address bar, grid-lined dark new tab page with a large wordmark, a search field with an engine picker, and a row of round shortcut buttons — Games only (no Movies, Music, AI).

## What gets built

**Browser shell**

- Tab strip with add/close tabs, per-tab title + favicon, active-tab highlight.
- Address/URL bar with back, forward, reload, fullscreen and settings buttons.
- Each tab holds its own state: new tab page, a proxied website, the games library, or a running game.
- Searching or typing a URL updates that tab's title, favicon and displayed URL live (read from the proxied page), plus the browser tab title/favicon when not cloaked.

**New tab page**

- Grid-line dark background, large "Frosted" wordmark with the underline accent.
- Centered search bar with engine dropdown (DuckDuckGo, Google, Bing).
- Round shortcut buttons: Games, plus an Add button for user-defined shortcuts (stored locally).

**Proxy (Scramjet)**

- Scramjet client + service worker registered at the app root, connected to a public wisp server, so typed URLs and searches load inside the tab's viewport.
- A wisp endpoint field in Settings so it can be swapped if the default is down.

**Games (Lumin source via jsDelivr)**

- Clicking Games opens a new tab showing the real library: fetched game manifest from the jsDelivr-hosted Lumin source, with cover art, titles, search and category filter.
- Clicking a game renders it for real — the game's entry URL loaded through the Scramjet frame (or directly when it's a same-origin static HTML5 game), full-viewport, with fullscreen and back-to-library controls. No placeholder text screens.

**Settings panel**

- Tab cloak: preset cloaks (Google Classroom, Google Drive, Docs, Canvas, Schoology, Clever) plus custom title/favicon; applies immediately to the real browser tab.
- About:blank cloak option (opens the app inside an about:blank window).
- Tab close protection: beforeunload confirmation before leaving.
- Panic key: hotkey that redirects to a chosen URL.
- Wisp server URL and default search engine.
- All settings persist in localStorage.

## Design

Pure black and white: near-black background with a faint grid, white text, subtle white/10 borders, circular icon buttons, thin rounded search field. Geometric sans (Inter-ish) with a wide, light wordmark. No color accents anywhere.

## Technical notes

- New route `/` = the browser shell (replaces the placeholder index); everything else renders inside tabs as components, not routes, so tab state survives.
- `@mercuryworkshop/scramjet` added as a dependency; its worker/bundle assets copied into `public/scram/` via a small Vite copy step, service worker registered from a `public/sw.js` shim.
- Games manifest and assets are fetched client-side from the jsDelivr CDN URL; games render in an iframe (proxied through Scramjet when cross-origin).
- Cloak, close-protection and panic-key logic live in a client-only hook (browser APIs in `useEffect`), settings in a React context backed by localStorage.
- No backend/database needed — everything is client-side plus the public wisp relay.

## Caveat

Scramjet needs its service worker to control the page, which works on the published `.lovable.app` site but can behave inconsistently inside the editor preview iframe. Games from the Lumin source that are hosted as static HTML5 bundles will load reliably; any that depend on a dead upstream host will fail regardless of the proxy. If the default public wisp server is rate-limited, swap it in Settings.
