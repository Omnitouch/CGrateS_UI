// Mirrors CGrateS utils.ParseTimeDetectLayout, which resolves action ExpiryTime when the action runs.
// CGrateS ignores parse errors there, so an invalid value silently means "never expires".

const GO_DURATION = /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h))+$/;
const GO_DURATION_PART = /(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h)/g;
const UNIT_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, 'µs': 1e-3, 'μs': 1e-3, ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

/** Go time.ParseDuration, in milliseconds; null when invalid. */
export function parseGoDuration(s: string): number | null {
  let sign = 1;
  if (s.startsWith('-')) { sign = -1; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  if (s === '0') return 0;
  if (!GO_DURATION.test(s)) return null;
  let ms = 0;
  for (const [, n, unit] of s.matchAll(GO_DURATION_PART)) ms += parseFloat(n) * UNIT_MS[unit];
  return sign * ms;
}

/** Extra duration after the first "+", as in *month_end+24h; 0 when there is none. */
function addDuration(s: string): number | null {
  const i = s.indexOf('+');
  return i === -1 ? 0 : parseGoDuration(s.slice(i + 1));
}

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export type ExpiryResolution =
  | { kind: 'never' }
  | { kind: 'relative' | 'absolute'; at: Date }
  /** Valid, but resolved in the server's timezone, so no exact preview. */
  | { kind: 'server-local' }
  | { kind: 'invalid' };

const SERVER_LOCAL_LAYOUTS = [
  /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/, // sql
  /^\d{14}$/, // 20060102150405
  /^\d{2}\/\d{2}\/\d{4}\s{1}\d{2}:\d{2}:\d{2}$/,
  /^\d{14}\.\d{3}/,
  /^\d{4}-\d{2}-\d{2}[T]\d{2}:\d{2}:\d{2}$/, // no zone
];
const GO_TIME_LAYOUTS = [
  /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.?\d*\s[+,-]\d+\s\w+$/,
  /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.?\d*\s[+,-]\d+\s[+,-]\d+$/,
];

export function resolveExpiry(value: string, now = new Date()): ExpiryResolution {
  const s = value.trim();
  if (s === '' || s === '*unlimited' || s === '0') return { kind: 'never' };
  const rel = (at: Date | null): ExpiryResolution => (at && !isNaN(at.getTime()) ? { kind: 'relative', at } : { kind: 'invalid' });
  const plus = (base: Date, extra: number | null) => (extra === null ? null : new Date(base.getTime() + extra));

  if (s === '*daily') { const d = new Date(now); d.setDate(d.getDate() + 1); return rel(d); }
  if (s === '*monthly') return rel(addMonths(now, 1));
  if (s === '*monthly_estimated') {
    const d = addMonths(now, 1);
    while ((d.getMonth() - now.getMonth() + 12) % 12 > 1) d.setDate(d.getDate() - 1);
    return rel(d);
  }
  if (s === '*yearly') { const d = new Date(now); d.setFullYear(d.getFullYear() + 1); return rel(d); }
  if (s.startsWith('*month_end')) {
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, -1);
    return rel(plus(eom, addDuration(s)));
  }
  if (s.startsWith('*mo')) return rel(plus(addMonths(now, 1), addDuration(s)));
  if (s === '*now') return rel(now);
  if (/^\d{10}$/.test(s)) return { kind: 'absolute', at: new Date(Number(s) * 1000) };
  if (/^\d{13}$/.test(s)) return { kind: 'absolute', at: new Date(Number(s)) };
  if (/^\d{16}$/.test(s)) return { kind: 'absolute', at: new Date(Number(s) / 1000) };
  if (/^\d{19}$/.test(s)) return { kind: 'absolute', at: new Date(Number(BigInt(s) / 1_000_000n)) };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d*[+,-]\d+$/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+$/.test(s)) {
    const at = new Date(s);
    return isNaN(at.getTime()) ? { kind: 'invalid' } : { kind: 'absolute', at };
  }
  if (GO_TIME_LAYOUTS.some(r => r.test(s))) return { kind: 'server-local' };
  if (SERVER_LOCAL_LAYOUTS.some(r => r.test(s))) return { kind: 'server-local' };
  if (s.startsWith('+') || s.startsWith('-')) return rel(plus(now, parseGoDuration(s)));
  return { kind: 'invalid' };
}
