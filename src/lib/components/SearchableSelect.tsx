import { Autocomplete, TextField, type SxProps, type Theme } from '@mui/material';

interface SearchableSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  groupBy?: (option: string) => string;
  disableClearable?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Dropdown that narrows its options as you type (case-insensitive substring match).
 * Empty string means nothing selected.
 */
export default function SearchableSelect({
  label, value, options, onChange, placeholder, groupBy, disableClearable, fullWidth, disabled, sx,
}: SearchableSelectProps) {
  // Keep the current value displayable even before its option list has loaded.
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Autocomplete<string, false, boolean, false>
      size="small"
      options={opts}
      value={value || null}
      onChange={(_e, v) => onChange(v ?? '')}
      groupBy={groupBy}
      disableClearable={disableClearable}
      fullWidth={fullWidth}
      disabled={disabled}
      autoHighlight
      sx={sx}
      renderInput={params => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}
