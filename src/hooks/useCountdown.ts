import { useEffect, useState } from 'react';
import { hasPreciseTime, launchTime } from '../utils/launchFields';
import type { AnyLaunch } from '../types/launchLibrary';

export interface TimeLeft {
  d: number;
  h: number;
  m: number;
  s: number;
}

/** Countdown to a time as { d, h, m, s }, or null if missing or passed. */
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

/** Countdown to a launch's T-0, or null if the T-0 isn't precise enough to count down. */
export function useLaunchCountdown(launch: AnyLaunch | null | undefined): TimeLeft | null {
  return useCountdown(hasPreciseTime(launch) ? launchTime(launch) : null);
}
