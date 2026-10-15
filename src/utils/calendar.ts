// Calendar export helpers: build a Google Calendar prefill URL or download
// an .ics file so a launch shows up in the user's own calendar app.

import { launchTime, officialWebcast } from './launchFields';
import type { AnyLaunch } from '../types/launchLibrary';

// 2026-07-15T12:34:56Z -> 20260715T123456Z (UTC basic format both formats use)
function toCalendarUtc(dateString: string): string {
  const d = new Date(dateString);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function launchTimes(launch: AnyLaunch): { start: string; end: string } {
  // launchTime prefers net, the target T-0, so the event lines up with the
  // countdown and alerts rather than the opening of a multi-hour window
  const start = launchTime(launch) ?? new Date().toISOString();
  // Fall back to a one-hour block when the API gives no window end
  const end =
    launch.window_end && Date.parse(launch.window_end) > Date.parse(start)
      ? launch.window_end
      : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  return { start, end };
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

/** Prefilled Google Calendar "create event" URL for a launch. */
export function googleCalendarUrl(launch: AnyLaunch): string {
  const { start, end } = launchTimes(launch);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Launch: ${launch.name}`,
    dates: `${toCalendarUtc(start)}/${toCalendarUtc(end)}`,
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

/** Build the .ics file body for a launch. */
export function buildIcs(launch: AnyLaunch): string {
  const { start, end } = launchTimes(launch);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ephemeris//Launch Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${launch.id}@ephemeris`,
    `DTSTAMP:${toCalendarUtc(new Date().toISOString())}`,
    `DTSTART:${toCalendarUtc(start)}`,
    `DTEND:${toCalendarUtc(end)}`,
    `SUMMARY:${escapeIcsText(`Launch: ${launch.name}`)}`,
    `DESCRIPTION:${escapeIcsText(launchDetails(launch))}`,
    `LOCATION:${escapeIcsText(launchLocation(launch))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Launch in 30 minutes',
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Trigger a browser download of the launch as an .ics calendar file. */
export function downloadIcs(launch: AnyLaunch): void {
  const blob = new Blob([buildIcs(launch)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${launch.name.replace(/[^\w-]+/g, '_').slice(0, 60)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
