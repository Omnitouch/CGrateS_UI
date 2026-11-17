import { Box, Tooltip, Typography } from '@mui/material';
import { formatBalanceValue } from './BalanceValue';

// utils.Round: *middle rounds half up.
const ROUNDING: Record<string, string> = { '*up': 'up', '*middle': 'to nearest', '*down': 'down' };

export const ROUNDING_OPTIONS: [string, string][] = [['*up', 'Round up'], ['*middle', 'Round to nearest (half up)'], ['*down', 'Round down']];
export const MAX_COST_OPTIONS: [string, string][] = [['', 'No cap'], ['*free', 'Free once the cap is reached'], ['*disconnect', 'Cut off at the cap']];

export function roundingText(method: string, decimals: number) {
  return `${ROUNDING[method] ?? method ?? '—'}, ${decimals} decimal${decimals === 1 ? '' : 's'}`;
}

/** Engine ignores MaxCost without a strategy; with one, the balance debit applies it even at 0. */
export function capText(max: number, strategy: string) {
  if (!strategy) return max ? `none (MaxCost ${max} has no strategy, so it is not enforced)` : 'none';
  const then = strategy === '*free' ? 'then free' : strategy === '*disconnect' ? 'then cut off' : `then ${strategy}`;
  return max > 0 ? `${max}, ${then}` : `0, ${then} (reached from the first increment when debiting)`;
}

const raw = (v: string | number) => (v === '' ? '""' : String(v));

export function RoundingCell({ method, decimals }: { method: string; decimals: number }) {
  return (
    <Box>
      <Typography variant="body2">{roundingText(method, decimals)}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>RoundingMethod {raw(method)} · RoundingDecimals {decimals}</Typography>
    </Box>
  );
}

export function CapCell({ max, strategy }: { max: number; strategy: string }) {
  return (
    <Box>
      <Typography variant="body2">{capText(max, strategy)}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>MaxCost {max} · MaxCostStrategy {raw(strategy)}</Typography>
    </Box>
  );
}

interface LiveSlot { GroupIntervalStart: number; Value: number; RateIncrement: number; RateUnit: number }

const hedge = (n: number) => `${formatBalanceValue(n, '*voice')} if time, ${formatBalanceValue(n, '*data')} if bytes`;

/** Rate units are raw integers (ns-typed durations); the plan does not say if it rates time, bytes or units. */
export function RateSlotText({ slot }: { slot: LiveSlot }) {
  const s = slot;
  return (
    <Tooltip title={`Unit ≈ ${hedge(s.RateUnit)}; increment ≈ ${hedge(s.RateIncrement)}; from ≈ ${hedge(s.GroupIntervalStart)}`}>
      <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
        {s.Value} per {s.RateUnit}, increment {s.RateIncrement}, from {s.GroupIntervalStart}
      </Box>
    </Tooltip>
  );
}
