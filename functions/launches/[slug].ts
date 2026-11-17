// Serves the app shell for /launches/<slug> with that launch's title,
// description, and image in the head, so link previews and crawlers see the
// mission without running JS. (prerender.mjs can't do this: slugs change daily.)
//
// Cloudflare only. Test with `npx wrangler pages dev dist`.

import { NotFoundError, resolveCached, type Ll2Context } from '../_shared/ll2Cache';
import { isValidSlug, launchBySlugOptions } from '../_shared/launchLookup';
import { SITE_NAME, SITE_URL } from '../../src/seo/routeMeta.js';
import {
  buildLaunchTitle,
  buildLaunchDescription,
  launchImageUrl,
  padCoordinates,
} from '../../src/utils/launchFields';
import type { LaunchDetailed } from '../../src/types/launchLibrary';

const SHELL_CACHE_SECONDS = 300;

/** Set a meta tag's content. HTMLRewriter handles escaping. */
function setMeta(rewriter: HTMLRewriter, selector: string, content: string): HTMLRewriter {
  return rewriter.on(selector, {
    element(el) {
      el.setAttribute('content', content);
    },
  });
}

function jsonLd(launch: LaunchDetailed, url: string): string {
  const image = launchImageUrl(launch);
  const coordinates = padCoordinates(launch);
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
    ...(image ? { image } : {}),
    ...(launch.pad
      ? {
          location: {
            '@type': 'Place',
            name: [launch.pad.name, launch.pad.location?.name].filter(Boolean).join(', '),
            ...(coordinates
              ? {
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: coordinates.lat,
                    longitude: coordinates.lon,
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

  // Escape `<` so "</script" in the data can't close the tag
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

/** Home > Launches > Mission, matching the on-page breadcrumbs. */
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

  const shell = await env.ASSETS.fetch(new URL('/index.html', request.url));

  // 404 status, but still the app shell so visitors see the not-found page
  if (!isValidSlug(slug)) {
    return new Response(shell.body, { status: 404, headers: shell.headers });
  }

  let launch: LaunchDetailed | null = null;
  try {
    const { body } = await resolveCached(context, launchBySlugOptions(slug));
    launch = JSON.parse(body) as LaunchDetailed;
  } catch (err) {
    if (err instanceof NotFoundError) {
      return new Response(shell.body, { status: 404, headers: shell.headers });
    }
    // Upstream is down: serve the plain shell at 200. An outage shouldn't
    // tell Google the page is gone.
    return new Response(shell.body, { status: 200, headers: shell.headers });
  }

  const title = `${buildLaunchTitle(launch)} · ${SITE_NAME}`;
  const description = buildLaunchDescription(launch);
  const url = `${SITE_URL}/launches/${slug}`;
  // Fall back to the site share card
  const launchImage = launchImageUrl(launch);
  const image = launchImage ?? `${SITE_URL}/og-image.png`;

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

  rewriter = setMeta(rewriter, 'meta[property="og:type"]', 'article');

  if (launchImage) {
    // The shell's 1200x630 size is for the share card, not mission photos
    rewriter = rewriter.on('meta[property="og:image:width"], meta[property="og:image:height"]', {
      element(el) {
        el.remove();
      },
    });
  }

  // The shell carries the homepage's canonical and JSON-LD. Replace them.
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
