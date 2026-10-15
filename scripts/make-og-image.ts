// Generates public/og-image.png: the 1200×630 card shown when a link to the
// site is shared (Discord, X, iMessage, Slack...). Launch pages override it
// at the edge with the mission's own image; every other page uses this.
//
// Run with `npm run og-image` after changing the brand art or the tagline.
// Node runs this .ts file directly (built-in type stripping, Node 22.18+).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;

// Matches bg.body (#06091A) and the brand teal / terminal green in theme.js
const BG = '#06091A';
const TEAL = '#43c0b8';
const TERMINAL = '#00ff9d';

// Deterministic starfield, so re-running the script doesn't churn the PNG
function stars(count: number): string {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => {
    const x = (rand() * W).toFixed(1);
    const y = (rand() * H).toFixed(1);
    const r = (rand() * 1.3 + 0.3).toFixed(2);
    const o = (rand() * 0.6 + 0.2).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }).join('');
}

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="78%" cy="50%" r="55%">
      <stop offset="0" stop-color="#1b2a5a" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="${BG}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  ${stars(220)}
</svg>`;

const text = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .eyebrow { font: 700 22px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; letter-spacing: 6px; fill: ${TEAL}; }
    .title   { font: 700 68px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
    .sub     { font: 400 30px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #a9b4cc; }
    .url     { font: 600 24px 'Consolas', 'Menlo', monospace; fill: ${TERMINAL}; }
  </style>
  <text x="80" y="200" class="eyebrow">EPHEMERIS · LAUNCH TRACKER</text>
  <text x="80" y="290" class="title">The sky has</text>
  <text x="80" y="370" class="title">a schedule.</text>
  <text x="80" y="438" class="sub">Live countdowns for every rocket launch,</text>
  <text x="80" y="478" class="sub">worldwide. Webcasts, map, and alerts.</text>
  <text x="80" y="550" class="url">ephemeris-online.com</text>
</svg>`;

// The glyph is drawn on a dark tile; screen blending drops most of it and
// keeps the glowing mark (the same trick the site uses for its watermark),
// and a radial mask feathers the tile's corners so no square edge shows.
const GLYPH = 440;
const featherMask = `
<svg xmlns="http://www.w3.org/2000/svg" width="${GLYPH}" height="${GLYPH}">
  <defs>
    <radialGradient id="m" cx="50%" cy="50%" r="50%">
      <stop offset="0.72" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#m)"/>
</svg>`;
const glyph = await sharp(path.join(root, 'brand/glyph.png'))
  .resize(GLYPH, GLYPH)
  .ensureAlpha()
  .composite([{ input: Buffer.from(featherMask), blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp(Buffer.from(background))
  .composite([
    { input: glyph, left: W - GLYPH - 70, top: Math.round((H - GLYPH) / 2), blend: 'screen' },
    { input: Buffer.from(text), left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, 'public/og-image.png'));

console.log('Wrote public/og-image.png');
