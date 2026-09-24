// Sky colour and the decorative star field, shared by the dome and the
// horizon strip so the two always agree about what the sky looks like.

type Rgb = [number, number, number];
type Stops = Array<[altitude: number, color: Rgb]>;

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

// Sky colour by solar altitude. Zenith and horizon are separate ramps because
// twilight is exactly the moment they disagree: a deep-blue overhead over an
// orange horizon.
const ZENITH: Stops = [
  [-18, hex('#04060f')],
  [-12, hex('#0a1030')],
  [-6, hex('#16215a')],
  [0, hex('#1f3f7a')],
  [10, hex('#245a99')],
  [30, hex('#1f5c99')],
];
const HORIZON: Stops = [
  [-18, hex('#080c1f')],
  [-12, hex('#171a45')],
  [-6, hex('#4a2d6b')],
  [-2, hex('#b8626a')],
  [0, hex('#d98a5c')],
  [6, hex('#8fb8dc')],
  [30, hex('#6fa8dc')],
];

const rgb = ([r, g, b]: Rgb) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

function ramp(stops: Stops, altitude: number): string {
  if (altitude <= stops[0][0]) return rgb(stops[0][1]);
  const last = stops[stops.length - 1];
  if (altitude >= last[0]) return rgb(last[1]);
  for (let i = 1; i < stops.length; i++) {
    const [a1, c1] = stops[i];
    if (altitude <= a1) {
      const [a0, c0] = stops[i - 1];
      const f = (altitude - a0) / (a1 - a0);
      return rgb([c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f]);
    }
  }
  return rgb(last[1]);
}

/** Colour straight overhead for a solar altitude in degrees. */
export const zenithColor = (sunAltitude: number) => ramp(ZENITH, sunAltitude);

/** Colour at the horizon for a solar altitude in degrees. */
export const horizonColor = (sunAltitude: number) => ramp(HORIZON, sunAltitude);

export interface Star {
  /** Position on the unit disc, -1 to 1. */
  x: number;
  y: number;
  r: number;
  o: number;
}

// Decorative, not a catalogue: fixed in the frame, they do not wheel with the
// hour, so they only show once it is properly dark and stay faint enough not
// to be mistaken for one.
export const STAR_FIELD: Star[] = (() => {
  let seed = 20260924;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  return Array.from({ length: 140 }, () => {
    const angle = next() * Math.PI * 2;
    const radius = Math.sqrt(next());
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      r: 0.5 + next() * 1.1,
      o: 0.35 + next() * 0.65,
    };
  });
})();

/** Opacity of the stars for a solar altitude: none by day, full by deep twilight. */
export const starOpacity = (sunAltitude: number) =>
  sunAltitude < -4 ? Math.min(1, (-sunAltitude - 4) / 12) : 0;
