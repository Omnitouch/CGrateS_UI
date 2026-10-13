import { useState } from 'react';
import { Box, MenuItem, TextField, Typography, type SxProps, type Theme } from '@mui/material';

interface Unit {
  label: string;
  factor: number;
}

// CGrateS stores *data in bytes and *voice in nanoseconds.
const DATA_UNITS: Unit[] = [
  { label: 'B', factor: 1 },
  { label: 'KB', factor: 1024 },
  { label: 'MB', factor: 1024 ** 2 },
  { label: 'GB', factor: 1024 ** 3 },
  { label: 'TB', factor: 1024 ** 4 },
];

const VOICE_UNITS: Unit[] = [
  { label: 'ns', factor: 1 },
  { label: 'ms', factor: 1e6 },
  { label: 'sec', factor: 1e9 },
  { label: 'min', factor: 60e9 },
  { label: 'hours', factor: 3600e9 },
];

export const BALANCE_TYPES = ['*monetary', '*voice', '*data', '*sms', '*mms', '*generic'];

function unitsFor(balanceType: string | undefined): { units: Unit[]; base: string; fallback: string } | null {
  switch (balanceType?.toLowerCase()) {
    case '*data': return { units: DATA_UNITS, base: 'bytes', fallback: 'MB' };
    case '*voice': return { units: VOICE_UNITS, base: 'ns', fallback: 'min' };
    default: return null;
  }
}

/** Largest unit that represents raw exactly; falls back to the largest unit <= raw. */
function pickEditUnit(raw: number, units: Unit[], fallback: string): Unit {
  if (!raw) return units.find(u => u.label === fallback)!;
  const exact = [...units].reverse().find(u => raw % u.factor === 0);
  return exact ?? [...units].reverse().find(u => Math.abs(raw) >= u.factor) ?? units[0];
}

function pickDisplayUnit(raw: number, units: Unit[]): Unit {
  return [...units].reverse().find(u => Math.abs(raw) >= u.factor) ?? units[0];
}

function trimNumber(n: number, maxDecimals: number): string {
  return Number(n.toFixed(maxDecimals)).toString();
}

export function formatBalanceValue(raw: number, balanceType: string | undefined): string {
  const spec = unitsFor(balanceType);
  if (!spec || !raw) return String(raw);
  const unit = pickDisplayUnit(raw, spec.units);
  return `${trimNumber(raw / unit.factor, 2)} ${unit.label}`;
}

export function BalanceValueDisplay({ value, balanceType }: { value: number; balanceType?: string }) {
  const spec = unitsFor(balanceType);
  if (!spec) return <Typography variant="body1">{value}</Typography>;
  return (
    <Typography variant="body1">
      {formatBalanceValue(value, balanceType)}{' '}
      <Typography component="span" variant="caption" color="text.secondary">{`(${value} ${spec.base})`}</Typography>
    </Typography>
  );
}

interface BalanceValueInputProps {
  value: number;
  balanceType?: string;
  onChange: (raw: number) => void;
  sx?: SxProps<Theme>;
}

/** Remount (via key) when balanceType changes so the unit is re-picked. */
export function BalanceValueInput({ value, balanceType, onChange, sx }: BalanceValueInputProps) {
  const spec = unitsFor(balanceType);
  const [unit, setUnit] = useState<Unit | null>(() => spec ? pickEditUnit(value, spec.units, spec.fallback) : null);
  const [text, setText] = useState(() => unit ? trimNumber(value / unit.factor, 6) : String(value));

  const emit = (t: string, u: Unit | null) => {
    const n = parseFloat(t) || 0;
    onChange(u ? Math.round(n * u.factor) : n);
  };

  if (!spec || !unit) {
    return (
      <TextField
        fullWidth size="small" sx={sx}
        value={text}
        onChange={e => { setText(e.target.value); emit(e.target.value, null); }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, ...sx }}>
      <TextField
        fullWidth size="small" type="number"
        inputProps={{ step: 'any' }}
        value={text}
        onChange={e => { setText(e.target.value); emit(e.target.value, unit); }}
        helperText={`= ${value} ${spec.base}`}
      />
      <TextField
        select size="small" sx={{ minWidth: 100 }}
        value={unit.label}
        onChange={e => {
          const u = spec.units.find(x => x.label === e.target.value)!;
          setUnit(u);
          emit(text, u);
        }}
      >
        {spec.units.map(u => <MenuItem key={u.label} value={u.label}>{u.label}</MenuItem>)}
      </TextField>
    </Box>
  );
}
