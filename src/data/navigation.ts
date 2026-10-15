// Site sections, shared by the top nav, the mobile drawer, and the footer so
// the three can't drift apart.

export interface NavItem {
  path: string;
  label: string;
  /** One line describing the section, for the Discover menu and Home. */
  blurb?: string;
  /** Listed in Home's "More to explore" index. */
  onHome?: boolean;
}

/**
 * Primary tabs. Launches lead: the site is a launch tracker first. Home is
 * the logo. /solarsim is intentionally absent (a Konami-code easter egg).
 */
export const PRIMARY_NAV: NavItem[] = [
  { path: '/launches', label: 'Launches' },
  { path: '/map', label: 'Launch Map' },
  { path: '/iss', label: 'ISS Live', blurb: 'Real-time station tracking and onboard video', onHome: true },
];

/** Secondary sections, grouped under "Discover" in the top nav. */
export const DISCOVER_NAV: NavItem[] = [
  { path: '/mars', label: 'Mars Rovers', blurb: "Imagery from the red planet's rovers", onHome: true },
  { path: '/explore', label: 'Explore', blurb: "NASA's image library and space history", onHome: true },
];

/**
 * Exact match everywhere except for sections with child routes: a launch
 * detail page at /launches/<slug> should still light up the Launches tab.
 * '/' is exact-only or it would match every route.
 */
export const isActiveNav = (pathname: string, path: string) =>
  pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
