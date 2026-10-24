// Types for the Launch Library 2 (thespacedevs.com) v2.3.0 API.
//
// Hand-written rather than generated, because the point is to model what the
// API *actually* returns, not the happy path:
//
//   - v2.2.0 payloads are still in circulation: the edge keeps stale copies for
//     up to a month and browsers keep their own, and those were cached before
//     the v2.3.0 switch. Where the two versions disagree (images became
//     objects, coordinates became numbers, `vidURLs` became `vid_urls`, ...)
//     both shapes are modelled here and normalized once, in utils/launchFields.
//     Drop the v2.2.0 halves once those caches have aged out.
//   - Almost everything is nullable. A launch with no confirmed orbit, no
//     mission description, no weather probability, or no pad coordinates is
//     routine, not an error. Optional/`| null` throughout is deliberate.
//   - v2.2.0 sent `pad.latitude`/`pad.longitude` as strings ("28.56194122");
//     v2.3.0 sends numbers. Go through launchFields.padCoordinates.
//
// Only the fields the app reads are declared. Adding one means checking a live
// response first — see the "Verified API facts" notes in the plan.

/** Latitude/longitude: strings in v2.2.0, numbers in v2.3.0. */
export type Coordinate = string | number;

/** v2.3.0's image object. v2.2.0 sent the bare `image_url` string instead. */
export interface Ll2Image {
  id?: number;
  name?: string | null;
  image_url: string;
  thumbnail_url?: string | null;
  credit?: string | null;
}

export interface Country {
  id: number;
  name: string;
  alpha_2_code?: string | null;
  alpha_3_code?: string | null;
}

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
  /** A string in v2.2.0, `{ id, name }` in v2.3.0. */
  type?: string | { id: number; name: string } | null;
  abbrev?: string | null;
  logo_url?: string | null;
  country_code?: string | null;
}

export interface RocketConfiguration {
  id: number;
  name: string;
  full_name?: string;
  /** v2.2.0 only; v2.3.0 has `families`. Go through launchFields.rocketFamily. */
  family?: string;
  families?: { id: number; name: string }[] | null;
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
  /** v2.2.0 only; v2.3.0 moved it to `pad.country`. See launchFields.padCountryCode. */
  country_code?: string | null;
  map_image?: string | null;
  total_launch_count?: number;
}

export interface Pad {
  id: number;
  name: string;
  /** Go through launchFields.padCoordinates rather than reading these. */
  latitude?: Coordinate | null;
  longitude?: Coordinate | null;
  country?: Country | null;
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
  /** Go through launchFields.launchImageUrl rather than reading this. */
  image?: string | Ll2Image | null;
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

  /** v2.2.0 detailed mode spelled these with capitals; v2.3.0 does not. */
  vidURLs?: VideoUrl[] | null;
  infoURLs?: InfoUrl[] | null;
  vid_urls?: VideoUrl[] | null;
  info_urls?: InfoUrl[] | null;

  updates?: LaunchUpdate[] | null;
  program?: Program[] | null;
  mission_patches?: MissionPatch[] | null;

  webcast_live?: boolean;
  /** Percentage chance of favorable weather, or null/-1 when not assessed. */
  probability?: number | null;
  weather_concerns?: string | null;
  /** v2.2.0 only. v2.3.0 dropped it; it survives only in cached payloads. */
  holdreason?: string | null;
  failreason?: string | null;

  pad_turnaround?: string | null;
  agency_launch_attempt_count?: number | null;
  location_launch_attempt_count?: number | null;
  pad_launch_attempt_count?: number | null;
  orbital_launch_attempt_count?: number | null;
}

/** A launch from the upcoming feed (default mode). Same identity fields, but a shallower payload. */
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
