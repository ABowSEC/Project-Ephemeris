// Pages Function: a sitemap of the launch detail pages.
//
// Separate from dist/sitemap.xml (written by scripts/prerender.mjs) because
// these URLs are not knowable at build time — the set turns over as launches
// fly and new ones are announced. Both are listed in robots.txt.
//
// It reads through the same cache as /api/launches, so serving it costs no
// upstream request against the 15/hour budget.

import { readCached, type Ll2Context } from './_shared/ll2Cache';
import { upcomingFeedOptions } from './_shared/launchLookup';
import { SITE_URL } from '../src/seo/routeMeta.js';
import type { UpcomingLaunchesResponse } from '../src/types/launchLibrary';

const CACHE_SECONDS = 3600;

const escapeXml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export async function onRequestGet(context: Ll2Context): Promise<Response> {
  const feed = await readCached<UpcomingLaunchesResponse>(context, upcomingFeedOptions);
  const launches = feed?.results ?? [];

  const entries = launches
    .filter((launch) => Boolean(launch.slug))
    .map((launch) => {
      // last_updated is when Space Devs last touched the record, which is
      // exactly what lastmod is supposed to mean here.
      const lastmod = (launch.last_updated ?? launch.net ?? '').slice(0, 10);
      return [
        '  <url>',
        `    <loc>${escapeXml(`${SITE_URL}/launches/${launch.slug}`)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        // Countdowns and status change often enough that daily is honest
        '    <changefreq>daily</changefreq>',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}
