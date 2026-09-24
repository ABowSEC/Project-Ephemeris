import { useCallback, useState } from 'react';
import { DEFAULT_COORDS, coordsForTimeZone } from '../data/timezoneCoords';
import { VIEWING_SPOTS } from '../data/viewingSpots';

export type ObserverSource = 'geolocation' | 'preset' | 'timezone';

export interface Observer {
  lat: number;
  lon: number;
  label: string;
  source: ObserverSource;
}

const STORAGE_KEY = 'ephemeris.observer.v1';

/** "28.6°N 80.8°W" */
export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

function timezoneObserver(): Observer {
  let zone: string | null = null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl unavailable: fall through to the default
  }
  const guess = coordsForTimeZone(zone);
  const [lat, lon] = guess ?? DEFAULT_COORDS;
  return {
    lat,
    lon,
    label: guess ? 'Near you (from time zone)' : 'Space Coast (default)',
    source: 'timezone',
  };
}

function readStored(): Observer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Observer>;
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lon !== 'number' ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lon) ||
      Math.abs(parsed.lat) > 90 ||
      Math.abs(parsed.lon) > 180 ||
      (parsed.source !== 'geolocation' && parsed.source !== 'preset')
    ) {
      return null;
    }
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      label: typeof parsed.label === 'string' ? parsed.label : formatCoords(parsed.lat, parsed.lon),
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

function store(observer: Observer | null) {
  try {
    if (observer) localStorage.setItem(STORAGE_KEY, JSON.stringify(observer));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort: the choice just will not survive a reload
  }
}

/**
 * Where the sky view is looking from.
 *
 * Order of preference: a place the visitor chose (device location or a
 * preset), then a guess from their time zone. Position stays in this browser:
 * geolocation is rounded to 0.1 degree (~11 km) before it is even kept, and
 * nothing here makes a network request.
 */
export function useObserver() {
  const [observer, setObserver] = useState<Observer>(() => readStored() ?? timezoneObserver());
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const choose = useCallback((next: Observer) => {
    setObserver(next);
    store(next.source === 'timezone' ? null : next);
  }, []);

  const choosePreset = useCallback(
    (id: string) => {
      const spot = VIEWING_SPOTS.find((s) => s.id === id);
      if (spot) {
        setLocationError(null);
        choose({ lat: spot.lat, lon: spot.lon, label: spot.label, source: 'preset' });
      }
    },
    [choose]
  );

  const resetToGuess = useCallback(() => {
    setLocationError(null);
    choose(timezoneObserver());
  }, [choose]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('This browser cannot share a location.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = Math.round(coords.latitude * 10) / 10;
        const lon = Math.round(coords.longitude * 10) / 10;
        choose({ lat, lon, label: 'Your location', source: 'geolocation' });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was declined. Pick a place instead.'
            : 'Could not get a location. Pick a place instead.'
        );
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 }
    );
  }, [choose]);

  return { observer, locating, locationError, locate, choosePreset, resetToGuess };
}
