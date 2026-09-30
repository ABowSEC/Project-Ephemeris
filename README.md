# Ephemeris

A free, ad-free spaceflight dashboard for tracking rocket launches, following the ISS, and exploring NASA imagery. Built as an installable React progressive web app (PWA).

**[Open Ephemeris →](https://ephemeris-online.com/)** - use the live site without an account, API key, download, or local setup. You can also install it through a supported browser or run the source locally.

## Features

- **Launch tracker:** upcoming missions worldwide, live countdowns, launch status, search, and filters.
- **Mission pages:** shareable URLs at `/launches/<slug>`, with mission details, webcast or replay links, updates, weather information, hold reasons, and launch statistics when available from the source.
- **3D launch globe:** explore launch sites and their upcoming missions on an interactive globe.
- **Favorites and alerts:** track launches and receive T-60-minute, T-10-minute, and liftoff alerts while the app is running. System notifications require browser support and permission.
- **Calendar export:** add a launch to Google Calendar or download an `.ics` file.
- **ISS live:** position and telemetry refreshed every five seconds, a recent ground track, and an embedded video feed when available.
- **Astronomy Picture of the Day:** NASA's daily image or video on the home page.
- **Mars and Explore:** browse Mars rover imagery and search the NASA Image & Video Library.
- **Installable PWA:** an offline app shell, previously cached launch data, and previously viewed imagery and map resources. Fresh telemetry, uncached content, and video require a connection.
- **Launch lighting:** solar geometry at the launch site, powered by an optional Rust/WebAssembly module.

Easter egg: enter the Konami code to unlock the 3D solar system simulator.

Launch schedules can change. Countdowns update locally; mission data refreshes periodically and may fall back to a cached copy when an upstream service is unavailable.

## Run locally

Requires **Node.js 22+ and npm 11+**.

```bash
git clone https://github.com/ABowSEC/Project-Ephemeris.git
cd Project-Ephemeris
npm ci
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Set `VITE_NASA_API_KEY` in `.env` to your own key from [NASA's API portal](https://api.nasa.gov/), or remove the placeholder value to use the shared `DEMO_KEY`. The NASA key is used for APOD; launch tracking, ISS telemetry, and NASA image-library browsing do not require it.

```bash
npm run dev
```

Open the local URL printed by Vite. NASA's shared demo key has lower request limits, so a personal key is recommended for regular local use. `VITE_` variables are included in the browser bundle; they are not server-side secrets.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build into `dist/` and generate route metadata and the static sitemap |
| `npm run preview` | Serve the production frontend locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript in `src/` and `functions/` |
| `npm run wasm` | Build the optional orbital WebAssembly module |

### Optional WebAssembly module

`crates/orbital` provides solar and observer geometry for launch lighting. With Rust and `wasm-pack` installed, `npm run build` compiles it automatically. Without the toolchain, the build skips the module with a warning and launch-lighting details are hidden. A compilation error fails the build when the toolchain is present.

After installing the toolchain, run `npm run wasm` to make the module available during local development.

## Hosting and API behavior

The live site runs on **Cloudflare Pages**. Pages Functions provide cached launch-feed and mission-detail endpoints, per-mission social metadata, and a launch sitemap. Static route metadata and the main sitemap are generated during the build; page content renders in React.

Launch responses use an edge cache and an optional shared Workers KV namespace, with cached-data fallback on upstream errors. For a Cloudflare deployment:

- Build with `npm run build` and use `dist` as the output directory.
- Set `VITE_NASA_API_KEY` as a build-time environment variable for APOD.
- Optionally bind a Workers KV namespace as `LAUNCHES_CACHE` to share cached launch responses across edge locations.
- Optionally set `LL2_TOKEN` as a server-side Functions secret for authenticated Launch Library access.

Vite development and preview servers do not run Pages Functions. To serve the build alongside the Functions locally:

```bash
npm run build
npx wrangler pages dev dist
```

**Local routing caveat:** the frontend currently selects the launch proxy only on `ephemeris-online.com` and `*.pages.dev`. On localhost, including a Wrangler preview, it calls Launch Library directly. Test local Functions through `/api/launches`, `/api/launch/<slug>`, and `/sitemap-launches.xml`. A custom deployment domain requires updating the host check in `src/services/launchStore.js` to use the proxy.

## Stack

React 18, Vite, Chakra UI, React Router with code-split routes, Framer Motion, Three.js / three-globe, Leaflet / MapLibre GL, and vite-plugin-pwa. Cloudflare Pages Functions run on the Workers runtime.

TypeScript adoption is incremental: `.ts` and `.tsx` modules use strict checking, while existing JavaScript and JSX remain supported through `allowJs` with `checkJs` disabled. The optional orbital module is written in Rust and compiled to WebAssembly.

## Data sources

| Feature | Source |
| --- | --- |
| Launch schedules, mission details, and updates | [Launch Library 2 - The Space Devs](https://thespacedevs.com/llapi), cached at the edge and in the browser |
| Astronomy Picture of the Day | [NASA APOD API](https://api.nasa.gov/) |
| Mars imagery and image search | [NASA Image & Video Library](https://images.nasa.gov/) |
| ISS position and telemetry | [Where the ISS at?](https://wheretheiss.at/) |
| ISS video | NASA's YouTube stream |
| ISS map tiles | [OpenFreeMap](https://openfreemap.org/), using OpenMapTiles and OpenStreetMap data |

Third-party coverage, availability, and request limits affect what the dashboard can display.

## Support

Ephemeris is free and ad-free. If you find it useful, you can support its development through [Ko-fi](https://ko-fi.com/abowsec) or [GitHub Sponsors](https://github.com/sponsors/ABowSEC). Please also consider supporting the services that make its data available.

## License

Copyright (c) 2025 ABowSEC.

Licensed under [CC BY-NC 4.0](./LICENSE): you may share and adapt this project with attribution for noncommercial use. NASA and other third-party data, imagery, and APIs are subject to their own terms.
