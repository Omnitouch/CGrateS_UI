import { useState } from 'react';
import { Box, Button, Collapse, ListItemText, MenuItem, TextField, type SxProps, type Theme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { CACHING_OPTIONS } from '../cgrConsts';

// What APIerSv1.CallCache (apier/v1/libapier.go) does with each *cache value.
const CACHING_HINTS: Record<string, string> = {
  '*reload': 'Refresh the item in caches that already hold it',
  '*load': 'Load the item into the cache',
  '*remove': 'Drop the item from the cache; it is read from the database on next use',
  '*clear': 'Empty the whole cache partition for this kind of item',
  '*none': 'Leave the cache alone; engines keep their old copy',
};

interface CachingSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  sx?: SxProps<Theme>;
}

/** Picks APIOpts.*cache; empty leaves it to the server's general.default_caching. */
export default function CachingSelect({ value, onChange, label = 'Caching', helperText, sx }: CachingSelectProps) {
  return (
    <TextField
      select size="small" label={label} sx={{ minWidth: 260, ...sx }}
      value={value}
      onChange={e => onChange(e.target.value)}
      helperText={helperText ?? (value ? CACHING_HINTS[value] : 'Uses the server\'s default_caching setting')}
      SelectProps={{ displayEmpty: true, renderValue: v => (v ? String(v) : 'Server default') }}
      InputLabelProps={{ shrink: true }}
    >
      <MenuItem value=""><ListItemText primary="Server default" secondary="general.default_caching" /></MenuItem>
      {CACHING_OPTIONS.map(o => (
        <MenuItem key={o} value={o}><ListItemText primary={o} secondary={CACHING_HINTS[o]} /></MenuItem>
      ))}
    </TextField>
  );
}

/** Collapsed "Advanced" block holding the cache action for a save or delete. */
export function CachingAdvanced({ value, onChange, action = 'saving' }: { value: string; onChange: (v: string) => void; action?: string }) {
  const [open, setOpen] = useState(!!value);
  return (
    <Box>
      <Button size="small" onClick={() => setOpen(o => !o)} endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
        Advanced{value && !open ? ` (cache: ${value})` : ''}
      </Button>
      <Collapse in={open}>
        <Box sx={{ pt: 1.5 }}>
          <CachingSelect value={value} onChange={onChange} label={`After ${action}: reload cache`}
            helperText={`${value ? CACHING_HINTS[value] : 'Uses the server\'s default_caching setting'}. Sent as APIOpts *cache.`} />
        </Box>
      </Collapse>
    </Box>
  );
}

/** APIOpts carrying the chosen caching, or {} for the server default. */
export function cachingOpts(caching: string): Record<string, string> {
  return caching ? { '*cache': caching } : {};
}
