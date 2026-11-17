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
  const parts = id.split('__');
  for (let n = 0; n < parts.length; n++) {
    const part = parts[n];
    const i = part.indexOf('_');
    if (i < 0) { fields[part] = part; continue; }
    const key = part.slice(0, i);
    // Free-text names can themselves contain "__" (e.g. "Friends__Family"), so a *Name key takes the rest of the ID.
    if (key.endsWith('Name')) { fields[key] = parts.slice(n).join('__').slice(i + 1); break; }
    fields[key] = part.slice(i + 1);
  }
  return fields;
}

const humanize = (v: string) => v.replace(/_+/g, ' ').trim();

/** ProductName field of a "Key_Value__…" ID, or null when the ID does not carry one. */
export function compositeProductName(id: string): string | null {
  if (!id.includes('__')) return null;
  const name = parseCompositeId(id).ProductName;
  return name ? humanize(name) || null : null;
}

export function compositeTitle(fields: Record<string, string>): string | null {
  if (fields.ProductName) return humanize(fields.ProductName);
  if (fields.ActionPlan) return humanize(fields.ActionPlan);
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
          {chips.map(([k, v]) => <Chip key={k} size="small" variant="outlined" label={`${k}: ${humanize(v)}`} />)}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" title={id} sx={{ display: 'block', ...(compact ? ellipsis : { wordBreak: 'break-all' }) }}>
        {id}
      </Typography>
    </Box>
  );
}

/** List cell: the raw ID as the primary line, the label derived from it (when the ID parses) underneath. */
export function IdWithLabel({ id, hideLabel }: { id: string; hideLabel?: boolean }) {
  const label = !hideLabel && id.includes('__') ? compositeTitle(parseCompositeId(id)) : null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 500, ...ellipsis }} title={id}>{id}</Typography>
      {label && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...ellipsis }}>{label}</Typography>}
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
