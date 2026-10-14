import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, FormControlLabel, Switch, Checkbox,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useConfig } from '../hooks';
import * as api from '../api';
import type { EventExporterConfig } from '../types';
import IdMultiSelect from '../components/IdMultiSelect';
import { toLocalInput } from '../components/ActivationIntervalInput';
import { TORS, REQUEST_TYPES } from '../cgrConsts';

const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 1 week', value: 10080 },
  { label: 'Past 1 month', value: 43200 },
];

// utils.RPCCDRsFilter string lists; each also has a Not<Name> exclusion list.
const LIST_FILTERS: { key: string; label: string; options?: string[] }[] = [
  { key: 'Tenants', label: 'Tenants' },
  { key: 'Accounts', label: 'Accounts' },
  { key: 'Subjects', label: 'Subjects' },
  { key: 'DestinationPrefixes', label: 'Destination prefixes' },
  { key: 'RunIDs', label: 'RunIDs', options: ['*default'] },
  { key: 'ToRs', label: 'ToRs', options: TORS },
  { key: 'RequestTypes', label: 'Request types', options: REQUEST_TYPES },
  { key: 'Categories', label: 'Categories' },
  { key: 'OriginIDs', label: 'OriginIDs' },
  { key: 'OriginHosts', label: 'OriginHosts' },
  { key: 'Sources', label: 'Sources' },
];

const TIME_RANGES = ['SetupTime', 'AnswerTime', 'CreatedAt', 'UpdatedAt'] as const;

// engine/storage_sql.go GetCDRs OrderBy; ";desc" reverses.
const ORDER_BY = ['OrderID', 'AnswerTime', 'SetupTime', 'Usage', 'Cost'];

const fromLocal = (v: string) => (v ? new Date(v).toISOString() : '');

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const { data: config } = useConfig();
  const exporters: EventExporterConfig[] = config?.ees?.exporters || [];
  const exporterIdOptions = exporters.map(e => e.id).filter(id => id !== '*default');
  const failedPostsDir: string = config?.ees?.failed_posts?.dir || '';

  // Exporter detail modal
  const [detail, setDetail] = useState<EventExporterConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Export CDRs form
  const [exportOpen, setExportOpen] = useState(false);
  const [exporterIds, setExporterIds] = useState<string[]>([]);
  const [lists, setLists] = useState<Record<string, string[]>>({ Tenants: defaultTenant ? [defaultTenant] : [] });
  const [times, setTimes] = useState<Record<string, string>>({});
  const [past, setPast] = useState('');
  const [minUsage, setMinUsage] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderDesc, setOrderDesc] = useState(false);
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
    setTimes(t => ({ ...t, SetupTimeStart: new Date(now.getTime() - minutes * 60000).toISOString(), SetupTimeEnd: now.toISOString() }));
  };

  const openExporter = (e: EventExporterConfig) => {
    setDetail(e);
    setDetailOpen(true);
  };

  const openExport = (ids: string[]) => {
    setExporterIds(ids);
    setExportResult(null);
    setExportOpen(true);
  };

  const handleExport = useCallback(async () => {
    if (!baseUrl) return;
    setExporting(true);
    setExportResult(null);
    try {
      const params: Record<string, unknown> = {
        ExporterIDs: exporterIds,
        Verbose: verbose,
      };
      for (const [k, v] of Object.entries(lists)) if (v.length) params[k] = v;
      for (const [k, v] of Object.entries(times)) if (v) params[k] = v;
      if (minUsage) params.MinUsage = minUsage;
      if (maxUsage) params.MaxUsage = maxUsage;
      if (orderBy) params.OrderBy = orderDesc ? `${orderBy};desc` : orderBy;
      const result = await api.exportCDRs(baseUrl, params);
      setExportResult(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      setExportResult(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [baseUrl, exporterIds, verbose, lists, times, minUsage, maxUsage, orderBy, orderDesc]);

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
        <Button variant="contained" sx={{ mr: 1 }} onClick={() => openExport([])}>Export CDRs</Button>
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

      {/* Exporter detail modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Exporter: {detail?.id}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 250, overflow: 'auto', bgcolor: 'background.default', mt: 1 }}>
            <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => { setDetailOpen(false); openExport(detail ? [detail.id] : []); }}>Export CDRs</Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export CDRs modal (APIerSv1.ExportCDRs) */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Export CDRs</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 1 }}>
            <IdMultiSelect label="Exporter IDs" value={exporterIds} options={exporterIdOptions} onChange={setExporterIds}
              fullWidth={false} sx={{ minWidth: 320, flex: 1 }} helperText="From the ees config section" />
            <FormControlLabel control={<Switch checked={verbose} onChange={e => setVerbose(e.target.checked)} />} label="Verbose" />
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Times</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Setup time preset</InputLabel>
              <Select value={past} label="Setup time preset" onChange={e => handlePastChange(e.target.value)}>
                <MenuItem value="">Custom</MenuItem>
                {pastOptions.map(o => <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            {TIME_RANGES.map(r => (['Start', 'End'] as const).map(edge => {
              const key = `${r}${edge}`;
              return (
                <TextField key={key} size="small" label={`${r} ${edge === 'Start' ? '>=' : '<'}`} type="datetime-local"
                  value={toLocalInput(times[key])}
                  onChange={e => { setTimes(t => ({ ...t, [key]: fromLocal(e.target.value) })); if (r === 'SetupTime') setPast(''); }}
                  slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 230 }} />
              );
            }))}
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Match (include / exclude)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            {LIST_FILTERS.map(f => (['', 'Not'] as const).map(prefix => {
              const key = `${prefix}${f.key}`;
              return (
                <IdMultiSelect key={key} label={prefix ? `Not ${f.label}` : f.label} value={lists[key] || []}
                  options={f.key === 'Tenants' ? tenants : f.options || []}
                  onChange={v => setLists(l => ({ ...l, [key]: v }))} />
              );
            }))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 2 }}>
            <TextField size="small" label="Min usage (>=)" value={minUsage} onChange={e => setMinUsage(e.target.value)} helperText="e.g. 1m, 10s, or nanoseconds" />
            <TextField size="small" label="Max usage (<)" value={maxUsage} onChange={e => setMaxUsage(e.target.value)} helperText="e.g. 1h" />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Order by</InputLabel>
              <Select value={orderBy} label="Order by" onChange={e => setOrderBy(e.target.value)}>
                <MenuItem value="">None</MenuItem>
                {ORDER_BY.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel control={<Checkbox checked={orderDesc} disabled={!orderBy} onChange={e => setOrderDesc(e.target.checked)} />} label="Descending" />
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
          <Button onClick={() => setExportOpen(false)}>Close</Button>
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
