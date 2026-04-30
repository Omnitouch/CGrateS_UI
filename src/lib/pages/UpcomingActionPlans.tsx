import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, Chip } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ScheduledAction } from '../types';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [results, setResults] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScheduledAction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const pageSize = 50;

  const fetchResults = useCallback(async (p = 0) => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try { const r = await api.getScheduledActions(baseUrl, p * pageSize, pageSize) as ScheduledAction[]; setResults(r || []); setPage(p); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setResults([]); }
    finally { setLoading(false); }
  }, [baseUrl]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Upcoming Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Button variant="contained" onClick={() => fetchResults(0)}>Fetch Scheduled Actions</Button></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Action Plan ID</TableCell><TableCell>Actions ID</TableCell><TableCell>Next Run</TableCell><TableCell>Accounts</TableCell></TableRow></TableHead><TableBody>
          {results.length > 0 ? results.map((item, i) => (<TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(item); setDetailOpen(true); }}><TableCell>{page * pageSize + i + 1}</TableCell><TableCell>{item.ActionPlanID}</TableCell><TableCell>{item.ActionsID}</TableCell><TableCell>{new Date(item.NextRunTime).toLocaleString()}</TableCell><TableCell><Chip label={item.Accounts} size="small" color={item.Accounts > 0 ? 'success' : 'default'} /></TableCell></TableRow>)) : <TableRow><TableCell colSpan={5} align="center">No upcoming action plans</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}><Button disabled={page === 0} onClick={() => fetchResults(page - 1)}>Previous</Button><Button disabled={results.length < pageSize} onClick={() => fetchResults(page + 1)}>Next</Button></Box>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Scheduled Action Details</DialogTitle><DialogContent><Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper></DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
