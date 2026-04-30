import { Box, Typography, Paper } from '@mui/material';
import { useOcsBaseUrl } from '../OcsContext';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const csvUrl = baseUrl ? baseUrl.replace(/:(?!.*:).*/, '') + '/csv/' : '';

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Exported CDRs</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Exported CDRs are available for download in CSV format. Your exports must be configured to write to the /tmp directory and your web server must allow access to these files.
      </Typography>
      {csvUrl && (
        <Paper sx={{ height: '80vh', overflow: 'hidden' }}>
          <iframe src={csvUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Exported CDRs" />
        </Paper>
      )}
    </Box>
  );
}
