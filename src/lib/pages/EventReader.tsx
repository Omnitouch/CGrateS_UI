import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useOcsBaseUrl } from '../OcsContext';
import { useConfig } from '../hooks';
import * as api from '../api';
import type { EventReaderConfig } from '../types';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { data: config } = useConfig();
  const readers: EventReaderConfig[] = config?.ers?.readers || [];
  const [detail, setDetail] = useState<EventReaderConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    if (!baseUrl || !detail) return;
    setRunning(true); setRunResult(null);
    try { const r = await api.runReader(baseUrl, detail.id); setRunResult(JSON.stringify(r, null, 2)); }
    catch (e: unknown) { setRunResult(e instanceof Error ? e.message : 'Failed'); }
    finally { setRunning(false); }
  }, [baseUrl, detail]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Event Reader</Typography>
      <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell><TableCell>Type</TableCell></TableRow></TableHead><TableBody>
        {readers.length > 0 ? readers.map((r, i) => (<TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(r); setRunResult(null); setDetailOpen(true); }}><TableCell>{i+1}</TableCell><TableCell>{r.id}</TableCell><TableCell>{r.type || 'N/A'}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} align="center">No readers found</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Reader: {detail?.id}</DialogTitle><DialogContent>
          <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper>
          <Button variant="contained" onClick={handleRun} disabled={running} sx={{ mt: 2 }}>{running ? <CircularProgress size={20} /> : 'Run Reader'}</Button>
          {runResult && <Paper sx={{ p: 1, mt: 2, bgcolor: 'grey.50' }}><pre style={{ fontSize: 12, margin: 0 }}>{runResult}</pre></Paper>}
        </DialogContent><DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
