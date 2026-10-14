import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TableSortLabel, TextField, Checkbox, FormControlLabel, ToggleButton, ToggleButtonGroup, Chip, IconButton, Tooltip, Menu, MenuItem, Tabs, Tab } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useStatQueueProfileIDs, useThresholdProfileIDs } from '../hooks';
import * as api from '../api';
import type { Session } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import { useConfirm } from '../components/ConfirmDialog';

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

// sessions.go V1TerminateSessionArgs
const TERMINATE_BOOLS = ['TerminateSession', 'ForceDuration', 'ReleaseIP', 'ReleaseResources', 'ProcessThresholds', 'ProcessStats'] as const;
type TerminateBool = typeof TERMINATE_BOOLS[number];

// Diameter Disconnect-Cause (RFC 6733 5.4.3)
const DISCONNECT_CAUSES = [
  { value: 0, label: '0 REBOOTING' },
  { value: 1, label: '1 BUSY' },
  { value: 2, label: '2 DO_NOT_WANT_TO_TALK_TO_YOU' },
];

/** Inline filters that match exactly one session (CGRID is derived from OriginID + OriginHost). */
function sessionFilters(s: Session): string[] {
  return [`*string:~*req.OriginID:${s.OriginID}`, `*string:~*req.OriginHost:${s.OriginHost}`];
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : 'Failed';
}

