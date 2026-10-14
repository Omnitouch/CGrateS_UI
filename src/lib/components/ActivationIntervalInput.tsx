import { Box, TextField } from '@mui/material';
import { ZERO_TIME, isZeroTime } from '../cgrConsts';

export interface ActivationInterval {
  ActivationTime: string;
  ExpiryTime: string;
}

export function toLocalInput(t: string | undefined | null): string {
  if (isZeroTime(t)) return '';
  const d = new Date(t!);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string {
  return v ? new Date(v).toISOString() : ZERO_TIME;
}

export function formatActivationInterval(ai: ActivationInterval | null | undefined): string {
  if (!ai || (isZeroTime(ai.ActivationTime) && isZeroTime(ai.ExpiryTime))) return 'Always active';
  const fmt = (t: string) => (isZeroTime(t) ? '…' : new Date(t).toLocaleString());
  return `${fmt(ai.ActivationTime)} → ${fmt(ai.ExpiryTime)}`;
}

interface ActivationIntervalInputProps {
  value: ActivationInterval | null | undefined;
  onChange: (value: ActivationInterval | null) => void;
}

/** Edits a profile's ActivationInterval; both empty means always active (null). */
export default function ActivationIntervalInput({ value, onChange }: ActivationIntervalInputProps) {
  const set = (field: keyof ActivationInterval, v: string) => {
    const ai = { ActivationTime: ZERO_TIME, ExpiryTime: ZERO_TIME, ...value, [field]: fromLocalInput(v) };
    onChange(isZeroTime(ai.ActivationTime) && isZeroTime(ai.ExpiryTime) ? null : ai);
  };
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField
        label="Active from" type="datetime-local" size="small" sx={{ flex: '1 1 220px' }}
        value={toLocalInput(value?.ActivationTime)}
        onChange={e => set('ActivationTime', e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Active until" type="datetime-local" size="small" sx={{ flex: '1 1 220px' }}
        value={toLocalInput(value?.ExpiryTime)}
        onChange={e => set('ExpiryTime', e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Box>
  );
}
