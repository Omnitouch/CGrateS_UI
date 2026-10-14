import { useEffect, useRef, useState } from 'react';
import { Box, MenuItem, TextField, Typography, type SxProps, type Theme } from '@mui/material';
import { resolveExpiry } from '../expiryTime';

type Mode = 'unlimited' | 'daily' | 'monthly' | 'monthly_estimated' | 'yearly' | 'month_plus' | 'month_end' | 'after' | 'date' | 'custom';
type Unit = 'm' | 'h' | 'd' | 'w';

// Every form CGrateS ParseTimeDetectLayout accepts; anything else goes through Custom and is validated.
const MODES: { mode: Mode; label: string; keyword?: string }[] = [
  { mode: 'unlimited', label: 'Never (*unlimited)', keyword: '*unlimited' },
  { mode: 'daily', label: '1 day after it runs (*daily)', keyword: '*daily' },
  { mode: 'monthly', label: '1 month after it runs (*monthly)', keyword: '*monthly' },
  { mode: 'month_plus', label: '1 month after it runs, plus a duration (*month+…)' },
  { mode: 'monthly_estimated', label: '1 month, capped at the end of next month (*monthly_estimated)', keyword: '*monthly_estimated' },
  { mode: 'yearly', label: '1 year after it runs (*yearly)', keyword: '*yearly' },
  { mode: 'month_end', label: 'End of the month it runs in, plus a duration (*month_end+…)' },
  { mode: 'after', label: 'A set time after it runs (+duration)' },
  { mode: 'date', label: 'Fixed date' },
  { mode: 'custom', label: 'Custom' },
];

const UNITS: { unit: Unit; label: string; hours?: number }[] = [
  { unit: 'm', label: 'minutes' },
  { unit: 'h', label: 'hours', hours: 1 },
  { unit: 'd', label: 'days', hours: 24 },
  { unit: 'w', label: 'weeks', hours: 168 },
];

interface State {
  mode: Mode;
  amount: string;
  unit: Unit;
  date: string;
  custom: string;
}

/** Splits a Go duration such as 720h or 90m into the largest whole unit; null if it isn't that simple. */
function splitDuration(dur: string | undefined): { amount: string; unit: Unit } | null {
  if (!dur) return { amount: '', unit: 'd' };
  const m = /^(\d+)([mh])$/.exec(dur);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === 'm') return { amount: String(n), unit: 'm' };
  if (n % 168 === 0) return { amount: String(n / 168), unit: 'w' };
  if (n % 24 === 0) return { amount: String(n / 24), unit: 'd' };
  return { amount: String(n), unit: 'h' };
}

function toDuration(amount: string, unit: Unit): string {
  const n = parseInt(amount, 10);
  if (!(n > 0)) return '';
  if (unit === 'm') return `${n}m`;
  return `${n * UNITS.find(u => u.unit === unit)!.hours!}h`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parse(value: string): State {
  const base: State = { mode: 'custom', amount: '', unit: 'd', date: '', custom: value };
  const v = value.trim();
  if (!v) return { ...base, mode: 'unlimited' };
  const keyword = MODES.find(m => m.keyword === v);
  if (keyword) return { ...base, mode: keyword.mode };
  const monthEnd = /^\*month_end(?:\+(.+))?$/.exec(v);
  if (monthEnd) {
    const d = splitDuration(monthEnd[1]);
    if (d) return { ...base, mode: 'month_end', ...d };
  }
  const monthPlus = /^\*month(?:ly)?(?:\+(.+))?$/.exec(v);
  if (monthPlus) {
    const d = splitDuration(monthPlus[1]);
    if (d) return { ...base, mode: 'month_plus', ...d };
  }
  if (v.startsWith('+')) {
    const d = splitDuration(v.slice(1));
    if (d) return { ...base, mode: 'after', ...d };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return { ...base, mode: 'date', date: toLocalInput(d) };
  }
  return base;
}

function build(s: State): string {
  const keyword = MODES.find(m => m.mode === s.mode)?.keyword;
  if (keyword) return keyword;
  const dur = toDuration(s.amount, s.unit);
  switch (s.mode) {
    case 'month_end': return dur ? `*month_end+${dur}` : '*month_end';
    case 'month_plus': return dur ? `*month+${dur}` : '*month';
    case 'after': return dur ? `+${dur}` : '';
    case 'date': return s.date ? new Date(s.date).toISOString().replace('.000Z', 'Z') : '';
    default: return s.custom;
  }
}

interface ExpiryTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  sx?: SxProps<Theme>;
}

