import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, FormControlLabel, Switch,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useConfig } from '../hooks';
import * as api from '../api';
import type { EventExporterConfig } from '../types';

const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 1 week', value: 10080 },
  { label: 'Past 1 month', value: 43200 },
];

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const { data: config } = useConfig();
  const exporters: EventExporterConfig[] = config?.ees?.exporters || [];
  const failedPostsDir: string = config?.ees?.failed_posts?.dir || '';

  // Exporter detail / export modal
  const [detail, setDetail] = useState<EventExporterConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Export CDRs form
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [subject, setSubject] = useState('');
  const [destination, setDestination] = useState('');
  const [past, setPast] = useState('');
  const [setupTimeStart, setSetupTimeStart] = useState('');
  const [setupTimeEnd, setSetupTimeEnd] = useState('');
  const [verbose, setVerbose] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  // Replay Failed Posts modal
  const [replayOpen, setReplayOpen] = useState(false);
  const [sourcePath, setSourcePath] = useState('');
  const [failedPath, setFailedPath] = useState('');
  const [modules, setModules] = useState('');
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<string | null>(null);

  const handlePastChange = (value: string) => {
    const minutes = parseInt(value);
    if (!minutes) { setPast(''); return; }
    setPast(value);
    const now = new Date();
    setSetupTimeStart(new Date(now.getTime() - minutes * 60000).toISOString());
    setSetupTimeEnd(now.toISOString());
  };

  const openExporter = (e: EventExporterConfig) => {
    setDetail(e);
    setExportResult(null);
    setDetailOpen(true);
  };

  const handleExport = useCallback(async () => {
    if (!baseUrl || !detail) return;
    setExporting(true);
    setExportResult(null);
    try {
      const params: Record<string, unknown> = {
        ExporterIDs: [detail.id],
        Verbose: verbose,
      };
      if (setupTimeStart) params.SetupTimeStart = setupTimeStart;
      if (setupTimeEnd) params.SetupTimeEnd = setupTimeEnd;
      if (tenant) params.Tenants = [tenant];
      if (account) params.Accounts = account.split(',').map(a => a.trim());
      if (subject) params.Subjects = subject.split(',').map(s => s.trim());
      if (destination) params.DestinationPrefixes = destination.split(',').map(d => d.trim());
      const result = await api.exportCDRs(baseUrl, params);
      setExportResult(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      setExportResult(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [baseUrl, detail, verbose, setupTimeStart, setupTimeEnd, tenant, account, subject, destination]);

  const handleReplay = useCallback(async () => {
    if (!baseUrl) return;
    setReplaying(true);
    setReplayResult(null);
    try {
      const params: Record<string, unknown> = {};
      if (sourcePath) params.SourcePath = sourcePath;
      if (failedPath) params.FailedPath = failedPath;
      if (modules) params.Modules = modules.split(',').map(m => m.trim()).filter(Boolean);
      const result = await api.replayFailedPosts(baseUrl, params);
      setReplayResult(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      setReplayResult(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setReplaying(false);
    }
  }, [baseUrl, sourcePath, failedPath, modules]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Event Exporter Service</Typography>
        <Button variant="outlined" onClick={() => { setReplayResult(null); setReplayOpen(true); }}>
          Replay Failed Posts
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configured exporters from the running CGrateS config. Select an exporter to export CDRs through it via APIerSv1.ExportCDRs.
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Export Path</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exporters.length > 0 ? exporters.map((e, i) => (
              <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => openExporter(e)}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{e.id}</TableCell>
                <TableCell>{e.type || 'N/A'}</TableCell>
                <TableCell>{e.export_path || 'N/A'}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={4} align="center">No exporters found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Exporter detail + export modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Exporter: {detail?.id}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 250, overflow: 'auto', bgcolor: 'background.default', mt: 1 }}>
            <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
          </Paper>

          <Typography variant="subtitle1" sx={{ mt: 2 }}>Export CDRs</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mt: 1 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Tenant</InputLabel>
              <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
                {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Time Range</InputLabel>
              <Select value={past} label="Time Range" onChange={e => handlePastChange(e.target.value)}>
                <MenuItem value="">Custom</MenuItem>
                {pastOptions.map(o => <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Start Time" type="datetime-local" value={setupTimeStart ? setupTimeStart.slice(0, 16) : ''} onChange={e => { setSetupTimeStart(e.target.value ? new Date(e.target.value).toISOString() : ''); setPast(''); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
            <TextField size="small" label="End Time" type="datetime-local" value={setupTimeEnd ? setupTimeEnd.slice(0, 16) : ''} onChange={e => { setSetupTimeEnd(e.target.value ? new Date(e.target.value).toISOString() : ''); setPast(''); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
            <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} placeholder="Comma-separated" />
            <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Comma-separated" />
            <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Prefix" />
            <FormControlLabel control={<Switch checked={verbose} onChange={e => setVerbose(e.target.checked)} />} label="Verbose" />
          </Box>

          {exportResult && (
            <Paper variant="outlined" sx={{ p: 1, mt: 2, bgcolor: 'background.default', maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="caption">Export Result:</Typography>
              <pre style={{ fontSize: 11, margin: 0 }}>{exportResult}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleExport} disabled={exporting}>
            {exporting ? <CircularProgress size={20} /> : 'Export CDRs'}
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Replay Failed Posts modal */}
      <Dialog open={replayOpen} onClose={() => setReplayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Replay Failed Posts</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Re-posts export requests that previously failed and were written to disk. Calls APIerSv1.ReplayFailedPosts.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField size="small" label="Source Path" value={sourcePath} onChange={e => setSourcePath(e.target.value)}
              placeholder={failedPostsDir || 'defaults to EEs failed_posts dir'} fullWidth
              helperText="Directory of failed events to replay. Empty uses the configured failed_posts dir." />
            <TextField size="small" label="Failed Path" value={failedPath} onChange={e => setFailedPath(e.target.value)}
              placeholder="defaults to Source Path" fullWidth
              helperText="Where events that fail again are written. Use *none to discard." />
            <TextField size="small" label="Modules" value={modules} onChange={e => setModules(e.target.value)}
              placeholder="Comma-separated, empty for all" fullWidth
              helperText="Limit replay to files for these modules (filename prefixes)." />
          </Box>
          {replayResult && (
            <Paper variant="outlined" sx={{ p: 1, mt: 2, bgcolor: 'background.default', maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="caption">Result:</Typography>
              <pre style={{ fontSize: 11, margin: 0 }}>{replayResult}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleReplay} disabled={replaying}>
            {replaying ? <CircularProgress size={20} /> : 'Replay'}
          </Button>
          <Button onClick={() => setReplayOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
