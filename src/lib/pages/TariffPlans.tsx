import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useTPIds, useRemoveTP } from '../hooks';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { data: tpids, isLoading, error: fetchError, refetch } = useTPIds();
  const removeTP = useRemoveTP();
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleRemove = useCallback(async (tpid: string) => {
    if (!window.confirm(`Remove tariff plan: ${tpid}?`)) return;
    try { await removeTP.mutateAsync(tpid); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [removeTP]);

  const handleLoad = useCallback(async (tpid: string) => {
    if (!baseUrl) return;
    setActionLoading(true);
    try { await api.loadTariffPlanFromStorDb(baseUrl, tpid); alert(`Loaded ${tpid} successfully`); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setActionLoading(false); }
  }, [baseUrl]);

  const handleExport = useCallback(async (tpid: string) => {
    if (!baseUrl) return;
    setActionLoading(true);
    try { const r = await api.exportTPToFolder(baseUrl, tpid) as Record<string, unknown>; alert(`Exported ${tpid}: ${JSON.stringify(r)}`); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setActionLoading(false); }
  }, [baseUrl]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Tariff Plans</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError instanceof Error ? fetchError.message : 'Failed to load'}</Alert>}
      {(isLoading || actionLoading) && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {tpids && tpids.length > 0 && (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>TPID</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
          {tpids.map((tpid, i) => (<TableRow key={tpid}><TableCell>{i+1}</TableCell><TableCell>{tpid}</TableCell><TableCell>
            <Button size="small" color="error" onClick={() => handleRemove(tpid)} sx={{ mr: 1 }}>Remove</Button>
            <Button size="small" onClick={() => handleLoad(tpid)} sx={{ mr: 1 }}>Load from StorDB</Button>
            <Button size="small" onClick={() => handleExport(tpid)}>Export to Folder</Button>
          </TableCell></TableRow>))}
        </TableBody></Table></TableContainer>
      )}
      {tpids && tpids.length === 0 && <Typography color="text.secondary">No tariff plans found</Typography>}
    </Box>
  );
}
