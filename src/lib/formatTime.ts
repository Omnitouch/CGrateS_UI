const DATE_TIME = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  // CGrateS uses Go's zero time (0001-01-01T00:00:00Z) for "unset".
  return isNaN(date.getTime()) || date.getUTCFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: Date | string | number | null | undefined): string {
  const date = toDate(d);
  return date ? DATE_TIME.format(date) : '—';
}

export function formatRelative(d: Date | string | number | null | undefined): string {
  const date = toDate(d);
  if (!date) return 'Never';
  const secs = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(secs);
  if (abs < 60) return RELATIVE.format(secs, 'second');
  if (abs < 3600) return RELATIVE.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return RELATIVE.format(Math.round(secs / 3600), 'hour');
  return RELATIVE.format(Math.round(secs / 86400), 'day');
}
