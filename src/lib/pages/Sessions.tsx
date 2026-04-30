import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Session } from '../types';


function formatUsage(usage: number, tor: string): string {
  if (tor === '*data') return `${(usage / (1024*1024)).toFixed(2)} MB`;
  if (tor === '*voice') { const s = Math.floor(usage / 1e9); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  return String(usage);
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Session | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActiveSessions(baseUrl, tenant) as Session[]; setSessions(r || []); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setSessions([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const handleTerminate = useCallback(async () => {
    if (!baseUrl || !detail || !window.confirm('Terminate this session?')) return;
    try { await api.terminateSession(baseUrl, { TerminateSession: true, Tenant: detail.Tenant, ID: detail.CGRID, Time: detail.SetupTime, Event: { Account: detail.Account, Category: detail.Category, Destination: detail.Destination, OriginHost: detail.OriginHost, OriginID: detail.OriginID, RequestType: detail.RequestType, SetupTime: detail.SetupTime, Source: detail.Source, Subject: detail.Subject, Tenant: detail.Tenant, ToR: detail.ToR }, Opts: {} }); setDetailOpen(false); fetchSessions(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, detail, fetchSessions]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Active Sessions</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" onClick={fetchSessions}>Search</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Account</TableCell><TableCell>Category</TableCell><TableCell>Destination</TableCell><TableCell>Usage</TableCell><TableCell>Setup Time</TableCell></TableRow></TableHead><TableBody>
          {sessions.length > 0 ? sessions.map((s, i) => (<TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(s); setDetailOpen(true); }}><TableCell>{i+1}</TableCell><TableCell>{s.Account}</TableCell><TableCell>{s.Category}</TableCell><TableCell>{s.Destination}</TableCell><TableCell>{formatUsage(s.Usage, s.ToR)}</TableCell><TableCell>{new Date(s.SetupTime).toLocaleString()}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={6} align="center">No active sessions</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Session Details</DialogTitle><DialogContent>
          {detail && <TableContainer><Table size="small"><TableBody>{Object.entries(detail).map(([k, v]) => <TableRow key={k}><TableCell><strong>{k}</strong></TableCell><TableCell>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
        </DialogContent><DialogActions>
          <Button color="error" onClick={handleTerminate}>Terminate Session</Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
