// Launch status labels and colors for the whole app. Keyed by
// `status.abbrev`, which is stable; `name` wording has changed before.
//
// Badges are neutral by default. Only states that mean something get a
// signal color (see DESIGN.md): live = In Flight, caution = Hold and Partial
// Failure, danger = Failure.

import type { LaunchStatus } from '../types/launchLibrary';

export type StatusTone = 'neutral' | 'muted' | 'live' | 'caution' | 'danger';

export interface StatusStyle {
  /** Full name, for filters and tooltips. */
  label: string;
  /** Short badge text. */
  short: string;
  tone: StatusTone;
  /** Explicit hex for the map's SVG dots, which can't use theme tokens. */
  dot: string;
  /** True once the launch has flown and its record is final. */
  terminal: boolean;
}

/** Theme tokens per tone, for the badge's text and border. */
export const TONE_COLORS: Record<StatusTone, { color: string; borderColor: string }> = {
  neutral: { color: 'text.primary', borderColor: 'border.control' },
  muted: { color: 'text.secondary', borderColor: 'border.default' },
  live: { color: 'accent.terminal', borderColor: 'accent.terminal' },
  caution: { color: 'accent.stale', borderColor: 'accent.stale' },
  danger: { color: 'accent.danger', borderColor: 'accent.danger' },
};

const DOTS: Record<StatusTone, string> = {
  neutral: '#F0F0FA',
  muted: '#6E747D',
  live: '#00FF9D',
  caution: '#ED8936',
  danger: '#FF3B30',
};

const status = (label: string, short: string, tone: StatusTone, terminal = false): StatusStyle => ({
  label,
  short,
  tone,
  dot: DOTS[tone],
  terminal,
});

const STATUSES: Record<string, StatusStyle> = {
  Go: status('Go for Launch', 'Go', 'neutral'),
  TBC: status('To Be Confirmed', 'TBC', 'muted'),
  TBD: status('To Be Determined', 'TBD', 'muted'),
  Hold: status('On Hold', 'Hold', 'caution'),
  'In Flight': status('In Flight', 'Live', 'live'),
  Success: status('Success', 'Success', 'neutral', true),
  Failure: status('Failure', 'Failed', 'danger', true),
  'Partial Failure': status('Partial Failure', 'Partial failure', 'caution', true),
};

const UNKNOWN = status('Unknown', 'Unknown', 'muted');

/** Style for a launch status. Unknown statuses show their own name. */
export function statusStyle(launchStatus: LaunchStatus | null | undefined): StatusStyle {
  if (!launchStatus) return UNKNOWN;
  const known = STATUSES[launchStatus.abbrev];
  if (known) return known;
  const name = launchStatus.name || UNKNOWN.label;
  return { ...UNKNOWN, label: name, short: name };
}

/** True once the launch has flown, whatever the outcome. */
export function hasFlown(launchStatus: LaunchStatus | null | undefined): boolean {
  return statusStyle(launchStatus).terminal;
}

/** Abbrev/label pairs for the filter dropdown, in schedule order. */
export const FILTERABLE_STATUSES = (['Go', 'TBC', 'TBD', 'Hold', 'Success', 'Failure'] as const).map(
  (abbrev) => ({ abbrev, label: STATUSES[abbrev].label })
);
