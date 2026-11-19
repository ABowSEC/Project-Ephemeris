import { useCallback, useMemo, useState } from 'react';
import { useUpcomingLaunches } from './useUpcomingLaunches';
import { useImageInfo } from './useImageStatus';
import { launchImageUrl } from '../utils/launchFields';
import { HERO_PHOTOS, heroPhotoOfTheDay, heroSrc, heroSrcSet } from '../data/heroPhotos';

// Photo band height on phones, matching Home's layout
export const HERO_PHONE_HEIGHT = 380;
// The visitor's pick and the launch it was made for: { id, launch }
const STORAGE_KEY = 'ephemeris.heroPhoto.v2';
const LIVE = 'live';

export interface HeroChoice {
  id: string;
  src: string;
  srcSet?: string;
  position?: string;
  caption: string;
}

interface StoredPick {
  id: string;
  launch: string | null;
}

function readPick(): StoredPick | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPick) : null;
  } catch {
    return null;
  }
}

function savePick(pick: StoredPick) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pick));
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
 * Which Home hero photo to show. The next launch's own photo comes first and
 * is the default whenever it loads; the curated NASA set follows (and is the
 * default when there is no launch photo). A visitor's pick is remembered
 * until the next launch changes, so a new launch always leads with its photo.
 */
export function useHeroPhoto() {
  const { nextLaunch } = useUpcomingLaunches();
  const live = launchImageUrl(nextLaunch);
  const liveInfo = useImageInfo(live);
  const launchId = nextLaunch?.id ?? null;
  const [pick, setPick] = useState<StoredPick | null>(readPick);

  const liveReady = Boolean(live && liveInfo.status === 'ready');
  // Offer nothing while the live photo loads, so a curated one doesn't flash in first
  const waiting = Boolean(live) && liveInfo.status === 'loading';

  const choices = useMemo<HeroChoice[]>(
    () =>
      liveReady && live && nextLaunch
        ? [{ id: LIVE, src: live, caption: `Next launch · ${nextLaunch.name}` }, ...CURATED]
        : CURATED,
    [liveReady, live, nextLaunch]
  );

  const pickedId = pick && pick.launch === launchId ? pick.id : null;
  const defaultId = liveReady ? LIVE : heroPhotoOfTheDay()?.slug;
  const current = waiting
    ? null
    : choices.find((c) => c.id === pickedId) ?? choices.find((c) => c.id === defaultId) ?? null;
  const index = current ? choices.indexOf(current) : -1;

  const step = useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = { id: choices[(index + delta + choices.length) % choices.length].id, launch: launchId };
      setPick(next);
      savePick(next);
    },
    [choices, index, launchId]
  );

  return { current, index, count: choices.length, step };
}
