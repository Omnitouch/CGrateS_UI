const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const rel = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

// CGrateS sends 0001-01-01T00:00:00Z for unset times.
function toDate(d: string | number | Date | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) || date.getFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  return date ? fmt.format(date) : '—';
}

export function formatRelative(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return 'Never';
  const s = Math.round((date.getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]];
  let v = s;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rel.format(v, unit);
    v = Math.round(v / size);
  }
  return fmt.format(date);
}
