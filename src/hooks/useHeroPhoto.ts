import { useCallback, useMemo, useState } from 'react';
import { useUpcomingLaunches } from './useUpcomingLaunches';
import { useImageInfo } from './useImageStatus';
import { launchImageUrl } from '../utils/launchFields';
import { HERO_PHOTOS, heroPhotoOfTheDay, heroSrc, heroSrcSet } from '../data/heroPhotos';

// Hero box heights, matching Home's layout (photo band on phones, full hero on lg)
export const HERO_PHONE_HEIGHT = 380;
const DESKTOP_HEIGHT = 720;
const LG = 992;
// How far a photo may be enlarged on screen before it looks soft
const MAX_UPSCALE = 1.3;
// The visitor's pick, by id ("live" or a curated slug)
const STORAGE_KEY = 'ephemeris.heroPhoto.v1';
const LIVE = 'live';

export interface HeroChoice {
  id: string;
  src: string;
  srcSet?: string;
  position?: string;
  caption: string;
}

/** True when a photo of this size can cover the hero without visible blur. */
function isSharpEnough(width: number, height: number): boolean {
  if (typeof window === 'undefined' || !width || !height) return false;
  const boxW = window.innerWidth;
  const boxH = boxW >= LG ? DESKTOP_HEIGHT : HERO_PHONE_HEIGHT;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.max(boxW / width, boxH / height) * dpr;
  return scale <= MAX_UPSCALE;
}

function readPick(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePick(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the pick just won't persist
  }
}

const CURATED: HeroChoice[] = HERO_PHOTOS.map((photo) => ({
  id: photo.slug,
  src: heroSrc(photo, photo.widths[photo.widths.length - 1]),
  srcSet: heroSrcSet(photo),
  position: photo.position,
  caption: `${photo.caption} · ${photo.credit}`,
}));

/**
 * Which Home hero photo to show. The options are the next launch's own photo
 * (only when it's sharp enough) and the curated NASA set. Default: the live
 * photo if sharp, else the photo of the day. The visitor's pick is remembered.
 */
export function useHeroPhoto() {
  const { nextLaunch } = useUpcomingLaunches();
  const live = launchImageUrl(nextLaunch);
  const liveInfo = useImageInfo(live);
  const [pick, setPick] = useState<string | null>(readPick);

  const liveSharp = Boolean(live && liveInfo.status === 'ready' && isSharpEnough(liveInfo.width, liveInfo.height));
  // Offer nothing while the live photo is still being measured, so the
  // curated one doesn't flash in first
  const measuring = Boolean(live) && liveInfo.status === 'loading';

  const choices = useMemo<HeroChoice[]>(
    () =>
      liveSharp && live && nextLaunch
        ? [{ id: LIVE, src: live, caption: `Next launch: ${nextLaunch.name}` }, ...CURATED]
        : CURATED,
    [liveSharp, live, nextLaunch]
  );

  const defaultId = liveSharp ? LIVE : heroPhotoOfTheDay()?.slug;
  const current = measuring
    ? null
    : choices.find((c) => c.id === pick) ?? choices.find((c) => c.id === defaultId) ?? null;
  const index = current ? choices.indexOf(current) : -1;

  const step = useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = choices[(index + delta + choices.length) % choices.length];
      setPick(next.id);
      savePick(next.id);
    },
    [choices, index]
  );

  return { current, index, count: choices.length, step };
}
