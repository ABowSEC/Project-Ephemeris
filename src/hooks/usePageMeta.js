import { useEffect } from 'react';
import { SITE_NAME, SITE_URL, routeMeta } from '../seo/routeMeta';

function setContent(selector, content) {
  document.querySelector(selector)?.setAttribute('content', content);
}

/**
 * Sets the document title, meta description, og tags, and canonical link for
 * a route, looked up from routeMeta. Call once per page component with the
 * route path: usePageMeta('/launches').
 *
 * The prerendered HTML (scripts/prerender.mjs) already carries these values
 * for direct visits; this hook keeps them correct across SPA navigations.
 *
 * Parameterized routes (/launches/:slug) have no fixed entry in routeMeta, so
 * they pass an `override` built from the loaded data instead. Their direct-visit
 * and crawler metadata comes from the edge — functions/launches/[slug].ts —
 * and this keeps client-side navigation consistent with it. Pass null while
 * the data is still loading; the previous page's tags stay until it arrives,
 * which is better than blanking them.
 *
 * @param {string} path
 * @param {{ title: string, description: string, image?: string, url?: string } | null} [override]
 */
export function usePageMeta(path, override = null) {
  // Depending on the object identity would re-run this on every render, since
  // callers build the override inline. The values are what matter.
  const { title: overrideTitle, description: overrideDescription, image, url: overrideUrl } =
    override ?? {};

  useEffect(() => {
    const meta = routeMeta[path];
    if (!meta && !overrideTitle) return;

    const title = overrideTitle
      ? `${overrideTitle} · ${SITE_NAME}`
      : meta.full
        ? meta.title
        : `${meta.title} · ${SITE_NAME}`;
    const description = overrideDescription ?? meta?.description ?? '';
    const url = SITE_URL + (overrideUrl ?? (path === '/' ? '/' : path));

    document.title = title;
    setContent('meta[name="description"]', description);
    setContent('meta[property="og:title"]', title);
    setContent('meta[property="og:description"]', description);
    setContent('meta[property="og:url"]', url);
    setContent('meta[name="twitter:title"]', title);
    setContent('meta[name="twitter:description"]', description);

    if (image) {
      setContent('meta[property="og:image"]', image);
      setContent('meta[name="twitter:image"]', image);
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [path, overrideTitle, overrideDescription, image, overrideUrl]);
}
