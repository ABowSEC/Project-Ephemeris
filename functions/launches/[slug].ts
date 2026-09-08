// Pages Function: serves the app shell for /launches/<slug> with real
// per-launch metadata stamped into it.
//
// scripts/prerender.mjs already does this for the fixed routes at build time,
// but it cannot cover launches whose slugs did not exist when the build ran —
// which is most of them, since the manifest changes daily. Cloudflare's
// HTMLRewriter closes that gap: the shell streams through untouched except for
// the handful of head tags that crawlers and link-preview bots (Discord,
// Slack, X) read before any JavaScript runs.
//
// The mission image becomes og:image, so a shared launch link previews as the
// mission rather than as the site logo. That is the whole point of this file.
//
// Note this only runs on Cloudflare — `npm run dev` has no Functions runtime,
// so use `npx wrangler pages dev dist` to see it work.

import { NotFoundError, resolveCached, type Ll2Context } from '../_shared/ll2Cache';
import { isValidSlug, launchBySlugOptions } from '../_shared/launchLookup';
// Shared with the SPA and the build-time prerenderer so the site name and
// canonical origin are defined exactly once. routeMeta.js is deliberately
// dependency-free, which is what makes importing it here safe.
import { SITE_NAME, SITE_URL } from '../../src/seo/routeMeta.js';
// Same reasoning: launchFields.ts is dependency-free/DOM-free by convention,
// so it's safe to import here too. This is also what LaunchDetailPage.tsx's
// usePageMeta override uses, so the edge-rendered shell and the client-side
// SPA navigation can never disagree on title/description again.
import { buildLaunchTitle, buildLaunchDescription } from '../../src/utils/launchFields';
import type { LaunchDetailed } from '../../src/types/launchLibrary';

const SHELL_CACHE_SECONDS = 300;

/**
 * Rewrites one meta tag's content attribute. HTMLRewriter escapes attribute
 * values itself, so nothing here needs manual HTML escaping.
 */
function setMeta(rewriter: HTMLRewriter, selector: string, content: string): HTMLRewriter {
  return rewriter.on(selector, {
    element(el) {
      el.setAttribute('content', content);
    },
  });
}

