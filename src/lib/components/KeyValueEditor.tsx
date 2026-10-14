import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export interface KeyValueRow {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  label: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyOptions?: string[];
  keyPlaceholder?: string;
}

/** Text that parses as JSON (numbers, true/false, objects, arrays, "quoted") is sent as that value, anything else as a string. */
export function parseKeyValueValue(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function rowsToObject(rows: KeyValueRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (k) out[k] = parseKeyValueValue(r.value);
  }
  return out;
}

export function objectToRows(obj: Record<string, unknown>): KeyValueRow[] {
  return Object.entries(obj).map(([key, v]) => ({ key, value: typeof v === 'string' ? v : JSON.stringify(v) }));
}

export default function KeyValueEditor({ label, rows, onChange, keyOptions, keyPlaceholder = 'Key' }: KeyValueEditorProps) {
  const listId = keyOptions ? `kv-${label.replace(/\W/g, '')}` : undefined;
  const set = (i: number, field: keyof KeyValueRow, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [field]: v } : r)));
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...rows, { key: '', value: '' }])}>Add</Button>
      </Box>
      {listId && <datalist id={listId}>{keyOptions!.map(o => <option key={o} value={o} />)}</datalist>}
      {rows.map((r, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <TextField
            size="small" placeholder={keyPlaceholder} value={r.key} sx={{ flex: '1 1 200px' }}
            onChange={e => set(i, 'key', e.target.value)}
            slotProps={{ htmlInput: { list: listId } }}
          />
          <TextField size="small" placeholder="Value" value={r.value} sx={{ flex: '2 1 260px' }} onChange={e => set(i, 'value', e.target.value)} />
          <IconButton size="small" color="error" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      {rows.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          Values that parse as JSON (10, true, {'{…}'}, "quoted") are sent typed; anything else is sent as a string.
        </Typography>
      )}
    </Box>
  );
}
