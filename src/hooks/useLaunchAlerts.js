import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { getUpcomingLaunches } from '../services/launchStore';
import { readFavorites } from './useFavorites';
import { launchPath, launchTime as launchTimeOf } from '../utils/launchFields';

// Countdown alerts for tracked launches. While the app (or installed PWA)
// is open, a periodic check compares each tracked launch's time against
// alert thresholds and fires a system notification plus an in-app toast.
// Fired alerts are recorded in localStorage so refreshes don't repeat them.

const PREF_KEY = 'ephemeris.alertsEnabled.v1';
const FIRED_KEY = 'ephemeris.alertsFired.v1';
const PREF_EVENT = 'ephemeris:alerts-changed';
const CHECK_MS = 30 * 1000;

// Ordered widest first; a launch starred inside a window only announces the
// tightest threshold it has already passed, and earlier ones are marked
// fired silently so they never stack.
const THRESHOLDS = [
  { id: 'T-60m', ms: 60 * 60 * 1000, body: 'Launches in about 1 hour' },
  { id: 'T-10m', ms: 10 * 60 * 1000, body: 'Launches in about 10 minutes' },
  { id: 'T-0', ms: 0, body: 'Liftoff! The launch window is open' },
];

function readEnabled() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY)) === true;
  } catch {
    return false;
  }
}

function writeEnabled(value) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(value === true));
  } catch {
    // Best-effort persistence
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

/** Shared on/off preference for launch alerts, synced across components. */
export function useAlertsEnabled() {
  const [enabled, setEnabled] = useState(readEnabled);

  useEffect(() => {
    const sync = () => setEnabled(readEnabled());
    window.addEventListener(PREF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PREF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((value) => writeEnabled(value), []);
  return { enabled, setEnabled: update };
}

function readFired() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FIRED_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFired(fired) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    // Best-effort persistence
  }
}

async function showSystemNotification(title, body, url) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: title,
    // Read by the notificationclick handler in public/sw-notifications.js so
    // tapping the alert opens the launch it is about, instead of the homepage.
    data: { url },
  };
  try {
    // Android Chrome only allows notifications through the service worker
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to the constructor form
  }
  try {
    // No service worker in this path, so the click never reaches
    // sw-notifications.js and has to be wired up here instead.
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      window.location.assign(url);
      notification.close();
    };
  } catch {
    // Notifications unavailable; the in-app toast already covered it
  }
}

/**
 * Mount once (in App). Watches tracked launches and fires alerts at
 * T-60min, T-10min, and liftoff while alerts are enabled.
 */
export function useLaunchAlerts() {
  const toast = useToast();
  const { enabled } = useAlertsEnabled();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const check = async () => {
      const favorites = readFavorites();
      if (favorites.length === 0) return;

      let data;
      try {
        data = await getUpcomingLaunches();
      } catch {
        return; // No data at all yet; try again next tick
      }
      if (cancelled) return;

      const launches = (data?.results ?? []).filter((l) => favorites.includes(l.id));
      const fired = readFired();
      const now = Date.now();

      for (const launch of launches) {
        const launchTime = new Date(launchTimeOf(launch)).getTime();
        if (!Number.isFinite(launchTime)) continue;
        const diff = launchTime - now;
        // Ignore far-future launches and ones that lifted off over 5 min ago
        if (diff > THRESHOLDS[0].ms || diff < -5 * 60 * 1000) continue;

        const passed = THRESHOLDS.filter((t) => diff <= t.ms);
        if (passed.length === 0) continue;

        const already = fired[launch.id] ?? [];
        const unfired = passed.filter((t) => !already.includes(t.id));
        if (unfired.length === 0) continue;

        // Announce only the tightest passed threshold; mark all as fired
        const announce = unfired[unfired.length - 1];
        fired[launch.id] = [...already, ...unfired.map((t) => t.id)];

        const place = launch.pad?.location?.name;
        const body = place ? `${announce.body} from ${place}` : announce.body;
        showSystemNotification(`🚀 ${launch.name}`, body, launchPath(launch));
        toast({
          title: launch.name,
          description: body,
          status: announce.id === 'T-0' ? 'success' : 'info',
          duration: 10000,
          isClosable: true,
          position: 'bottom-right',
        });
      }

      // Prune entries for launches no longer tracked or no longer upcoming
      const keep = new Set(launches.map((l) => l.id));
      for (const id of Object.keys(fired)) {
        if (!keep.has(id)) delete fired[id];
      }
      writeFired(fired);
    };

    check();
    const id = setInterval(check, CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, toast]);
}
