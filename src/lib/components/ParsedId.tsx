import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import { formatBalanceValue } from './BalanceValue';

// ID conventions shared with OmniCRM: "Name__<bucket>" for balances, "Key_Value__Key_Value" for plans/actions.

export interface ParsedBalanceId {
  name: string;
  bucket: number | null;
  unlimited: boolean;
}

export function parseBalanceId(id: string): ParsedBalanceId {
  const [head, suffix] = id.split('__');
  const name = head.replace(/_/g, ' ');
  if (suffix === undefined) return { name, bucket: null, unlimited: false };
  if (suffix.toLowerCase() === 'unlimited') return { name, bucket: null, unlimited: true };
  // CGrateS "m" macro: minutes, stored as nanoseconds.
  const minutes = /^(\d+)m$/.exec(suffix);
  if (minutes) return { name, bucket: Number(minutes[1]) * 60e9, unlimited: false };
  return { name, bucket: /^\d+$/.test(suffix) ? Number(suffix) : null, unlimited: false };
}

export function parseCompositeId(id: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of id.split('__')) {
    const i = part.indexOf('_');
    if (i >= 0) fields[part.slice(0, i)] = part.slice(i + 1);
    else fields[part] = part;
  }
  return fields;
}

function compositeTitle(fields: Record<string, string>): string | null {
  if (fields.ProductName) return fields.ProductName.replace(/_/g, ' ');
  if (fields.ActionPlan) return fields.ActionPlan.replace(/_/g, ' ');
  return null;
}

const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/** Plan/action ID: human title, key/value chips (unless compact), raw ID underneath. */
export function CompositeId({ id, compact }: { id: string; compact?: boolean }) {
  if (!id || !id.includes('__')) return <>{id}</>;
  const fields = parseCompositeId(id);
  const title = compositeTitle(fields);
  const chips = Object.entries(fields).filter(([k]) => k !== 'ProductName');
  return (
    <Box sx={{ minWidth: 0 }}>
      {title && <Typography variant="body2" fontWeight="bold" sx={compact ? ellipsis : undefined}>{title}</Typography>}
      {!compact && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.5 }}>
          {chips.map(([k, v]) => <Chip key={k} size="small" variant="outlined" label={`${k}: ${v.replace(/_/g, ' ')}`} />)}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" title={id} sx={{ display: 'block', ...(compact ? ellipsis : { wordBreak: 'break-all' }) }}>
        {id}
      </Typography>
    </Box>
  );
}

/** Balance ID: human name with raw ID underneath. */
export function BalanceName({ id }: { id: string }) {
  if (!id) return <>{id}</>;
  const { name } = parseBalanceId(id);
  if (name === id) return <>{id}</>;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight="bold">{name}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>{id}</Typography>
    </Box>
  );
}

/** Original bucket size from the balance ID suffix, with remaining percentage when a current value is given. */
export function BalanceBucket({ id, balanceType, value }: { id: string; balanceType?: string; value?: number }) {
  if (!id) return null;
  const { bucket, unlimited } = parseBalanceId(id);
  if (unlimited) return <Chip size="small" color="success" label="Unlimited" sx={{ mt: 0.5 }} />;
  if (!bucket) return null;
  const bucketText = formatBalanceValue(bucket, balanceType);
  if (value === undefined) {
    return <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Bucket: {bucketText}</Typography>;
  }
  const pct = Math.max(0, Math.min(100, (value / bucket) * 100));
  return (
    <Box sx={{ mt: 0.5, minWidth: 120 }}>
      <LinearProgress variant="determinate" value={pct} />
      <Typography variant="caption" color="text.secondary">
        {`${pct.toFixed(0)}% of ${bucketText} remaining`}
      </Typography>
    </Box>
  );
}