/** Edits a CGrateS expiry string: keywords, +duration, *month_end/*month plus a duration, a date, or free text. */
export default function ExpiryTimeInput({ value, onChange, sx }: ExpiryTimeInputProps) {
  const [state, setState] = useState<State>(() => parse(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setState(parse(value));
    }
  }, [value]);

  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch };
    if (patch.mode && patch.mode !== state.mode) {
      if (patch.mode === 'custom') next.custom = build(state);
      if (patch.mode === 'after') Object.assign(next, { amount: '30', unit: 'd' });
      if (patch.mode === 'month_end' || patch.mode === 'month_plus') Object.assign(next, { amount: '', unit: 'd' });
    }
    setState(next);
    const out = build(next);
    lastEmitted.current = out;
    onChange(out);
  };

  const resolved = resolveExpiry(value);
  const hasDuration = state.mode === 'after' || state.mode === 'month_end' || state.mode === 'month_plus';

  return (
    <Box sx={sx}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          select size="small" sx={{ flex: '1 1 280px' }}
          value={state.mode}
          onChange={e => update({ mode: e.target.value as Mode })}
          slotProps={{ htmlInput: { 'aria-label': 'Expires' } }}
        >
          {MODES.map(m => <MenuItem key={m.mode} value={m.mode}>{m.label}</MenuItem>)}
        </TextField>
        {hasDuration && (
          <>
            <TextField
              size="small" type="number" sx={{ width: 110 }}
              label={state.mode === 'after' ? 'After' : 'Plus'}
              placeholder="0"
              value={state.amount}
              onChange={e => update({ amount: e.target.value.replace(/[^\d]/g, '') })}
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              select size="small" sx={{ width: 120 }}
              value={state.unit}
              onChange={e => update({ unit: e.target.value as Unit })}
              slotProps={{ htmlInput: { 'aria-label': 'Unit' } }}
            >
              {UNITS.map(u => <MenuItem key={u.unit} value={u.unit}>{u.label}</MenuItem>)}
            </TextField>
          </>
        )}
        {state.mode === 'date' && (
          <TextField
            size="small" type="datetime-local" sx={{ width: 240 }}
            value={state.date}
            onChange={e => update({ date: e.target.value })}
          />
        )}
        {state.mode === 'custom' && (
          <TextField
            size="small" sx={{ flex: '1 1 240px' }}
            placeholder="e.g. *month_end+36h, +1h30m, 1798761600, 2026-12-31 23:59:59"
            value={state.custom}
            onChange={e => update({ custom: e.target.value })}
            error={resolved.kind === 'invalid'}
          />
        )}
      </Box>
      <Typography
        variant="caption" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}
        color={resolved.kind === 'invalid' ? 'error' : 'text.secondary'}
      >
        <code>{value.length > 80 ? `${value.slice(0, 80)}…` : value || '(empty)'}</code>
        {' · '}
        {resolved.kind === 'never' && 'never expires'}
        {resolved.kind === 'relative' && `if run now, expires ${resolved.at.toLocaleString()}`}
        {resolved.kind === 'absolute' && `expires ${resolved.at.toLocaleString()}`}
        {resolved.kind === 'server-local' && 'valid date, read in the OCS server\'s timezone'}
        {resolved.kind === 'invalid' && 'CGrateS can\'t parse this, so the balance would silently never expire'}
      </Typography>
    </Box>
  );
}
