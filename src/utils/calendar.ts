// Calendar export helpers: build a Google Calendar prefill URL or download
// an .ics file so a launch shows up in the user's own calendar app.

import { hasPreciseTime, launchDate, launchTime, officialWebcast } from './launchFields';
import type { AnyLaunch } from '../types/launchLibrary';

// 2026-07-15T12:34:56Z -> 20260715T123456Z (UTC basic format both formats use)
function toCalendarUtc(dateString: string): string {
  const d = new Date(dateString);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Local calendar date as YYYYMMDD, the all-day form both formats use
function toCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** start/end are already in calendar form: UTC basic, or YYYYMMDD when allDay. */
interface CalendarTiming {
  allDay: boolean;
  start: string;
  end: string;
}

/**
 * When the event goes in the calendar, or null when it can't honestly go in
 * at all. A firm T-0 gets a timed event; a launch known only to the day gets
 * an all-day event; anything vaguer (month, quarter, year) or with no date
 * gets nothing, rather than an event at a time the data doesn't support.
 */
function launchTiming(launch: AnyLaunch): CalendarTiming | null {
  const date = launchDate(launch);
  if (!date) return null;

  if (hasPreciseTime(launch)) {
    // launchTime prefers net, the target T-0, so the event lines up with the
    // countdown and alerts rather than the opening of a multi-hour window
    const start = launchTime(launch) as string;
    // Fall back to a one-hour block when the API gives no window end
    const end =
      launch.window_end && Date.parse(launch.window_end) > Date.parse(start)
        ? launch.window_end
        : new Date(date.getTime() + 60 * 60 * 1000).toISOString();
    return { allDay: false, start: toCalendarUtc(start), end: toCalendarUtc(end) };
  }

  if (launch.net_precision?.abbrev === 'DAY') {
    // All-day end dates are exclusive in both Google and iCalendar
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { allDay: true, start: toCalendarDate(date), end: toCalendarDate(next) };
  }

  return null;
}

/** Whether a launch's date is firm enough to add to a calendar. */
export function canAddToCalendar(launch: AnyLaunch): boolean {
  return launchTiming(launch) !== null;
}

function launchDetails(launch: AnyLaunch): string {
  const lines = [
    launch.launch_service_provider?.name,
    launch.rocket?.configuration?.name && `Rocket: ${launch.rocket.configuration.name}`,
    launch.mission?.description,
    officialWebcast(launch)?.url && `Watch: ${officialWebcast(launch)?.url}`,
    'Tracked via Ephemeris',
  ];
  return lines.filter(Boolean).join('\n');
}

function launchLocation(launch: AnyLaunch): string {
  return [launch.pad?.name, launch.pad?.location?.name].filter(Boolean).join(', ');
}

/**
 * Prefilled Google Calendar "create event" URL for a launch, or null when
 * the date is too vague (see canAddToCalendar).
 */
export function googleCalendarUrl(launch: AnyLaunch): string | null {
  const timing = launchTiming(launch);
  if (!timing) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Launch: ${launch.name}`,
    dates: `${timing.start}/${timing.end}`,
    details: launchDetails(launch),
    location: launchLocation(launch),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 requires escaping backslash, semicolon, comma, and newlines
function escapeIcsText(text: string): string {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Build the .ics file body for a launch, or null when the date is too vague. */
export function buildIcs(launch: AnyLaunch): string | null {
  const timing = launchTiming(launch);
  if (!timing) return null;
  const when = timing.allDay
    ? [`DTSTART;VALUE=DATE:${timing.start}`, `DTEND;VALUE=DATE:${timing.end}`]
    : [`DTSTART:${timing.start}`, `DTEND:${timing.end}`];
  // A 30-minute warning only means something for a timed event; on an
  // all-day one it would fire at 23:30 the night before
  const alarm = timing.allDay
    ? []
    : ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Launch in 30 minutes', 'TRIGGER:-PT30M', 'END:VALARM'];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ephemeris//Launch Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${launch.id}@ephemeris`,
    `DTSTAMP:${toCalendarUtc(new Date().toISOString())}`,
    ...when,
    `SUMMARY:${escapeIcsText(`Launch: ${launch.name}`)}`,
    `DESCRIPTION:${escapeIcsText(launchDetails(launch))}`,
    `LOCATION:${escapeIcsText(launchLocation(launch))}`,
    ...alarm,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Trigger a browser download of the launch as an .ics calendar file. */
export function downloadIcs(launch: AnyLaunch): void {
  const ics = buildIcs(launch);
  if (!ics) return;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${launch.name.replace(/[^\w-]+/g, '_').slice(0, 60)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
