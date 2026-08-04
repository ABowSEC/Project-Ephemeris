// One launch-status vocabulary for the whole app.
//
// This previously existed three times, in three shapes, keyed three different
// ways: LaunchFeed's statusMap (keyed by a mix of abbrevs and invented codes),
// LaunchPage's STATUS_COLORS (keyed by status.name), and LaunchMapPage's
// STATUS_DOT (keyed by status.abbrev). They disagreed — a launch on hold was
// yellow in one view and grey in another — which is exactly the sort of thing
// that makes a tracker feel unreliable.
//
// Keyed by `status.abbrev`, which is the stable identifier upstream; `name` is
// prose and has changed wording before.

import type { LaunchStatus } from '../types/launchLibrary';

export interface StatusStyle {
  /** Short label for badges. */
  label: string;
  /** Chakra colorScheme, for Badge/Button. */
  colorScheme: string;
  /** Explicit hex for the map's SVG dots, which can't use a colorScheme. */
  dot: string;
  /** True once the launch has flown and its record is final. */
  terminal: boolean;
}

const STATUSES: Record<string, StatusStyle> = {
  Go: { label: 'Go for Launch', colorScheme: 'green', dot: '#38A169', terminal: false },
  TBC: { label: 'To Be Confirmed', colorScheme: 'yellow', dot: '#D69E2E', terminal: false },
  TBD: { label: 'To Be Determined', colorScheme: 'gray', dot: '#718096', terminal: false },
  Hold: { label: 'On Hold', colorScheme: 'orange', dot: '#DD6B20', terminal: false },
  'In Flight': { label: 'In Flight', colorScheme: 'blue', dot: '#3182CE', terminal: false },
  Success: { label: 'Success', colorScheme: 'green', dot: '#38A169', terminal: true },
  Failure: { label: 'Failure', colorScheme: 'red', dot: '#E53E3E', terminal: true },
  'Partial Failure': {
    label: 'Partial Failure',
    colorScheme: 'orange',
    dot: '#DD6B20',
    terminal: true,
  },
};

const UNKNOWN: StatusStyle = {
  label: 'Unknown',
  colorScheme: 'gray',
  dot: '#718096',
  terminal: false,
};

/**
 * Style for a launch status. Unknown abbrevs fall back to the status's own
 * name rather than the literal word "Unknown" — upstream occasionally adds a
 * status, and showing what it says beats showing nothing.
 */
export function statusStyle(status: LaunchStatus | null | undefined): StatusStyle {
  if (!status) return UNKNOWN;
  const known = STATUSES[status.abbrev];
  if (known) return known;
  return { ...UNKNOWN, label: status.name || UNKNOWN.label };
}

/** True once the launch has flown, whatever the outcome. */
export function hasFlown(status: LaunchStatus | null | undefined): boolean {
  return statusStyle(status).terminal;
}

/** Abbrev/label pairs for the filter dropdown, in schedule order. */
export const FILTERABLE_STATUSES = (['Go', 'TBC', 'TBD', 'Hold', 'Success', 'Failure'] as const).map(
  (abbrev) => ({ abbrev, label: STATUSES[abbrev].label })
);
