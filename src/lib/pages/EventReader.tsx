import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useConfig } from '../hooks';
import * as api from '../api';
import type { EventReaderConfig } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import KeyValueEditor, { rowsToObject, type KeyValueRow } from '../components/KeyValueEditor';
import { parseGoDuration } from '../expiryTime';

// ers.go V1RunReader only handles these reader types, and only with run_delay 0.
const MANUAL_TYPES = ['*file_csv', '*file_xml', '*file_fwv', '*file_json'];

function runBlocker(r: EventReaderConfig): string | null {
  if (!MANUAL_TYPES.includes(r.type || '')) return `type ${r.type || 'unset'} cannot be run manually`;
  const delay = String(r.run_delay ?? '0');
  if (parseGoDuration(delay) !== 0) return `run_delay is ${delay}; only readers with run_delay 0 can be run manually`;
  return null;
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const { data: config } = useConfig();
  const ersEnabled: boolean = !!config?.ers?.enabled;
  const readers: EventReaderConfig[] = config?.ers?.readers || [];
  const [tenant, setTenant] = useState(defaultTenant);
  const [apiOpts, setApiOpts] = useState<KeyValueRow[]>([]);
  const [detail, setDetail] = useState<EventReaderConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    if (!baseUrl || !detail) return;
    setRunning(true); setRunResult(null);
    try { const r = await api.runReader(baseUrl, tenant, detail.id, rowsToObject(apiOpts)); setRunResult(JSON.stringify(r, null, 2)); }
    catch (e: unknown) { setRunResult(e instanceof Error ? e.message : 'Failed'); }
    finally { setRunning(false); }
  }, [baseUrl, detail, tenant, apiOpts]);

  const blocker = detail ? runBlocker(detail) : null;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Event Reader</Typography>
      {config && !ersEnabled && <Alert severity="info" sx={{ mb: 2 }}>ERs is disabled in the running config (ers.enabled is false).</Alert>}
      <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell><TableCell>Type</TableCell><TableCell>Run Delay</TableCell><TableCell>Manual run</TableCell></TableRow></TableHead><TableBody>
        {readers.length > 0 ? readers.map((r, i) => {
          const b = runBlocker(r);
          return (
            <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(r); setRunResult(null); setDetailOpen(true); }}>
              <TableCell>{i + 1}</TableCell><TableCell>{r.id}</TableCell><TableCell>{r.type || 'N/A'}</TableCell>
              <TableCell>{String(r.run_delay ?? '')}</TableCell>
              <TableCell>{b ? <Chip size="small" label="Not supported" title={b} /> : <Chip size="small" color="success" label="Supported" />}</TableCell>
            </TableRow>
          );
        }) : <TableRow><TableCell colSpan={5} align="center">No readers found</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Reader: {detail?.id}</DialogTitle><DialogContent>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 300, overflow: 'auto', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper>
          {blocker && <Alert severity="warning" sx={{ mt: 2 }}>ErSv1.RunReader is refused for this reader: {blocker}.</Alert>}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
            <Box sx={{ flex: 1, minWidth: 300 }}><KeyValueEditor label="APIOpts" rows={apiOpts} onChange={setApiOpts} /></Box>
          </Box>
          <Button variant="contained" onClick={handleRun} disabled={running || !!blocker || !ersEnabled} sx={{ mt: 2 }}>{running ? <CircularProgress size={20} /> : 'Run Reader'}</Button>
          {runResult && <Paper variant="outlined" sx={{ p: 1, mt: 2 }}><pre style={{ fontSize: 12, margin: 0 }}>{runResult}</pre></Paper>}
        </DialogContent><DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
