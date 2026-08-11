// Types for the Launch Library 2 (thespacedevs.com) v2.2.0 API.
//
// Hand-written rather than generated, because the point is to model what the
// API *actually* returns, not the happy path:
//
//   - The two response modes disagree on field names. `mode=detailed` returns
//     `vidURLs`/`infoURLs`; the default and `mode=list` return `vid_urls`.
//     Both shapes are modelled here and normalized once, in utils/launchFields.
//   - Almost everything is nullable. A launch with no confirmed orbit, no
//     mission description, no weather probability, or no pad coordinates is
//     routine, not an error. Optional/`| null` throughout is deliberate.
//   - Numeric-looking fields are strings. `pad.latitude` and `pad.longitude`
//     arrive as strings ("28.56194122") and must be parsed before use.
//
// Only the fields the app reads are declared. Adding one means checking a live
// response first — see the "Verified API facts" notes in the plan.

/** Latitude/longitude arrive as strings from LL2, not numbers. */
export type NumericString = string;

export interface LaunchStatus {
  id: number;
  /** 'Go' | 'TBC' | 'TBD' | 'Success' | 'Failure' | 'Hold' | ... — see data/launchStatus */
  abbrev: string;
  name: string;
  description?: string;
}

/**
 * How precise the T-0 actually is. Displaying a to-the-second countdown for a
 * launch only known to the month is the kind of false confidence this field
 * exists to prevent.
 */
export interface NetPrecision {
  id: number;
  /** 'SEC' | 'MIN' | 'HOUR' | 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' | ... */
  abbrev: string;
  name: string;
  description?: string;
}

export interface Agency {
  id: number;
  name: string;
  type?: string | null;
  abbrev?: string | null;
  logo_url?: string | null;
  country_code?: string | null;
}

export interface RocketConfiguration {
  id: number;
  name: string;
  full_name?: string;
  family?: string;
  variant?: string;
  /** Present in detailed mode; the basis for future /rockets/<slug> routes. */
  url?: string;
}

export interface Rocket {
  id: number;
  configuration?: RocketConfiguration | null;
}

export interface Orbit {
  id: number;
  name: string;
  abbrev?: string;
}

export interface Mission {
  id: number;
  name: string;
  description?: string | null;
  type?: string | null;
  orbit?: Orbit | null;
}

export interface PadLocation {
  id: number;
  name: string;
  country_code?: string | null;
  map_image?: string | null;
  total_launch_count?: number;
}

export interface Pad {
  id: number;
  name: string;
  /** Strings, not numbers. Parse before doing geometry. */
  latitude?: NumericString | null;
  longitude?: NumericString | null;
  map_url?: string | null;
  wiki_url?: string | null;
  info_url?: string | null;
  location?: PadLocation | null;
  total_launch_count?: number;
}

export interface VideoUrlType {
  id: number;
  /** 'Official Webcast' | 'Livestream' | 'Press Conference' | ... */
  name: string;
}

/**
 * A webcast link. Note that `url` is frequently NOT YouTube — x.com broadcasts
 * are common — so callers must check embeddability rather than assume, since
 * the CSP only permits YouTube and Vimeo frames.
 */
export interface VideoUrl {
  /** Lower numbers rank higher; sort ascending to find the primary feed. */
  priority: number;
  url: string;
  title?: string | null;
  description?: string | null;
  publisher?: string | null;
  source?: string | null;
  feature_image?: string | null;
  type?: VideoUrlType | null;
  language?: { id: number; name: string; code: string } | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface InfoUrl {
  priority: number;
  url: string;
  title?: string | null;
  description?: string | null;
}

/** A curator-written note on the mission — the real "status changes" feed. */
export interface LaunchUpdate {
  id: number;
  comment: string;
  info_url?: string | null;
  created_by: string;
  created_on: string;
  profile_image?: string | null;
}

export interface MissionPatch {
  id: number;
  name: string;
  image_url: string;
}

export interface Program {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  info_url?: string | null;
  wiki_url?: string | null;
}

/** Fields present in every response mode. */
export interface LaunchBase {
  id: string;
  /** Stable, upstream-maintained, and unique — the basis for our permalinks. */
  slug: string;
  name: string;
  status: LaunchStatus;
  /** Target liftoff. Prefer this over window_start; see launchFields.launchTime. */
  net: string;
  net_precision?: NetPrecision | null;
  window_start?: string | null;
  window_end?: string | null;
  image?: string | null;
  last_updated?: string;
  url?: string;
}

/**
 * A launch from `mode=detailed` (the single-launch endpoint).
 * Everything the detail page needs lives here and nowhere else.
 */
export interface LaunchDetailed extends LaunchBase {
  launch_service_provider?: Agency | null;
  rocket?: Rocket | null;
  mission?: Mission | null;
  pad?: Pad | null;

  /** Detailed mode spells these with capitals. The list mode does not. */
  vidURLs?: VideoUrl[] | null;
  infoURLs?: InfoUrl[] | null;

  updates?: LaunchUpdate[] | null;
  program?: Program[] | null;
  mission_patches?: MissionPatch[] | null;

  webcast_live?: boolean;
  /** Percentage chance of favorable weather, or null/-1 when not assessed. */
  probability?: number | null;
  weather_concerns?: string | null;
  holdreason?: string | null;
  failreason?: string | null;

  pad_turnaround?: string | null;
  agency_launch_attempt_count?: number | null;
  location_launch_attempt_count?: number | null;
  pad_launch_attempt_count?: number | null;
  orbital_launch_attempt_count?: number | null;
}

/**
 * A launch from the upcoming feed (default mode). Same identity fields, but a
 * shallower payload — and `vid_urls`, not `vidURLs`.
 */
export interface LaunchListItem extends LaunchBase {
  launch_service_provider?: Agency | null;
  rocket?: Rocket | null;
  mission?: Mission | null;
  pad?: Pad | null;
  vid_urls?: VideoUrl[] | null;
}

/**
 * Either shape. Components that render both feed entries and detailed payloads
 * should accept this and go through utils/launchFields for anything the two
 * modes disagree about.
 */
export type AnyLaunch = LaunchDetailed | LaunchListItem;

/** LL2 paginates everything, including single-result slug lookups. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type UpcomingLaunchesResponse = Paginated<LaunchListItem>;
