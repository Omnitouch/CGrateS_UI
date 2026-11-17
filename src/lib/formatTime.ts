const dtf = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** CGrateS uses 0001-01-01T00:00:00Z for "unset". */
function toDate(d: string | number | Date | null | undefined): Date | null {
  if (d == null || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  const t = date.getTime();
  return Number.isNaN(t) || date.getUTCFullYear() <= 1 ? null : date;
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  return date ? dtf.format(date) : '—';
}

export function formatRelative(d: string | number | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return 'Never';
  const s = Math.round((date.getTime() - Date.now()) / 1000);
  const a = Math.abs(s);
  const [n, unit] = a < 60 ? [a, 'sec'] : a < 3600 ? [Math.floor(a / 60), 'min'] : a < 86400 ? [Math.floor(a / 3600), 'h'] : [Math.floor(a / 86400), 'd'];
  return s < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}
