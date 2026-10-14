import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TableSortLabel, TextField, Checkbox, FormControlLabel } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useStatQueueProfileIDs, useThresholdProfileIDs } from '../hooks';
import * as api from '../api';
import type { Session } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';

function formatUsage(usage: number, tor: string): string {
  if (tor === '*data') {
    const mb = (usage / (1024 * 1024)).toFixed(2);
    return `${mb} MB (${usage} bytes)`;
  }
  if (tor === '*voice') {
    const s = Math.floor(usage / 1e9);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} (${usage} ns)`;
  }
  return String(usage);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type SortKey = keyof Session | '';

// sessions.go V1TerminateSessionArgs
const TERMINATE_BOOLS = ['TerminateSession', 'ForceDuration', 'ReleaseIP', 'ReleaseResources', 'ProcessThresholds', 'ProcessStats'] as const;
type TerminateBool = typeof TERMINATE_BOOLS[number];
type SortDir = 'asc' | 'desc';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [terminateLoading, setTerminateLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<string[]>([]);
  const [limit, setLimit] = useState('');
  const [termOpts, setTermOpts] = useState<Record<TerminateBool, boolean>>({
    TerminateSession: true, ForceDuration: false, ReleaseIP: false, ReleaseResources: false, ProcessThresholds: false, ProcessStats: false,
  });
  const [termThresholdIDs, setTermThresholdIDs] = useState<string[]>([]);
  const [termStatIDs, setTermStatIDs] = useState<string[]>([]);
  const [generateCdr, setGenerateCdr] = useState(true);
  const { data: thresholdIds } = useThresholdProfileIDs(tenant);
  const { data: statIds } = useStatQueueProfileIDs(tenant);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActiveSessions(baseUrl, tenant, filters, limit ? Number(limit) : null) as Session[]; setSessions(r || []); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      if (msg !== 'NOT_FOUND') setError(msg);
      setSessions([]);
    }
    finally { setLoading(false); }
  }, [baseUrl, tenant, filters, limit]);

  // Auto-refresh session detail when modal is open
  useEffect(() => {
    if (detailOpen && detail && baseUrl) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await api.getActiveSessions(baseUrl, detail.Tenant, [`*string:~*req.OriginID:${detail.OriginID}`]) as Session[];
          const updated = r?.find(s => s.CGRID === detail.CGRID && s.RunID === detail.RunID);
          if (updated) setDetail(updated);
        } catch { /* ignore */ }
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [detailOpen, detail, baseUrl]);

  const handleTerminate = useCallback(async () => {
    if (!baseUrl || !detail || !window.confirm(generateCdr ? 'Terminate this session and generate a CDR?' : 'Terminate this session?')) return;
    setTerminateLoading(true);
    // Event shared by TerminateSession and ProcessCDR so the CDR correlates to the session.
    const event = {
      Account: detail.Account,
      Category: detail.Category,
      Destination: detail.Destination,
      OriginHost: detail.OriginHost,
      OriginID: detail.OriginID,
      RequestType: detail.RequestType,
      SetupTime: detail.SetupTime,
      AnswerTime: detail.AnswerTime,
      Source: detail.Source,
      Subject: detail.Subject,
      Tenant: detail.Tenant,
      ToR: detail.ToR,
      Usage: detail.Usage,
    };
    try {
      await api.terminateSession(baseUrl, {
        ...termOpts,
        ThresholdIDs: termThresholdIDs,
        StatIDs: termStatIDs,
        Tenant: detail.Tenant,
        ID: detail.CGRID,
        Time: detail.SetupTime,
        Event: event,
        APIOpts: {},
      });
      // TerminateSession only finalizes charging; a CDR must be generated separately.
      if (generateCdr) {
        await api.processCDR(baseUrl, {
          Tenant: detail.Tenant,
          Event: event,
          APIOpts: {},
        });
      }
      setDetailOpen(false);
      fetchSessions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setTerminateLoading(false);
    }
  }, [baseUrl, detail, fetchSessions, termOpts, termThresholdIDs, termStatIDs, generateCdr]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedSessions = useMemo(() => {
    if (!sortKey) return sessions;
    return [...sessions].sort((a, b) => {
      const av = a[sortKey as keyof Session];
      const bv = b[sortKey as keyof Session];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sessions, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: 'RunID', label: 'RunID' },
    { key: 'Account', label: 'Account' },
    { key: 'Category', label: 'Category' },
    { key: 'Subject', label: 'Subject' },
    { key: 'Destination', label: 'Destination' },
    { key: 'Usage', label: 'Usage' },
    { key: 'SetupTime', label: 'Setup Time' },
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Active Sessions</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
        <IdMultiSelect label="Filters" value={filters} options={[]} onChange={setFilters} fullWidth={false} sx={{ minWidth: 380, flex: 1 }}
          placeholder="*string:~*req.Account:1001" helperText="Filter IDs or inline filters; all must match" />
        <TextField size="small" label="Limit" type="number" value={limit} onChange={e => setLimit(e.target.value)} sx={{ width: 110 }}
          helperText="Empty: no limit" />
        <Button variant="contained" onClick={fetchSessions}>Search Active Sessions</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === 'Tenant'} direction={sortKey === 'Tenant' ? sortDir : 'asc'} onClick={() => handleSort('Tenant')}>Tenant</TableSortLabel>
                </TableCell>
                {columns.map(c => (
                  <TableCell key={c.key}>
                    <TableSortLabel active={sortKey === c.key} direction={sortKey === c.key ? sortDir : 'asc'} onClick={() => handleSort(c.key)}>{c.label}</TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>
                  <TableSortLabel active={sortKey === 'LoopIndex'} direction={sortKey === 'LoopIndex' ? sortDir : 'asc'} onClick={() => handleSort('LoopIndex')}>Loop</TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSessions.length > 0 ? sortedSessions.map((s, i) => (
                <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(s); setDetailOpen(true); }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.Tenant}</TableCell>
                  <TableCell>{s.RunID}</TableCell>
                  <TableCell>{s.Account}</TableCell>
                  <TableCell>{s.Category}</TableCell>
                  <TableCell>{s.Subject}</TableCell>
                  <TableCell>{s.Destination}</TableCell>
                  <TableCell>{formatUsage(s.Usage, s.ToR)}</TableCell>
                  <TableCell>{new Date(s.SetupTime).toLocaleString()}<br /><Typography variant="caption" color="text.secondary">{timeAgo(s.SetupTime)}</Typography></TableCell>
                  <TableCell>{s.LoopIndex}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={10} align="center">No active sessions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Session Details</DialogTitle>
        <DialogContent>
          {detail && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {Object.entries(detail).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell><strong>{k}</strong></TableCell>
                      <TableCell>{k === 'Usage' ? formatUsage(v as number, detail.ToR) : (typeof v === 'object' ? JSON.stringify(v) : String(v))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <Box sx={{ px: 3, pb: 1 }}>
          <Typography variant="subtitle2">Terminate options</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {TERMINATE_BOOLS.map(k => (
              <FormControlLabel key={k} sx={{ mr: 2 }} label={k}
                control={<Checkbox size="small" checked={termOpts[k]} onChange={e => setTermOpts(o => ({ ...o, [k]: e.target.checked }))} />} />
            ))}
            <FormControlLabel label="Generate CDR (SessionSv1.ProcessCDR)"
              control={<Checkbox size="small" checked={generateCdr} onChange={e => setGenerateCdr(e.target.checked)} />} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <IdMultiSelect label="ThresholdIDs" value={termThresholdIDs} options={thresholdIds || []} onChange={setTermThresholdIDs}
              fullWidth={false} sx={{ minWidth: 280 }} disabled={!termOpts.ProcessThresholds} />
            <IdMultiSelect label="StatIDs" value={termStatIDs} options={statIds || []} onChange={setTermStatIDs}
              fullWidth={false} sx={{ minWidth: 280 }} disabled={!termOpts.ProcessStats} />
          </Box>
        </Box>
        <DialogActions>
          <Button color="error" onClick={handleTerminate} disabled={terminateLoading}>
            {terminateLoading ? 'Terminating...' : 'Terminate Session'}
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
