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
 */
export function usePageMeta(path) {
  useEffect(() => {
    const meta = routeMeta[path];
    if (!meta) return;

    const title = meta.full ? meta.title : `${meta.title} · ${SITE_NAME}`;
    const url = SITE_URL + (path === '/' ? '/' : path);

    document.title = title;
    setContent('meta[name="description"]', meta.description);
    setContent('meta[property="og:title"]', title);
    setContent('meta[property="og:description"]', meta.description);
    setContent('meta[property="og:url"]', url);
    setContent('meta[name="twitter:title"]', title);
    setContent('meta[name="twitter:description"]', meta.description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [path]);
}
