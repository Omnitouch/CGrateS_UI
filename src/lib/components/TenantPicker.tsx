import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { useOcsTenants } from '../OcsContext';
import SearchableSelect from './SearchableSelect';

/** Tenant dropdown; with a single configured tenant it is shown as plain text instead. */
export default function TenantPicker({ value, onChange, sx }: { value: string; onChange: (v: string) => void; sx?: SxProps<Theme> }) {
  const { tenants, tenantLabel } = useOcsTenants();
  if (tenants.length <= 1) {
    return (
      <Box sx={{ minWidth: 0, ...sx }}>
        <Typography variant="caption" color="text.secondary" component="div">Tenant</Typography>
        <Typography variant="body2" title={value} sx={{ wordBreak: 'break-all' }}>{tenantLabel(value)}</Typography>
      </Box>
    );
  }
  return (
    <SearchableSelect label="Tenant" value={value} options={tenants} onChange={onChange} disableClearable
      sx={{ minWidth: 320, ...sx }} />
  );
}
