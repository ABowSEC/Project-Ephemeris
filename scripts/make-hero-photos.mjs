// Crops and resizes the curated Home hero photos into public/hero/ as WebP.
// Originals are public-domain NASA images (images.nasa.gov), kept outside
// the repo. Usage: node scripts/make-hero-photos.mjs <folder of originals>
import sharp from "sharp";
import path from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const WIDTHS = [1280, 1920, 2560];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "hero");

// Crop boxes in source pixels, framed so the rocket clears the text column
const PHOTOS = [
  { slug: "artemis-1-night", file: "NHQ202211160006.jpg", crop: { left: 0, top: 80, width: 4933, height: 2775 } },
  { slug: "artemis-1-pad", file: "NHQ202211160200.jpg", crop: { left: 0, top: 550, width: 4346, height: 2445 } },
  { slug: "crew-7-night", file: "NHQ202308260023.jpg", crop: { left: 0, top: 40, width: 3437, height: 1933 } },
  { slug: "artemis-2-dusk", file: "SLS_MAF_20260401_ArtemisIILaunch_02.jpg", crop: { left: 0, top: 100, width: 2749, height: 2061 } },
];

const src = process.argv[2];
if (!src) throw new Error("Pass the folder holding the NASA originals");
mkdirSync(OUT, { recursive: true });

for (const photo of PHOTOS) {
  const cropped = sharp(path.join(src, photo.file)).extract(photo.crop);
  for (const width of WIDTHS) {
    if (width > photo.crop.width) continue;
    const out = path.join(OUT, `${photo.slug}-${width}.webp`);
    const info = await cropped.clone().resize({ width }).webp({ quality: 74, effort: 6 }).toFile(out);
    console.log(`${path.basename(out)}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
}
