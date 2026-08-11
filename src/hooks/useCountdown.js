import { useEffect, useState } from 'react';

/**
 * @typedef {{ d: number, h: number, m: number, s: number }} TimeLeft
 */

/**
 * Ticking countdown to a timestamp. Returns { d, h, m, s } updated every
 * second, or null when the target is missing or already passed.
 *
 * @param {string | Date | null | undefined} targetTime
 * @returns {TimeLeft | null}
 */
export function useCountdown(targetTime) {
  // Annotated so TypeScript callers see the union rather than inferring `null`
  // from the initial value alone.
  /** @type {[TimeLeft | null, (value: TimeLeft | null) => void]} */
  const [timeLeft, setTimeLeft] = useState(null);

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
