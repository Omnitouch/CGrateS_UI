const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// CGrateS reports unset times as 0001-01-01T00:00:00Z.
function toDate(d: string | number | Date | null | undefined): Date | null {
  if (d == null || d === '') return null;
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) || x.getUTCFullYear() <= 1 ? null : x;
}

export function formatDateTime(d: string | number | Date | null | undefined): string {
  const x = toDate(d);
  return x ? dateTimeFormat.format(x) : '—';
}

export function formatRelative(d: string | number | Date | null | undefined): string {
  const x = toDate(d);
  if (!x) return 'Never';
  const diff = Date.now() - x.getTime();
  const s = Math.round(Math.abs(diff) / 1000);
  const v = s < 60 ? null : s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} d`;
  if (!v) return 'just now';
  return diff >= 0 ? `${v} ago` : `in ${v}`;
}
