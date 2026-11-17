// Astronomy Picture of the Day, from science.nasa.gov (the old api.nasa.gov
// endpoint shut down in Dec 2026). No API key needed. Differences from the
// old API:
//   - Returns an array of recent entries, newest first; ?date= is ignored.
//   - `url` is the article page; the image is `hdurl`.
//   - Videos have no video URL; the source is only inside `basic_html`.
//   - Text fields are HTML, and the explanation ends with a site footer.
//   - copyright is always filled, so it doesn't mean "not public domain".
// normalizeApod maps entries back to the old field names.

import { fetchJson } from '../utils/fetchJson';

const APOD_URL =
  'https://science.nasa.gov/wp-json/wp/v2/apod-basic/?per_page=1' +
  '&_fields=date,title,permalink,media_type,explanation,copyright,alt,hdurl,basic_html';

// Display size. hdurl can be huge (9000px, several MB); it's still used
// for "Open original".
const DISPLAY_EDGE = 1600;

// Shrink NASA's resizer bounding box (w/h) to the display size. Leaves other
// URLs, or ones already smaller, alone.
function displaySized(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== 'assets.science.nasa.gov' || !u.pathname.startsWith('/dynamicimage/')) return url;
    const w = Number(u.searchParams.get('w')) || Infinity;
    const h = Number(u.searchParams.get('h')) || Infinity;
    const scale = Math.min(1, DISPLAY_EDGE / Math.max(w, h));
    if (scale === 1 && Number.isFinite(w)) return url;
    u.searchParams.set('w', String(Number.isFinite(w) ? Math.round(w * scale) : DISPLAY_EDGE));
    u.searchParams.set('h', String(Number.isFinite(h) ? Math.round(h * scale) : DISPLAY_EDGE));
    u.searchParams.set('fit', 'clip');
    return u.toString();
  } catch {
    return url;
  }
}

// DOMParser builds an inert document: scripts don't run and nothing loads.
function parseHtml(html) {
  return new DOMParser().parseFromString(html || '', 'text/html');
}

function htmlToText(html) {
  return (parseHtml(html).body.textContent || '').replace(/\s+/g, ' ').trim();
}

function cleanExplanation(html) {
  // Body ends at the first blank line; what follows is site news and the
  // "Tomorrow's picture" teaser
  const body = (html || '').split(/<br\s*\/?>\s*<br\s*\/?>/i)[0];
  return htmlToText(body).replace(/^Explanation:\s*/i, '');
}

function cleanCredit(html) {
  return htmlToText(html).replace(/^(Image|Video|Illustration)?\s*Credits?( & Copyright)?:\s*/i, '');
}

// First <video>/<source>/<iframe> src in the entry's standalone page
function findVideoSrc(basicHtml) {
  const el = parseHtml(basicHtml).querySelector('video[src], video source[src], iframe[src]');
  return el?.getAttribute('src') || undefined;
}

export function normalizeApod(entry) {
  const videoSrc = entry.media_type === 'video' ? findVideoSrc(entry.basic_html) : undefined;
  // A video we can't locate degrades to its still frame as an image
  const isVideo = Boolean(videoSrc);
  return {
    date: entry.date,
    title: htmlToText(entry.title),
    explanation: cleanExplanation(entry.explanation),
    copyright: cleanCredit(entry.copyright),
    alt: entry.alt || '',
    media_type: isVideo ? 'video' : 'image',
    url: isVideo ? videoSrc : displaySized(entry.hdurl),
    hdurl: entry.hdurl,
    thumbnail_url: isVideo ? displaySized(entry.hdurl) : undefined,
    permalink: entry.permalink,
  };
}

export async function fetchLatestApod({ signal } = {}) {
  const entries = await fetchJson(APOD_URL, { signal });
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('NASA returned no APOD entries');
  }
  return normalizeApod(entries[0]);
}
