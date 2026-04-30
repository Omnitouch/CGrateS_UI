import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { AnalyzerResult } from '../types';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [headerFilters, setHeaderFilters] = useState('');
  const [limit, setLimit] = useState(50);
  const [results, setResults] = useState<AnalyzerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<AnalyzerResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchResults = useCallback(async (off = 0) => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try { const r = await api.analyzerStringQuery(baseUrl, { HeaderFilters: headerFilters, Limit: limit, Offset: off, ContentFilters: [] }) as AnalyzerResult[]; setResults(r || []); setOffset(off); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setResults([]); }
    finally { setLoading(false); }
  }, [baseUrl, headerFilters, limit]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Analyzer</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField size="small" label="Header Filters (Bleve)" value={headerFilters} onChange={e => setHeaderFilters(e.target.value)} sx={{ flex: 1, minWidth: 300 }} />
        <TextField size="small" label="Limit" type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 50)} sx={{ width: 100 }} />
        <Button variant="contained" onClick={() => fetchResults(0)}>Search</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Time</TableCell><TableCell>Method</TableCell><TableCell>Duration</TableCell><TableCell>Source</TableCell></TableRow></TableHead><TableBody>
          {results.length > 0 ? results.map((r, i) => (<TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(r); setDetailOpen(true); }}><TableCell>{offset + i + 1}</TableCell><TableCell>{r.RequestStartTime ? new Date(r.RequestStartTime).toLocaleString() : '-'}</TableCell><TableCell><code>{r.RequestMethod}</code></TableCell><TableCell>{r.RequestDuration}</TableCell><TableCell>{r.RequestSource}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={5} align="center">No results</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}><Button disabled={offset === 0} onClick={() => fetchResults(Math.max(0, offset - limit))}>Previous</Button><Button disabled={results.length < limit} onClick={() => fetchResults(offset + limit)}>Next</Button></Box>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{detail?.RequestMethod || 'Details'}</DialogTitle><DialogContent><Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper></DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
