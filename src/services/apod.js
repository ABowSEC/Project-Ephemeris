// Astronomy Picture of the Day.
//
// NASA retired api.nasa.gov/planetary/apod in September 2026 (shutdown
// December 1, 2026) in favor of a WordPress endpoint on science.nasa.gov.
// No API key is needed. The new response differs in ways that matter here:
//   - It is an array of recent entries, newest first; ?date= is ignored.
//   - `url` is the APOD article page, not the media. The image is `hdurl`.
//   - Videos carry no video URL at all: `hdurl` is a still frame, and the
//     actual <video>/<iframe> source only appears inside `basic_html`.
//   - explanation, credit and copyright are HTML, and the explanation ends
//     with a site-news / "Tomorrow's picture" footer.
//   - copyright is always filled (it mirrors credit), even for NASA-owned
//     images, so it no longer signals public-domain status.
// normalizeApod maps an entry back to the old field names the UI was built
// on, with `url` meaning "the media to render" again.

import { fetchJson } from '../utils/fetchJson';

const APOD_URL =
  'https://science.nasa.gov/wp-json/wp/v2/apod-basic/?per_page=1' +
  '&_fields=date,title,permalink,media_type,explanation,copyright,alt,hdurl,basic_html';

// The longest edge we ask for. hdurl is the full original (6750x9000 and
// several MB is not unusual), far more than a card or even the fullscreen
// viewer can show; hdurl itself is kept for "Open original".
const DISPLAY_EDGE = 1600;

// hdurl points at NASA's dynamicimage resizer, whose w/h params are a
// bounding box (fit=clip keeps the aspect ratio). Shrink the box to the
// display size; leave anything else, or anything already smaller, alone.
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
