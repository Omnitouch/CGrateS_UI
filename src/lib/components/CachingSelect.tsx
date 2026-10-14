import { MenuItem, TextField, type SxProps, type Theme } from '@mui/material';
import { CACHING_OPTIONS } from '../cgrConsts';

interface CachingSelectProps {
  value: string;
  onChange: (value: string) => void;
  sx?: SxProps<Theme>;
}

/** Picks APIOpts.*cache; empty leaves it to the server's default. */
export default function CachingSelect({ value, onChange, sx }: CachingSelectProps) {
  return (
    <TextField
      select size="small" label="Caching" sx={{ minWidth: 160, ...sx }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <MenuItem value=""><em>Server default</em></MenuItem>
      {CACHING_OPTIONS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  );
}

/** APIOpts carrying the chosen caching, or {} for the server default. */
export function cachingOpts(caching: string): Record<string, string> {
  return caching ? { '*cache': caching } : {};
}
