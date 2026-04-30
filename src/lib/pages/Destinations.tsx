import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [tpids, setTpids] = useState<string[]>([]);
  const [selectedTpid, setSelectedTpid] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchTpids = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const result = await api.getTPIds(baseUrl);
      setTpids(result || []);
    } catch { setTpids([]); }
  }, [baseUrl]);

  useState(() => { fetchTpids(); });

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !selectedTpid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTPDestinationIDs(baseUrl, selectedTpid) as string[];
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, selectedTpid]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getTPDestination(baseUrl, selectedTpid, id);
      setDetail(result);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, selectedTpid]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Destinations</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>TPID</InputLabel>
            <Select value={selectedTpid} label="TPID" onChange={e => setSelectedTpid(e.target.value)}>
              {tpids.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchIds} disabled={!selectedTpid}>Search</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center">No results</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Details</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}>
            <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
          </Paper>
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
