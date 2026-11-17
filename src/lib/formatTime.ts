const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// CGrateS uses 0001-01-01T00:00:00Z for "never set".
function toDate(d: string | number | Date | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) || date.getFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  return date ? fmt.format(date) : '—';
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
];
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

export function formatRelative(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return 'Never';
  const secs = (date.getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return 'just now';
}
