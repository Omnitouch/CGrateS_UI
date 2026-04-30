import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { useConfig } from '../hooks';

export function Component() {
  const { data, isLoading, error } = useConfig();
  return (
    <Box>
      <Typography variant="h5" gutterBottom>CGrateS Configuration</Typography>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error instanceof Error ? error.message : 'Failed to load config'}</Alert>}
      {data && <Paper sx={{ p: 2, maxHeight: '80vh', overflow: 'auto', bgcolor: 'grey.50' }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(data, null, 2)}</pre></Paper>}
    </Box>
  );
}
