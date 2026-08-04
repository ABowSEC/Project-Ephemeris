# Ephemeris

Live spaceflight dashboard: rocket launch tracking, a world launch map, ISS telemetry, Mars imagery, and NASA's picture of the day, all in a single installable React PWA.

## Quick Start

Requires Node.js 22+.

```bash
npm install
cp .env.example .env   # add VITE_NASA_API_KEY (free at api.nasa.gov)
npm run dev
```

Without a key the app falls back to NASA's shared `DEMO_KEY` (about 30 requests/hour). A personal key allows 1,000/hour.

```bash
npm run build     # production build to dist/
npm run preview   # serve the build locally
npm run lint
npm run typecheck # tsc over src/ and functions/
```

Cloudflare Pages Functions (the launch API proxy, per-launch social metadata,
and the launch sitemap) do not run under `npm run dev`. To exercise those:

```bash
npm run build && npx wrangler pages dev dist
```

The `crates/orbital` WebAssembly module is optional: `npm run build` compiles it
when a Rust toolchain and `wasm-pack` are installed and skips it with a warning
otherwise, in which case launch-lighting details are simply hidden.

## Features

- **Launch tracker**: upcoming launches worldwide with live countdowns, status, search, and filters
- **Launch pages**: a permanent URL per mission (`/launches/<slug>`) with the official webcast or replay, curator-written mission updates, weather and hold reasons, launch statistics, and per-launch social previews rendered at the edge
- **World launch map**: every scheduled launch site on an interactive dark map
- **Favorites and alerts**: star launches to track them; T-60m / T-10m / liftoff notifications while the app is open
- **Calendar export**: add any launch to Google Calendar or download an .ics file
- **ISS live**: real-time position, ground track, telemetry, and onboard video
- **APOD**: NASA's Astronomy Picture of the Day on the home page
- **Mars and Explore**: rover imagery and full-text search of NASA's image library
- **Installable PWA**: offline app shell with cached launch data and map tiles
- Hidden: enter the Konami code anywhere to unlock the 3D solar system sim

## Stack

React 18, Vite, Chakra UI, React Router (code-split routes), Framer Motion, Three.js, Leaflet + MapLibre GL, vite-plugin-pwa. Deployed on Cloudflare Pages, with Pages Functions for the cached Launch Library proxy and edge-rendered metadata.

TypeScript is being adopted incrementally: new code is written in `.ts`/`.tsx` under `strict`, while existing `.jsx` continues to work unchecked via `allowJs`. `crates/orbital` is a Rust crate compiled to WebAssembly for solar and observer geometry — currently launch lighting, and the foundation for ISS pass prediction.

## Data Sources

| Surface        | Source                                                       |
| -------------- | ------------------------------------------------------------ |
| Launches       | Launch Library 2 (The Space Devs), cached client-side        |
| APOD           | `api.nasa.gov/planetary/apod` (NASA API key)                 |
| Mars / Explore | NASA Image & Video Library (`images-api.nasa.gov`)           |
| ISS            | `api.wheretheiss.at`                                         |
| Map tiles      | OpenFreeMap © OpenMapTiles, data from OpenStreetMap          |

## Support

Ephemeris is free and ad-free. If it's useful to you, you can support development on [Ko-fi](https://ko-fi.com/abowsec) or [GitHub Sponsors](https://github.com/sponsors/ABowSEC).

## License

Copyright (c) 2025 ABowSEC.

Licensed under [CC BY-NC 4.0](./LICENSE): share and adapt with attribution, no commercial use. NASA and other third-party data, imagery, and APIs are subject to their own terms.
