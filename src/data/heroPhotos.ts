// Curated hero photos for Home, used when the next launch's own photo is too
// small to fill the hero sharply. Files live in public/hero/ at each width
// listed, as WebP: <slug>-<width>.webp. All are public-domain NASA images.

export interface HeroPhoto {
  slug: string;
  /** Widths available in public/hero/, smallest first. */
  widths: number[];
  /** Caption shown on the photo, e.g. "Artemis I liftoff". */
  caption: string;
  credit: string;
  /** CSS object-position, to keep the rocket in frame on narrow screens. */
  position?: string;
}

// position: x keeps the rocket in frame on phones (photo cropped sideways),
// y keeps the nose in frame on wide screens (photo cropped top and bottom)
export const HERO_PHOTOS: HeroPhoto[] = [
  { slug: 'artemis-1-night', widths: [1280, 1920, 2560], caption: 'Artemis I liftoff', credit: 'NASA/Joel Kowsky', position: '60% 20%' },
  { slug: 'artemis-1-pad', widths: [1280, 1920, 2560], caption: 'Artemis I liftoff', credit: 'NASA/Bill Ingalls', position: '56% 30%' },
  { slug: 'crew-7-night', widths: [1280, 1920, 2560], caption: 'Crew-7 liftoff', credit: 'NASA/Joel Kowsky', position: '50% 30%' },
  { slug: 'artemis-2-dusk', widths: [1280, 1920, 2560], caption: 'Artemis II liftoff', credit: 'NASA/Michael DeMocker', position: '53% 15%' },
];

export const heroSrc = (photo: HeroPhoto, width: number) => `/hero/${photo.slug}-${width}.webp`;

export const heroSrcSet = (photo: HeroPhoto) =>
  photo.widths.map((w) => `${heroSrc(photo, w)} ${w}w`).join(', ');

/** One photo per day, so it changes but doesn't flicker between visits. */
export function heroPhotoOfTheDay(now = new Date()): HeroPhoto | null {
  if (HERO_PHOTOS.length === 0) return null;
  const day = Math.floor(now.getTime() / 86_400_000);
  return HERO_PHOTOS[day % HERO_PHOTOS.length];
}
