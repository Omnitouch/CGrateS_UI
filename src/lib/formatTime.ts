const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  // CGrateS sends 0001-01-01T00:00:00Z for unset times.
  return isNaN(date.getTime()) || date.getUTCFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: Date | string | number | null | undefined, empty = '—'): string {
  const date = toDate(d);
  return date ? dateTimeFormat.format(date) : empty;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
];

export function formatRelative(d: Date | string | number | null | undefined, empty = 'Never'): string {
  const date = toDate(d);
  if (!date) return empty;
  const secs = (date.getTime() - Date.now()) / 1000;
  const [unit, size] = UNITS.find(([, s]) => Math.abs(secs) >= s) ?? UNITS[UNITS.length - 1];
  return relativeFormat.format(Math.round(secs / size), unit);
}
