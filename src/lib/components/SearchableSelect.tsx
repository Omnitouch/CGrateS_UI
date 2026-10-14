import { Autocomplete, TextField, createFilterOptions, type SxProps, type Theme } from '@mui/material';

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
  /** Also accept a typed value that isn't in options. */
  freeSolo?: boolean;
  /** Typed text, for options searched on the server. */
  onInputChange?: (text: string) => void;
  /** Renders at most this many matches so very long lists stay responsive. */
  maxOptions?: number;
  sx?: SxProps<Theme>;
}

/**
 * Dropdown that narrows its options as you type (case-insensitive substring match).
 * Empty string means nothing selected.
 */
export default function SearchableSelect({
  label, value, options, onChange, placeholder, groupBy, disableClearable, fullWidth, disabled, freeSolo, onInputChange, maxOptions, sx,
}: SearchableSelectProps) {
  // Keep the current value displayable even before its option list has loaded.
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Autocomplete<string, false, boolean, boolean>
      size="small"
      options={opts}
      value={value || null}
      onChange={(_e, v) => onChange(v ?? '')}
      groupBy={groupBy}
      disableClearable={disableClearable}
      fullWidth={fullWidth}
      disabled={disabled}
      autoHighlight
      freeSolo={freeSolo}
      filterOptions={maxOptions ? createFilterOptions({ limit: maxOptions }) : undefined}
      onInputChange={onInputChange ? (_e, v, reason) => { if (reason === 'input') onInputChange(v); } : undefined}
      autoSelect={freeSolo}
      sx={sx}
      renderInput={params => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}
