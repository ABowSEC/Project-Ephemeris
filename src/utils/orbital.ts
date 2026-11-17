// Loads the optional Rust/WebAssembly orbital module (crates/orbital) by URL.
// It may not exist in dev builds without Rust, so "unavailable" just returns
// null and the UI shows nothing.

const MODULE_URL = '/wasm/orbital/orbital.js';

export interface Lighting {
  /** Sun altitude in degrees; negative is below the horizon. */
  altitude: number;
  /** Sun bearing in degrees clockwise from true north. */
  azimuth: number;
  phase: 'day' | 'civil-twilight' | 'nautical-twilight' | 'astronomical-twilight' | 'night';
  /** Ground dark, rocket sunlit: the conditions for a visible plume. */
  twilightLaunch: boolean;
}

interface OrbitalModule {
  default: (input?: unknown) => Promise<unknown>;
  lightingAt: (latitude: number, longitude: number, unixMs: number) => Lighting;
  solarAltitude: (latitude: number, longitude: number, unixMs: number) => number;
}

// One load attempt per page, shared by every caller, cached including failure.
let modulePromise: Promise<OrbitalModule | null> | null = null;

async function loadModule(): Promise<OrbitalModule | null> {
  try {
    const module = (await import(/* @vite-ignore */ MODULE_URL)) as OrbitalModule;
    // wasm-pack's web target needs its init call before any export is usable
    await module.default();
    return module;
  } catch {
    // Not built, blocked by CSP, or WebAssembly unsupported. All the same here.
    return null;
  }
}

export function loadOrbital(): Promise<OrbitalModule | null> {
  modulePromise ??= loadModule();
  return modulePromise;
}

/** Lighting at the pad for a launch time, or null if the module isn't available. */
export async function getLighting(
  latitude: number,
  longitude: number,
  unixMs: number
): Promise<Lighting | null> {
  const module = await loadOrbital();
  if (!module) return null;
  try {
    const result = module.lightingAt(latitude, longitude, unixMs);
    // The wasm-bindgen object exposes getters, not plain properties; copying
    // to a POJO here keeps React state serializable and comparable.
    return {
      altitude: result.altitude,
      azimuth: result.azimuth,
      phase: result.phase,
      twilightLaunch: result.twilightLaunch,
    };
  } catch {
    return null;
  }
}
