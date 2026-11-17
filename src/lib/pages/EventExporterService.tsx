import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel, Switch, Checkbox, Alert, Chip,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useConfig } from '../hooks';
import * as api from '../api';
import type { EventExporterConfig } from '../types';
import IdMultiSelect from '../components/IdMultiSelect';
import SearchableSelect from '../components/SearchableSelect';
import KeyValueEditor, { rowsToObject, type KeyValueRow } from '../components/KeyValueEditor';
import ConfirmDialog, { useConfirm } from '../components/ConfirmDialog';
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

const sampleEventRows = (tenant: string): KeyValueRow[] => [
  { key: 'Tenant', value: tenant },
  { key: 'Account', value: '1001' },
  { key: 'Destination', value: '1002' },
  { key: 'ToR', value: '*voice' },
  { key: 'OriginID', value: 'cgrui-ee-test' },
  { key: 'Usage', value: '60000000000' },
  { key: 'Cost', value: '0.1' },
];

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const { data: config } = useConfig();
  const exporters: EventExporterConfig[] = config?.ees?.exporters || [];
  const exporterIdOptions = exporters.map(e => e.id).filter(id => id !== '*default');
  const failedPostsDir: string = config?.ees?.failed_posts?.dir || '';
  const eesOff = !!config && !config?.ees?.enabled;

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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [reviewCountErr, setReviewCountErr] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  // EeSv1.ProcessEvent test event
  const [testOpen, setTestOpen] = useState(false);
  const [testTenant, setTestTenant] = useState(defaultTenant);
  const [testEeIds, setTestEeIds] = useState<string[]>([]);
  const [testEvent, setTestEvent] = useState<KeyValueRow[]>(() => sampleEventRows(defaultTenant));
  const [testOpts, setTestOpts] = useState<KeyValueRow[]>([]);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

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

  const sendTestEvent = () => {
    const params = {
      EeIDs: testEeIds, Tenant: testTenant, ID: crypto.randomUUID(),
      Event: rowsToObject(testEvent), APIOpts: rowsToObject(testOpts),
    };
    ask({
      title: 'Send test event',
      confirmLabel: 'Send',
      body: (
        <Typography variant="body2" component="div">
          EeSv1.ProcessEvent exports this event for real
          ({testEeIds.length ? testEeIds.join(', ') : 'every exporter whose filters match'}).
          <pre style={{ fontSize: 12 }}>{JSON.stringify(params, null, 2)}</pre>
        </Typography>
      ),
      run: () => api.eeProcessEvent(baseUrl!, params),
    });
  };

  const confirmResetMetrics = (id: string) => ask({
    title: 'Reset exporter metrics',
    confirmLabel: 'Reset',
    body: <Typography variant="body2">Runs EeSv1.ResetExporterMetrics for {id}, zeroing its event counters.</Typography>,
    run: () => api.resetExporterMetrics(baseUrl!, defaultTenant, id),
  });

  const openExport = (ids: string[]) => {
    setExporterIds(ids);
    setExportResult(null);
    setExportOpen(true);
  };

  // utils.RPCCDRsFilter, shared by ExportCDRs and GetCDRsCount.
  const cdrFilter = useCallback(() => {
    const f: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(lists)) if (v.length) f[k] = v;
    for (const [k, v] of Object.entries(times)) if (v) f[k] = v;
    if (minUsage) f.MinUsage = minUsage;
    if (maxUsage) f.MaxUsage = maxUsage;
    return f;
  }, [lists, times, minUsage, maxUsage]);

  const openReview = async () => {
    if (!baseUrl) return;
    setTyped(''); setReviewCount(null); setReviewCountErr(null); setReviewOpen(true);
    try { setReviewCount(await api.getCDRsCount(baseUrl, cdrFilter())); }
    catch (e: unknown) { setReviewCountErr(e instanceof Error ? e.message : 'Count failed'); }
  };

  const exportTarget = exporterIds.length ? exporterIds.join(', ') : 'every exporter whose filters match';
  const confirmWord = reviewCount !== null ? String(reviewCount) : exporterIds.length ? exporterIds.join(',') : 'export';

  const handleExport = useCallback(async () => {
    if (!baseUrl) return;
    setReviewOpen(false);
    setExporting(true);
    setExportResult(null);
    try {
      const params: Record<string, unknown> = { ExporterIDs: exporterIds, Verbose: verbose, ...cdrFilter() };
      if (orderBy) params.OrderBy = orderDesc ? `${orderBy};desc` : orderBy;
      const result = await api.exportCDRs(baseUrl, params);
      setExportResult(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      setExportResult(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [baseUrl, exporterIds, verbose, cdrFilter, orderBy, orderDesc]);

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

  const [replayConfirm, setReplayConfirm] = useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Event Exporter</Typography>
        <Button variant="outlined" onClick={() => openExport([])}>Export CDRs…</Button>
        <Button variant="outlined" onClick={() => { setReplayResult(null); setReplayOpen(true); }}>Replay failed posts…</Button>
      </Box>

      {outcomeAlert}
      {eesOff && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Event export (EventExporterS) is not enabled on this OCS.
          <Typography variant="caption" component="div" color="text.secondary">ees.enabled is false in the running config; exports and test events will fail.</Typography>
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Exporters from the running config. CGrateS does not report per-exporter failure counts or how many failed posts are waiting on disk.
      </Typography>

      {exporters.length === 0 && <Typography variant="body2" color="text.secondary">No exporters found</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2 }}>
        {exporters.map((e, i) => {
          const placeholder = e.type === '*none';
          const row = (k: string, v: unknown) => (
            <Box key={k} sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>{k}</Typography>
              <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{v === undefined || v === '' ? '—' : String(v)}</Typography>
            </Box>
          );
          return (
            <Paper key={i} variant="outlined" sx={{ p: 2, ...(placeholder && { opacity: 0.55 }) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{e.id}</Typography>
                <Chip size="small" label={e.type || 'N/A'} />
                {placeholder && <Chip size="small" variant="outlined" label="placeholder, type *none" />}
              </Box>
              {row('Export path', e.export_path)}
              {row('Attempts', e.attempts)}
              {row('Synchronous', e.synchronous)}
              {row('Failed posts dir', e.failed_posts_dir)}
              {row('Pending failed posts', 'not reported by the API')}
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button size="small" onClick={() => openExporter(e)}>Details</Button>
                {!placeholder && <Button size="small" onClick={() => openExport([e.id])}>Export CDRs…</Button>}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Exporter detail modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Exporter: {detail?.id}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 250, overflow: 'auto', bgcolor: 'background.default', mt: 1 }}>
            <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDetailOpen(false); confirmResetMetrics(detail!.id); }}>Reset metrics</Button>
          <Button onClick={() => { setDetailOpen(false); setTestEeIds(detail ? [detail.id] : []); setTestOpen(true); }}>Send test event</Button>
          <Button variant="outlined" onClick={() => { setDetailOpen(false); openExport(detail ? [detail.id] : []); }}>Export CDRs…</Button>
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
          <Button onClick={() => setExportOpen(false)}>Close</Button>
          <Button variant="contained" color="error" onClick={openReview} disabled={exporting}>
            {exporting ? <CircularProgress size={20} /> : 'Review export…'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* EeSv1.ProcessEvent */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send test event</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 1, mb: 2 }}>
            <SearchableSelect label="Tenant" value={testTenant} options={tenants} onChange={setTestTenant} disableClearable sx={{ minWidth: 200 }} />
            <IdMultiSelect label="EeIDs" value={testEeIds} options={exporterIdOptions} onChange={setTestEeIds}
              fullWidth={false} sx={{ minWidth: 300, flex: 1 }} helperText="Empty: every exporter whose filters match" />
          </Box>
          <KeyValueEditor label="Event" rows={testEvent} onChange={setTestEvent} />
          <Box sx={{ mt: 2 }}>
            <KeyValueEditor label="APIOpts" rows={testOpts} onChange={setTestOpts} keyOptions={['*eesVerbose']} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => { setTestOpen(false); sendTestEvent(); }}>Send…</Button>
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
          <Button onClick={() => setReplayOpen(false)}>Close</Button>
          <Button variant="contained" color="error" onClick={() => setReplayConfirm(true)} disabled={replaying}>
            {replaying ? <CircularProgress size={20} /> : 'Replay…'}
          </Button>
        </DialogActions>
      </Dialog>
      {confirmDialog}

      <ConfirmDialog open={reviewOpen} title="Export CDRs for real?" confirmLabel="Export"
        confirmDisabled={reviewCount === 0 || typed.trim() !== confirmWord} onConfirm={handleExport} onClose={() => setReviewOpen(false)}>
        <Typography variant="body2" sx={{ mb: 1 }}>Sends the matching CDRs to <strong>{exportTarget}</strong> (APIerSv1.ExportCDRs).</Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Matching CDRs:{' '}
          {reviewCount !== null ? <strong>{reviewCount}</strong> : reviewCountErr ? <em>count unavailable ({reviewCountErr})</em> : <CircularProgress size={14} />}
        </Typography>
        <Paper variant="outlined" sx={{ p: 1, mb: 2, maxHeight: 200, overflow: 'auto' }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify({ ...cdrFilter(), ...(orderBy && { OrderBy: orderDesc ? `${orderBy};desc` : orderBy }) }, null, 2)}</pre>
        </Paper>
        {reviewCount === 0 && <Alert severity="info" sx={{ mb: 2 }}>No CDRs match these filters, so there is nothing to export.</Alert>}
        {Object.keys(cdrFilter()).length === 0 && <Alert severity="warning" sx={{ mb: 2 }}>No filters set: this exports every stored CDR.</Alert>}
        <TextField size="small" fullWidth autoFocus value={typed} onChange={e => setTyped(e.target.value)}
          label={reviewCount !== null ? `Type ${confirmWord} (the CDR count) to confirm` : reviewCountErr ? `Type ${confirmWord} to confirm` : 'Counting matching CDRs…'}
          disabled={reviewCount === null && !reviewCountErr} />
      </ConfirmDialog>

      <ConfirmDialog open={replayConfirm} title="Replay failed posts?" confirmLabel="Replay" busy={replaying}
        onConfirm={async () => { await handleReplay(); setReplayConfirm(false); }} onClose={() => setReplayConfirm(false)}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Re-sends every failed export found in <code>{sourcePath || failedPostsDir || 'the configured failed_posts dir'}</code>
          {modules ? ` for modules ${modules}` : ''}; ones that fail again go to <code>{failedPath || 'the same directory'}</code>.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          CGrateS has no API that lists or counts pending failed posts, so this can't say how many will be sent (possibly none).
        </Typography>
      </ConfirmDialog>
    </Box>
  );
}
