// Plain-language wording for the sky view. Kept apart from the maths so the
// copy can be tuned without touching geometry, and so the same phrasing is
// used by the answer card, the list and the screen-reader labels.

import type { Observer } from '../../hooks/useObserver';
import { compass, type Visibility } from '../../utils/sky';

const DIRECTION_NAMES: Record<string, string> = {
  N: 'north',
  NNE: 'north-northeast',
  NE: 'northeast',
  ENE: 'east-northeast',
  E: 'east',
  ESE: 'east-southeast',
  SE: 'southeast',
  SSE: 'south-southeast',
  S: 'south',
  SSW: 'south-southwest',
  SW: 'southwest',
  WSW: 'west-southwest',
  W: 'west',
  WNW: 'west-northwest',
  NW: 'northwest',
  NNW: 'north-northwest',
};

/** "south-southeast" for a bearing of 147 degrees. */
export const directionName = (azimuth: number) => DIRECTION_NAMES[compass(azimuth)];

/**
 * How high above the horizon, in a unit everyone carries. A fist held at arm's
 * length spans about 10 degrees, which is the standard sky-watcher's rule.
 */
export function fistsAbove(elevation: number): string {
  const fists = elevation / 10;
  if (fists < 0.75) return 'about half a fist';
  if (fists < 1.25) return 'about one fist';
  return `about ${Math.round(fists)} fists`;
}

/** The same, shortened for a list row: "half a fist up". */
export const fistsUp = (elevation: number) => `${fistsAbove(elevation).replace('about ', '')} up`;

export interface VerdictCopy {
  /** The chip. */
  chip: string;
  /** The line above the launch name. */
  question: string;
  /** One sentence of why. */
  why: string;
}

export const VERDICT: Record<Visibility, VerdictCopy> = {
  plume: {
    chip: 'Great view',
    question: 'You can see this launch',
    why: 'It lifts off around sunrise or sunset. The ground is dark but the rocket climbs into sunlight, so its exhaust can glow across the sky.',
  },
  night: {
    chip: 'Good view',
    question: 'You can see this launch',
    why: 'It is dark where you are, so you will see the rocket as a bright moving light.',
  },
  day: {
    chip: 'Faint view',
    question: 'You might spot this launch',
    why: 'The sky will be bright. You may catch a thin trail, but the rocket itself is hard to spot in daylight.',
  },
  below: {
    chip: 'Too far',
    question: 'Too far to see from here',
    why: 'It is too far away: the curve of the Earth hides it from where you are.',
  },
};

/** Where the visitor is watching from, as it reads in a sentence. */
export function placeName(observer: Observer): string {
  if (observer.source === 'geolocation') return 'your location';
  if (observer.source === 'timezone') return 'your area';
  // "Lompoc, CA (Vandenberg)" reads better as "Lompoc, CA"
  return observer.label.replace(/\s*\(.*\)\s*$/, '');
}

/** "3 h 12 min", "45 min", "2 days". */
export function relativeTime(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * Upstream names launches "Rocket | Mission". The rocket is already shown next
 * to it, so headlines lead with the mission: "Starlink Group 10-31".
 */
export function missionName(name: string): string {
  const parts = name.split(' | ');
  return parts.length > 1 ? parts.slice(1).join(' | ') : name;
}
