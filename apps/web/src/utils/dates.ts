import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { formatDuration } from 'date-fns/formatDuration';
import { intervalToDuration } from 'date-fns/intervalToDuration';

/**
 * `HH:MM` with unbounded hours. Computed from raw seconds rather than via
 * `intervalToDuration`, which rolls 24h into `days` (and days into months/years), so a
 * 25h35m book used to render as `01:35`.
 */
export function shortDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export function formatSecondsToHumanReadable(seconds: number, hideSeconds = true): string {
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });

  if (!hideSeconds) {
    return formatDuration(duration);
  }

  if (!duration.minutes && !duration.hours && !duration.seconds) {
    return 'N/A';
  }

  if (!duration.minutes && !duration.hours && duration.seconds && duration.seconds > 0) {
    return 'Less than a minute';
  }

  return formatDuration(duration, { format: ['months', 'days', 'hours', 'minutes'] });
}

export function formatRelativeDate(date: number): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