function StirTester({ open, onClose }: { open: boolean; onClose: () => void }) {
  const baseUrl = useOcsBaseUrl();
  const [tab, setTab] = useState(0);
  const [identity, setIdentity] = useState('');
  const [origTn, setOrigTn] = useState('');
  const [origUri, setOrigUri] = useState('');
  const [destTn, setDestTn] = useState('');
  const [destUri, setDestUri] = useState('');
  const [attest, setAttest] = useState<string[]>([]);
  const [maxDur, setMaxDur] = useState('');
  const [payloadAttest, setPayloadAttest] = useState('A');
  const [destTns, setDestTns] = useState<string[]>([]);
  const [destUris, setDestUris] = useState<string[]>([]);
  const [origId, setOrigId] = useState('');
  const [pubKey, setPubKey] = useState('');
  const [privKey, setPrivKey] = useState('');
  const [overwriteIat, setOverwriteIat] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!baseUrl) return;
    setBusy(true); setResult(null);
    try {
      // sessions/libsessions.go V1STIRAuthenticateArgs / V1STIRIdentityArgs
      const r = tab === 0
        ? await api.stirAuthenticate(baseUrl, {
          Attest: attest, Identity: identity, OriginatorTn: origTn, OriginatorURI: origUri,
          DestinationTn: destTn, DestinationURI: destUri, PayloadMaxDuration: maxDur, APIOpts: {},
        })
        : await api.stirIdentity(baseUrl, {
          Payload: {
            attest: payloadAttest, dest: { tn: destTns, uri: destUris }, iat: 0,
            orig: { tn: origTn, uri: origUri }, origid: origId,
          },
          PublicKeyPath: pubKey, PrivateKeyPath: privKey, OverwriteIAT: overwriteIat, APIOpts: {},
        });
      setResult({ ok: true, text: r });
    } catch (e: unknown) {
      setResult({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>STIR/SHAKEN tester</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_e, v) => { setTab(v); setResult(null); }} sx={{ mb: 2 }}>
          <Tab label="Authenticate (verify)" />
          <Tab label="Identity (sign)" />
        </Tabs>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tab === 0 ? (
            <>
              <TextField size="small" multiline minRows={3} label="Identity header" value={identity} onChange={e => setIdentity(e.target.value)} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField size="small" label="OriginatorTn" value={origTn} onChange={e => setOrigTn(e.target.value)} />
                <TextField size="small" label="OriginatorURI" value={origUri} onChange={e => setOrigUri(e.target.value)} helperText="Overrides OriginatorTn" />
                <TextField size="small" label="DestinationTn" value={destTn} onChange={e => setDestTn(e.target.value)} />
                <TextField size="small" label="DestinationURI" value={destUri} onChange={e => setDestUri(e.target.value)} helperText="Overrides DestinationTn" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <IdMultiSelect label="Allowed attest" value={attest} options={['A', 'B', 'C', '*any']} onChange={setAttest}
                  fullWidth={false} sx={{ minWidth: 220 }} helperText="Empty: sessions stir allowed_attest" />
                <TextField size="small" label="PayloadMaxDuration" value={maxDur} onChange={e => setMaxDur(e.target.value)}
                  helperText="e.g. 60s; empty: stir payload_maxduration" />
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField select size="small" label="attest" value={payloadAttest} onChange={e => setPayloadAttest(e.target.value)} sx={{ width: 120 }}>
                  {['A', 'B', 'C'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </TextField>
                <TextField size="small" label="orig tn" value={origTn} onChange={e => setOrigTn(e.target.value)} />
                <TextField size="small" label="orig uri" value={origUri} onChange={e => setOrigUri(e.target.value)} />
                <TextField size="small" label="origid" value={origId} onChange={e => setOrigId(e.target.value)} />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <IdMultiSelect label="dest tn" value={destTns} options={[]} onChange={setDestTns} fullWidth={false} sx={{ minWidth: 260 }} />
                <IdMultiSelect label="dest uri" value={destUris} options={[]} onChange={setDestUris} fullWidth={false} sx={{ minWidth: 260 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField size="small" label="PublicKeyPath" value={pubKey} onChange={e => setPubKey(e.target.value)} helperText="Empty: sessions stir public_key_path" />
                <TextField size="small" label="PrivateKeyPath" value={privKey} onChange={e => setPrivKey(e.target.value)} helperText="Empty: sessions stir private_key_path" />
                <FormControlLabel control={<Checkbox checked={overwriteIat} onChange={e => setOverwriteIat(e.target.checked)} />} label="OverwriteIAT (iat = now)" />
              </Box>
            </>
          )}
        </Box>
        {result && (
          <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 2, wordBreak: 'break-all' }}>{result.text}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={run} disabled={busy}>
          {busy ? <CircularProgress size={20} /> : tab === 0 ? 'STIRAuthenticate' : 'STIRIdentity'}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
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
  const [passive, setPassive] = useState(false);
  const [counts, setCounts] = useState<{ active: number; passive: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adminAnchor, setAdminAnchor] = useState<HTMLElement | null>(null);
  const [dprOpen, setDprOpen] = useState(false);
  const [dpr, setDpr] = useState({ OriginHost: '', OriginRealm: '', RemoteAddr: '', DisconnectCause: 0 });
  const [stirOpen, setStirOpen] = useState(false);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();
  const { data: thresholdIds } = useThresholdProfileIDs(tenant);
  const { data: statIds } = useStatQueueProfileIDs(tenant);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null); setSelected(new Set());
    const get = passive ? api.getPassiveSessions : api.getActiveSessions;
    Promise.all([api.getActiveSessionsCount(baseUrl, tenant, filters), api.getPassiveSessionsCount(baseUrl, tenant, filters)])
      .then(([a, p]) => setCounts({ active: a, passive: p }))
      .catch(() => setCounts(null));
    try { const r = await get(baseUrl, tenant, filters, limit ? Number(limit) : null) as Session[]; setSessions(r || []); }
    catch (e: unknown) {
      const msg = errText(e);
      if (msg !== 'NOT_FOUND') setError(msg);
      setSessions([]);
    }
    finally { setLoading(false); }
  }, [baseUrl, tenant, filters, limit, passive]);

  useEffect(() => { setSessions([]); setSelected(new Set()); }, [passive]);

  const confirmForceDisconnect = (s: Session) => ask({
    title: 'Force disconnect',
    confirmLabel: 'Force disconnect',
    body: (
      <Typography variant="body2" component="div">
        Sends SessionSv1.ForceDisconnect for {s.Account} ({s.OriginID}). SessionS terminates the session, charges it and
        asks the agent to hang up / release it.
        <pre style={{ fontSize: 12 }}>{JSON.stringify(sessionFilters(s), null, 2)}</pre>
      </Typography>
    ),
    run: async () => { const r = await api.forceDisconnect(baseUrl!, tenant, sessionFilters(s)); fetchSessions(); return r; },
  });

  const confirmTransit = (ids: string[]) => {
    const activate = passive;
    const what = ids.length ? `${ids.length} selected session(s)` : `every ${activate ? 'passive' : 'active'} session on this node`;
    ask({
      title: activate ? 'Activate sessions' : 'Deactivate sessions',
      confirmLabel: activate ? 'Activate' : 'Deactivate',
      body: (
        <Typography variant="body2">
          {activate
            ? `Moves ${what} to active: debit loops and timers start on this node.`
            : `Moves ${what} to passive: debit loops stop and the sessions are no longer charged here.`}
        </Typography>
      ),
      run: async () => {
        const r = await (activate ? api.activateSessions : api.deactivateSessions)(baseUrl!, tenant, ids);
        fetchSessions();
        return r;
      },
    });
  };

  const adminAction = (title: string, body: string, run: () => Promise<unknown>) => {
    setAdminAnchor(null);
    ask({ title, confirmLabel: title, body: <Typography variant="body2">{body}</Typography>, run });
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Sessions</Typography>
        <ToggleButtonGroup size="small" exclusive value={passive ? 'passive' : 'active'} onChange={(_e, v) => v && setPassive(v === 'passive')}>
          <ToggleButton value="active">Active{counts ? ` (${counts.active})` : ''}</ToggleButton>
          <ToggleButton value="passive">Passive{counts ? ` (${counts.passive})` : ''}</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" endIcon={<MoreVertIcon />} onClick={e => setAdminAnchor(e.currentTarget)}>Admin</Button>
        <Menu anchorEl={adminAnchor} open={!!adminAnchor} onClose={() => setAdminAnchor(null)}>
          <MenuItem onClick={() => adminAction('Sync sessions',
            'Runs SessionSv1.SyncSessions: asks the agents for their live sessions and terminates the ones they no longer have. Only safe when sessions channel_sync_interval is 0.',
            () => api.syncSessions(baseUrl!, tenant))}>Sync sessions</MenuItem>
          <MenuItem onClick={() => adminAction('Backup active sessions',
            'Runs SessionSv1.BackupActiveSessions: stores every active session in DataDB and replies with how many were stored.',
            () => api.backupActiveSessions(baseUrl!))}>Backup active sessions</MenuItem>
          <MenuItem onClick={() => { setAdminAnchor(null); setDprOpen(true); }}>Disconnect peer (DPR)…</MenuItem>
          <MenuItem onClick={() => { setAdminAnchor(null); setStirOpen(true); }}>STIR/SHAKEN tester…</MenuItem>
        </Menu>
      </Box>
      {outcomeAlert}
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
        <IdMultiSelect label="Filters" value={filters} options={[]} onChange={setFilters} fullWidth={false} sx={{ minWidth: 380, flex: 1 }}
          placeholder="*string:~*req.Account:1001" helperText="Filter IDs or inline filters; all must match" />
        <TextField size="small" label="Limit" type="number" value={limit} onChange={e => setLimit(e.target.value)} sx={{ width: 110 }}
          helperText="Empty: no limit" />
        <Button variant="contained" onClick={fetchSessions}>Search {passive ? 'Passive' : 'Active'} Sessions</Button>
      </Box></Paper>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
        <Button size="small" variant="outlined" disabled={selected.size === 0} onClick={() => confirmTransit([...selected])}>
          {passive ? 'Activate' : 'Deactivate'} selected ({selected.size})
        </Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => confirmTransit([])}>
          {passive ? 'Activate' : 'Deactivate'} all
        </Button>
        {counts && <Chip size="small" label={`${counts.active} active / ${counts.passive} passive`} />}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small"
                    checked={sessions.length > 0 && selected.size === new Set(sessions.map(x => x.CGRID)).size}
                    indeterminate={selected.size > 0 && selected.size < new Set(sessions.map(x => x.CGRID)).size}
                    onChange={e => setSelected(e.target.checked ? new Set(sessions.map(x => x.CGRID)) : new Set())} />
                </TableCell>
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
                {!passive && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSessions.length > 0 ? sortedSessions.map((s, i) => (
                <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(s); setDetailOpen(true); }}>
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox size="small" checked={selected.has(s.CGRID)} onChange={e => setSelected(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.CGRID); else next.delete(s.CGRID);
                      return next;
                    })} />
                  </TableCell>
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
                  {!passive && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip title="Force disconnect">
                        <IconButton size="small" color="error" onClick={() => confirmForceDisconnect(s)}><PowerSettingsNewIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              )) : <TableRow><TableCell colSpan={12} align="center">No {passive ? 'passive' : 'active'} sessions</TableCell></TableRow>}
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
          <Button color="error" onClick={handleTerminate} disabled={terminateLoading || passive}>
            {terminateLoading ? 'Terminating...' : 'Terminate Session'}
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={dprOpen} onClose={() => setDprOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Disconnect peer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            SessionSv1.DisconnectPeer asks every connected agent to send a Diameter DPR to the peer matching these fields.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField size="small" label="OriginHost" value={dpr.OriginHost} onChange={e => setDpr(d => ({ ...d, OriginHost: e.target.value }))} />
            <TextField size="small" label="OriginRealm" value={dpr.OriginRealm} onChange={e => setDpr(d => ({ ...d, OriginRealm: e.target.value }))} />
            <TextField size="small" label="RemoteAddr" value={dpr.RemoteAddr} onChange={e => setDpr(d => ({ ...d, RemoteAddr: e.target.value }))} placeholder="host:port" />
            <TextField select size="small" label="DisconnectCause" value={dpr.DisconnectCause} onChange={e => setDpr(d => ({ ...d, DisconnectCause: Number(e.target.value) }))}>
              {DISCONNECT_CAUSES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDprOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!dpr.OriginHost && !dpr.RemoteAddr} onClick={() => {
            setDprOpen(false);
            ask({
              title: 'Disconnect peer',
              confirmLabel: 'Send DPR',
              body: <pre style={{ fontSize: 12 }}>{JSON.stringify(dpr, null, 2)}</pre>,
              run: () => api.disconnectPeer(baseUrl!, dpr),
            });
          }}>Disconnect…</Button>
        </DialogActions>
      </Dialog>
      <StirTester open={stirOpen} onClose={() => setStirOpen(false)} />
      {confirmDialog}
    </Box>
  );
}
