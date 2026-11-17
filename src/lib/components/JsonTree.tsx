import { Box, Typography } from '@mui/material';

/** The parsed value when s is a JSON object or array, else undefined. */
export function parseJsonString(s: string): unknown[] | Record<string, unknown> | undefined {
  const t = s.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return undefined;
  try {
    const v = JSON.parse(t);
    return v && typeof v === 'object' ? v : undefined;
  } catch {
    return undefined;
  }
}

const mono = { fontFamily: 'monospace', fontSize: 12 } as const;

function Scalar({ value }: { value: unknown }) {
  if (value === null) return <Box component="span" sx={{ ...mono, color: 'text.disabled' }}>null</Box>;
  if (typeof value === 'string') return <Box component="span" sx={{ ...mono, wordBreak: 'break-all' }}>{JSON.stringify(value)}</Box>;
  return <Box component="span" sx={{ ...mono, color: 'info.main' }}>{String(value)}</Box>;
}

function Node({ name, value, depth, open }: { name?: string; value: unknown; depth: number; open: boolean }) {
  const label = name !== undefined && <Box component="span" sx={{ ...mono, fontWeight: 600 }}>{name}: </Box>;
  const parsed = typeof value === 'string' ? parseJsonString(value) : undefined;
  const inner = parsed ?? value;
  if (!inner || typeof inner !== 'object') return <Box sx={{ pl: depth ? 2 : 0 }}>{label}<Scalar value={value} /></Box>;
  const entries = Array.isArray(inner) ? inner.map((v, i) => [String(i), v] as const) : Object.entries(inner);
  const brackets = Array.isArray(inner) ? ['[', ']'] : ['{', '}'];
  return (
    <Box component="details" open={open} sx={{ pl: depth ? 2 : 0, '& > summary': { cursor: 'pointer' } }}>
      <summary>
        {label}
        <Box component="span" sx={{ ...mono, color: 'text.secondary' }}>
          {brackets[0]} {entries.length} {entries.length === 1 ? 'item' : 'items'} {brackets[1]}{parsed ? ' (JSON string)' : ''}
        </Box>
      </summary>
      {entries.length
        ? entries.map(([k, v]) => <Node key={k} name={k} value={v} depth={depth + 1} open={depth < 3} />)
        : <Typography sx={{ ...mono, pl: 2 }} color="text.disabled">empty</Typography>}
    </Box>
  );
}

/** Collapsible view of any JSON value; string values holding JSON objects/arrays are expanded too. */
export default function JsonTree({ value, open = true }: { value: unknown; open?: boolean }) {
  return <Node value={value} depth={0} open={open} />;
}
