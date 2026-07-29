// Post-build SEO stamping. Runs after `vite build` (see the build script in
// package.json) and, for every route in routeMeta, writes a copy of
// dist/index.html at dist/<route>/index.html with that route's title,
// description, og tags, and canonical URL baked in. Cloudflare Pages serves
// a static file when one matches the path, so crawlers and link-preview bots
// get route-specific metadata without executing JS; the SPA hydrates on top
// as usual. Also emits dist/sitemap.xml for the non-hidden routes.
//
// This is metadata prerendering only: the page body is still rendered
// client-side. Full HTML prerendering would need the APIs' live data and is
// not worth the fragility for a site whose content changes hourly.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SITE_NAME, SITE_URL, routeMeta } from '../src/seo/routeMeta.js';

const dist = resolve(process.cwd(), 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const escapeHtml = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Replace exactly one occurrence; a miss means index.html changed shape and
// the build should fail loudly rather than ship stale metadata.
function replaceTag(html, pattern, replacement, label, route) {
  if (!pattern.test(html)) {
    throw new Error(`prerender: could not find ${label} in index.html (route ${route})`);
  }
  return html.replace(pattern, replacement);
}

let count = 0;
for (const [route, meta] of Object.entries(routeMeta)) {
  const title = escapeHtml(meta.full ? meta.title : `${meta.title} · ${SITE_NAME}`);
  const description = escapeHtml(meta.description);
  const url = SITE_URL + (route === '/' ? '/' : route);

  let html = template;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, '<title>', route);
  html = replaceTag(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${description}" />`,
    'meta description',
    route
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${title}" />`,
    'og:title',
    route
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${description}" />`,
    'og:description',
    route
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:url"[\s\S]*?\/>/,
    `<meta property="og:url" content="${url}" />`,
    'og:url',
    route
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${title}" />`,
    'twitter:title',
    route
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${description}" />`,
    'twitter:description',
    route
  );

  let headExtras = `<link rel="canonical" href="${url}" />`;
  if (route === '/') {
    // Structured data: tells search engines the site's canonical name
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: meta.description,
      sameAs: ['https://github.com/ABowSEC/Project-Ephemeris'],
    });
    headExtras += `\n    <script type="application/ld+json">${ld}</script>`;
  }
  html = replaceTag(html, /<\/head>/, `${headExtras}\n  </head>`, '</head>', route);

  const outDir = route === '/' ? dist : join(dist, route.slice(1));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  count += 1;
}

const today = new Date().toISOString().slice(0, 10);
const sitemapEntries = Object.entries(routeMeta)
  .filter(([, meta]) => !meta.hidden)
  .map(([route]) => {
    const url = SITE_URL + (route === '/' ? '/' : route);
    return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
  })
  .join('\n');

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`
);

console.log(`prerender: stamped ${count} routes, wrote sitemap.xml`);
