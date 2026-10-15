import { useEffect, useState } from 'react';
import { hasPreciseTime, launchTime } from '../utils/launchFields';
import type { AnyLaunch } from '../types/launchLibrary';

export interface TimeLeft {
  d: number;
  h: number;
  m: number;
  s: number;
}

/**
 * Ticking countdown to a timestamp. Returns { d, h, m, s } updated every
 * second, or null when the target is missing or already passed.
 */
export function useCountdown(targetTime: string | Date | null | undefined): TimeLeft | null {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft(null);
      return;
    }

    const tick = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return timeLeft;
}

/**
 * Countdown to a launch's T-0, or null when the T-0 is too vague to count
 * down to (a launch pinned only to a day, month, or quarter). Use this rather
 * than useCountdown(launchTime(launch)) so no readout ticks to the second on
 * a date the data only knows to the month.
 */
export function useLaunchCountdown(launch: AnyLaunch | null | undefined): TimeLeft | null {
  return useCountdown(hasPreciseTime(launch) ? launchTime(launch) : null);
}
