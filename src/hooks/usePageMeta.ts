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
 * Sets title, description, og tags, and canonical for a route from routeMeta,
 * e.g. usePageMeta('/launches'). Keeps metadata right during in-app
 * navigation; direct visits already get it from the prerendered HTML.
 *
 * /launches/:slug passes an `override` instead. Pass null while loading to
 * keep the previous tags until data arrives.
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