function jsonLd(launch: LaunchDetailed, url: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: launch.name,
    startDate: launch.net,
    eventStatus:
      launch.status?.abbrev === 'Go'
        ? 'https://schema.org/EventScheduled'
        : 'https://schema.org/EventPostponed',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    url,
    ...(launch.image ? { image: launch.image } : {}),
    ...(launch.pad
      ? {
          location: {
            '@type': 'Place',
            name: [launch.pad.name, launch.pad.location?.name].filter(Boolean).join(', '),
            ...(launch.pad.latitude && launch.pad.longitude
              ? {
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: Number(launch.pad.latitude),
                    longitude: Number(launch.pad.longitude),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(launch.launch_service_provider
      ? {
          organizer: {
            '@type': 'Organization',
            name: launch.launch_service_provider.name,
          },
        }
      : {}),
  };

  // Escape `<` so a stray "</script" inside any string can't close the block early
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

/**
 * Mirrors the visible Home > Launches > Mission breadcrumb trail
 * (src/components/Breadcrumbs.tsx) so crawlers — which never run the SPA's
 * client-side breadcrumb markup — still see the crawl path.
 */
function breadcrumbJsonLd(launch: LaunchDetailed, url: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Launches', item: `${SITE_URL}/launches` },
      { '@type': 'ListItem', position: 3, name: launch.mission?.name ?? launch.name, item: url },
    ],
  };
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  const { request, env, params } = context;
  const slug = String(params.slug ?? '');

  // The SPA shell, not this route — asking ASSETS for /launches/<slug> would
  // come back through the _redirects fallback rather than as a file.
  const shell = await env.ASSETS.fetch(new URL('/index.html', request.url));

  // Malformed slugs never reach the API. 404 so crawlers stop, but still hand
  // back the shell so a human sees the app's own not-found page.
  if (!isValidSlug(slug)) {
    return new Response(shell.body, { status: 404, headers: shell.headers });
  }

  // "No such launch" and "upstream is down" need different answers, and
  // resolveCached distinguishes them by throwing NotFoundError only for the
  // former. (An earlier version used readCached, which flattens every failure
  // to null — that made well-formed but nonexistent slugs return 200, leaving
  // them indexable.)
  let launch: LaunchDetailed | null = null;
  try {
    const { body } = await resolveCached(context, launchBySlugOptions(slug));
    launch = JSON.parse(body) as LaunchDetailed;
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Upstream is certain this launch does not exist: tell crawlers so.
      return new Response(shell.body, { status: 404, headers: shell.headers });
    }
    // Upstream trouble, which is recoverable. Serve the unmodified shell at
    // 200 and let the SPA render from its own cache — a transient Space Devs
    // outage must not tell Google that a real launch page is gone.
    return new Response(shell.body, { status: 200, headers: shell.headers });
  }

  const title = `${buildLaunchTitle(launch)} · ${SITE_NAME}`;
  const description = buildLaunchDescription(launch);
  const url = `${SITE_URL}/launches/${slug}`;
  const image = launch.image ?? `${SITE_URL}/icons/icon-512.png`;

  let rewriter = new HTMLRewriter().on('title', {
    element(el) {
      el.setInnerContent(title);
    },
  });

  rewriter = setMeta(rewriter, 'meta[name="description"]', description);
  rewriter = setMeta(rewriter, 'meta[property="og:title"]', title);
  rewriter = setMeta(rewriter, 'meta[property="og:description"]', description);
  rewriter = setMeta(rewriter, 'meta[property="og:url"]', url);
  rewriter = setMeta(rewriter, 'meta[property="og:image"]', image);
  rewriter = setMeta(rewriter, 'meta[property="og:image:alt"]', launch.name);
  rewriter = setMeta(rewriter, 'meta[name="twitter:title"]', title);
  rewriter = setMeta(rewriter, 'meta[name="twitter:description"]', description);
  rewriter = setMeta(rewriter, 'meta[name="twitter:image"]', image);

  // og:type is "website" in the shell; a specific launch is an article-like
  // page with a real publication moment.
  rewriter = setMeta(rewriter, 'meta[property="og:type"]', 'article');

  if (launch.image) {
    // The shell declares 512x512 for the square logo. Mission photos are
    // arbitrary sizes, and a wrong declared size makes previews letterbox
    // badly — better to state nothing and let the scraper measure.
    rewriter = rewriter.on('meta[property="og:image:width"], meta[property="og:image:height"]', {
      element(el) {
        el.remove();
      },
    });
  }

  // The shell is dist/index.html, which scripts/prerender.mjs already stamped
  // with the *homepage's* canonical and its WebSite JSON-LD. Appending ours on
  // top left two canonical tags on every launch page, the first pointing at
  // the site root — conflicting signals that a crawler resolves by picking one
  // arbitrarily or ignoring both. Strip the inherited pair, then append.
  rewriter = rewriter.on('link[rel="canonical"], script[type="application/ld+json"]', {
    element(el) {
      el.remove();
    },
  });

  rewriter = rewriter.on('head', {
    element(el) {
      el.append(`<link rel="canonical" href="${url}" />`, { html: true });
      el.append(`<script type="application/ld+json">${jsonLd(launch, url)}</script>`, {
        html: true,
      });
      el.append(`<script type="application/ld+json">${breadcrumbJsonLd(launch, url)}</script>`, {
        html: true,
      });
    },
  });

  const headers = new Headers(shell.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', `public, max-age=${SHELL_CACHE_SECONDS}`);

  return rewriter.transform(new Response(shell.body, { status: 200, headers }));
}
