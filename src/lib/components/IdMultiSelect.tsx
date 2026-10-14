import { Autocomplete, Chip, TextField, type SxProps, type Theme } from '@mui/material';

interface IdMultiSelectProps {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

/** Multi-select of known IDs that also accepts typed values (inline filters, *none, IDs not loaded yet). */
export default function IdMultiSelect({
  label, value, options, onChange, placeholder, helperText, fullWidth = true, disabled, sx,
}: IdMultiSelectProps) {
  return (
    <Autocomplete<string, true, false, true>
      multiple freeSolo autoSelect size="small"
      options={options}
      value={value}
      onChange={(_e, v) => onChange(v.map(s => s.trim()).filter(Boolean))}
      fullWidth={fullWidth}
      disabled={disabled}
      sx={sx}
      renderTags={(vals, getTagProps) => vals.map((v, i) => {
        const { key, ...rest } = getTagProps({ index: i });
        return <Chip key={key} size="small" label={v} {...rest} />;
      })}
      renderInput={params => (
        <TextField {...params} label={label} placeholder={value.length ? undefined : placeholder} helperText={helperText} />
      )}
    />
  );
}

/** For fields CGrateS stores as one ";"-separated string. */
export function splitIds(s: string | undefined | null): string[] {
  return (s || '').split(';').map(x => x.trim()).filter(Boolean);
}

export function joinIds(ids: string[]): string {
  return ids.join(';');
}

/** CGrateS StringMap ({ID: true, excluded: false}) as IDs, excluded ones prefixed with "!". */
export function stringMapToIds(m: Record<string, boolean> | string | null | undefined): string[] {
  if (!m) return [];
  if (typeof m === 'string') return splitIds(m);
  return Object.entries(m).map(([k, v]) => (v ? k : `!${k}`));
}
