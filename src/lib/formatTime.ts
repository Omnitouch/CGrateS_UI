const DATE_TIME = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function toDate(d: string | number | Date | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  // CGrateS uses 0001-01-01T00:00:00Z for "unset".
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  return date ? DATE_TIME.format(date) : '—';
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]];

export function formatRelative(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return 'Never';
  let v = (date.getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(v) < size) return RELATIVE.format(Math.round(v), unit);
    v /= size;
  }
  return DATE_TIME.format(date);
}
