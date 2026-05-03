import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TableSortLabel } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Session } from '../types';

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActiveSessions(baseUrl, tenant) as Session[]; setSessions(r || []); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setSessions([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  // Auto-refresh session detail when modal is open
  useEffect(() => {
    if (detailOpen && detail && baseUrl) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await api.getActiveSessions(baseUrl, detail.Tenant) as Session[];
          const updated = r?.find(s => s.CGRID === detail.CGRID);
          if (updated) setDetail(updated);
        } catch { /* ignore */ }
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [detailOpen, detail, baseUrl]);

  const handleTerminate = useCallback(async () => {
    if (!baseUrl || !detail || !window.confirm('Terminate this session?')) return;
    setTerminateLoading(true);
    try {
      await api.terminateSession(baseUrl, {
        TerminateSession: true,
        ForceDuration: false,
        ReleaseResources: false,
        ProcessThresholds: false,
        ProcessStats: false,
        Tenant: detail.Tenant,
        ID: detail.CGRID,
        Time: detail.SetupTime,
        Event: {
          Account: detail.Account,
          Category: detail.Category,
          Destination: detail.Destination,
          OriginHost: detail.OriginHost,
          OriginID: detail.OriginID,
          RequestType: detail.RequestType,
          SetupTime: detail.SetupTime,
          Source: detail.Source,
          Subject: detail.Subject,
          Tenant: detail.Tenant,
          ToR: detail.ToR,
        },
        Opts: {},
      });
      setDetailOpen(false);
      fetchSessions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setTerminateLoading(false);
    }
  }, [baseUrl, detail, fetchSessions]);

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
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
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
                  <TableCell>{s.Account}</TableCell>
                  <TableCell>{s.Category}</TableCell>
                  <TableCell>{s.Subject}</TableCell>
                  <TableCell>{s.Destination}</TableCell>
                  <TableCell>{formatUsage(s.Usage, s.ToR)}</TableCell>
                  <TableCell>{new Date(s.SetupTime).toLocaleString()}<br /><Typography variant="caption" color="text.secondary">{timeAgo(s.SetupTime)}</Typography></TableCell>
                  <TableCell>{s.LoopIndex}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={9} align="center">No active sessions</TableCell></TableRow>}
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
