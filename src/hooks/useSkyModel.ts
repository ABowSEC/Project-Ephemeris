import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUpcomingLaunches } from './useUpcomingLaunches';
import { useObserver } from './useObserver';
import { useNow } from './useNow';
import { hasFlown } from '../data/launchStatus';
import { skyPosition } from '../utils/sky';
import {
  groupByPad,
  toSkyLaunches,
  type PadGroup,
  type SkyLaunch,
} from '../components/sky/skyLaunches';

/** A launch stays "upcoming" this long after T-0, so a hold does not make it vanish. */
const GRACE_MS = 30 * 60_000;

/** How far ahead a great or good view is preferred over an earlier faint one. */
const BEST_VIEW_WINDOW_MS = 3 * 24 * 60 * 60_000;

/**
 * Everything the sky section needs, in one place: the launch schedule, where
 * the visitor is watching from, and which launch is in focus.
 *
 * The focused launch defaults to the best view coming up in the next few days,
 * else the next launch in sight, else the next of any kind. Choosing one holds
 * until the visitor moves, because a launch that was in sight from Atlanta says
 * nothing about Tokyo.
 */
export function useSkyModel() {
  const upcoming = useUpcomingLaunches();
  const observerState = useObserver();
  const { observer } = observerState;
  const now = useNow(30_000);

  const skyLaunches = useMemo(() => toSkyLaunches(upcoming.launches), [upcoming.launches]);
  const pads: PadGroup[] = useMemo(() => groupByPad(skyLaunches), [skyLaunches]);

  // Upcoming launches left out for lack of a firm time or a real pad
  const unplaced = useMemo(
    () => upcoming.launches.filter((l) => !hasFlown(l.status)).length - skyLaunches.length,
    [upcoming.launches, skyLaunches]
  );

  const [chosenId, setChosenId] = useState<string | null>(null);
  useEffect(() => {
    setChosenId(null);
  }, [observer.lat, observer.lon]);

  const ahead = useMemo(
    () => skyLaunches.filter((l) => l.t > now - GRACE_MS),
    [skyLaunches, now]
  );

  const defaultLaunch = useMemo(() => {
    const scored = ahead
      .map((launch) => ({ launch, visibility: skyPosition(observer, launch, launch.t).visibility }))
      .filter((entry) => entry.visibility !== 'below');
    // A faint daytime launch is a weak headline if a real chance is coming
    // soon, so within the next few days the best view wins; the earliest
    // breaks ties, and beyond that window it is simply the next one in sight.
    const soon = scored.filter((e) => e.launch.t < now + BEST_VIEW_WINDOW_MS);
    const good = soon.find((e) => e.visibility === 'plume') ?? soon.find((e) => e.visibility === 'night');
    return good?.launch ?? scored[0]?.launch ?? ahead[0] ?? null;
  }, [ahead, observer, now]);

  const selected: SkyLaunch | null = useMemo(
    () => skyLaunches.find((l) => l.id === chosenId) ?? defaultLaunch,
    [skyLaunches, chosenId, defaultLaunch]
  );

  const select = useCallback((launch: SkyLaunch) => setChosenId(launch.id), []);

  return {
    ...observerState,
    launches: upcoming.launches,
    loading: upcoming.loading,
    error: upcoming.error,
    stale: upcoming.stale,
    fetchedAt: upcoming.fetchedAt,
    refresh: upcoming.refresh,
    skyLaunches,
    ahead,
    pads,
    unplaced,
    selected,
    select,
    now,
  };
}

export type SkyModel = ReturnType<typeof useSkyModel>;
