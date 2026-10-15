import { useEffect } from 'react';
import { SITE_NAME, SITE_URL, routeMeta } from '../seo/routeMeta';

/** The site-wide 1200×630 share card (public/og-image.png), used by every route without its own image. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

interface RouteMetaEntry {
  title: string;
  description: string;
  full?: boolean;
}

export interface PageMetaOverride {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

function setContent(selector: string, content: string) {
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
 */
export function usePageMeta(path: string, override: PageMetaOverride | null = null) {
  // Depending on the object identity would re-run this on every render, since
  // callers build the override inline. The values are what matter.
  const overrideTitle = override?.title;
  const overrideDescription = override?.description;
  const image = override?.image;
  const overrideUrl = override?.url;

  useEffect(() => {
    // routeMeta.js stays plain JS (Node scripts import it directly)
    const meta = (routeMeta as Record<string, RouteMetaEntry | undefined>)[path];
    if (!meta && !overrideTitle) return;

    const title = overrideTitle
      ? `${overrideTitle} · ${SITE_NAME}`
      : meta?.full
        ? meta.title
        : `${meta?.title} · ${SITE_NAME}`;
    const description = overrideDescription ?? meta?.description ?? '';
    const url = SITE_URL + (overrideUrl ?? (path === '/' ? '/' : path));

    document.title = title;
    setContent('meta[name="description"]', description);
    setContent('meta[property="og:title"]', title);
    setContent('meta[property="og:description"]', description);
    setContent('meta[property="og:url"]', url);
    setContent('meta[name="twitter:title"]', title);
    setContent('meta[name="twitter:description"]', description);

    // Always set, so a launch page's mission image doesn't linger on the
    // next page the visitor navigates to
    setContent('meta[property="og:image"]', image ?? DEFAULT_OG_IMAGE);
    setContent('meta[name="twitter:image"]', image ?? DEFAULT_OG_IMAGE);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [path, overrideTitle, overrideDescription, image, overrideUrl]);
}
