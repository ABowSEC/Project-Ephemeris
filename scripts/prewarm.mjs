// Populates the edge cache after a deploy, before visitors arrive.
//
// The Pages Functions in functions/api cache Space Devs data in two tiers (see
// functions/_shared/ll2Cache.ts): caches.default per PoP, and the LAUNCHES_CACHE
// KV namespace globally. Both start empty. A visitor landing on a cold cache
// goes straight upstream, and upstream is a 15 request/hour free tier — so the
// first arrivals after a deploy are exactly the ones who get throttled, and
// with no stale copy to fall back on they get a 502.
//
// This script pays that cost itself. It hits the public endpoints, so the
// requests go through the same cache path a visitor would take; because the
// KV tier is global, warming from one machine warms every region.
//
// Run it after a deploy:
//   npm run prewarm
//   npm run prewarm -- --base https://<preview>.pages.dev --limit 12
//
// Deliberately never fails the caller. A prewarm is an optimization: a deploy
// that ships fine but warms slowly is not a broken deploy, and exiting non-zero
// here would break a CI pipeline over nothing.

import { SITE_URL } from '../src/seo/routeMeta.js';

// Warming a slug spends one upstream call, so this is capped well under the
// hourly budget rather than at the feed's 50. These are the launches actually
// on screen, and the long tail warms itself on first visit.
const DEFAULT_LIMIT = 8;

// Spacing between slug requests. The retry/backoff inside the Function already
// absorbs a single throttled response; pacing keeps us from producing a burst
// that throttles every attempt at once.
const DEFAULT_DELAY_MS = 4000;

const FEED_ATTEMPTS = 3;
const FEED_RETRY_MS = 10_000;

function parseArgs(argv) {
  const args = { base: SITE_URL, limit: DEFAULT_LIMIT, delay: DEFAULT_DELAY_MS };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--base':
        args.base = value?.replace(/\/$/, '') ?? args.base;
        break;
      case '--limit':
        args.limit = Number(value) || args.limit;
        break;
      case '--delay':
        args.delay = Number(value) ?? args.delay;
        break;
      default:
        console.warn(`prewarm: ignoring unknown argument ${argv[i]}`);
    }
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The feed is the one request worth retrying: every slug below comes out of it,
// so giving up here means warming nothing at all.
async function fetchFeed(base) {
  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${base}/api/launches`);
      if (response.ok) {
        console.log(`prewarm: feed ok (x-proxy-cache: ${response.headers.get('x-proxy-cache')})`);
        return await response.json();
      }
      console.warn(`prewarm: feed attempt ${attempt} returned ${response.status}`);
    } catch (err) {
      console.warn(`prewarm: feed attempt ${attempt} failed - ${err.message}`);
    }
    if (attempt < FEED_ATTEMPTS) await sleep(FEED_RETRY_MS);
  }
  return null;
}

async function main() {
  const { base, limit, delay } = parseArgs(process.argv.slice(2));
  console.log(`prewarm: warming ${base} (up to ${limit} launches)`);

  const feed = await fetchFeed(base);
  if (!feed) {
    console.warn('prewarm: could not warm the feed; leaving the cache cold');
    return;
  }

  // A launch without a slug cannot have a detail page, so it is not warmable.
  const slugs = (feed.results ?? []).map((launch) => launch?.slug).filter(Boolean).slice(0, limit);

  if (slugs.length === 0) {
    console.warn('prewarm: feed carried no slugs; nothing further to warm');
    return;
  }

  let warmed = 0;
  for (const [index, slug] of slugs.entries()) {
    if (index > 0) await sleep(delay);
    try {
      const response = await fetch(`${base}/api/launch/${slug}`);
      if (response.ok) {
        warmed++;
        console.log(`prewarm: ${slug} ok (${response.headers.get('x-proxy-cache')})`);
      } else {
        // Expected when the hourly budget runs out partway. The slug simply
        // stays cold and warms on its first real visit.
        console.warn(`prewarm: ${slug} returned ${response.status}`);
      }
    } catch (err) {
      console.warn(`prewarm: ${slug} failed - ${err.message}`);
    }
  }

  console.log(`prewarm: warmed ${warmed}/${slugs.length} launches`);
}

await main();
