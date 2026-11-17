import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TableSortLabel, TextField, Checkbox, FormControlLabel, ToggleButton, ToggleButtonGroup, Chip, IconButton, Tooltip, Menu, MenuItem, Tabs, Tab, ListItemText, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useStatQueueProfileIDs, useThresholdProfileIDs } from '../hooks';
import * as api from '../api';
import type { Session } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import ConfirmDialog, { useConfirm } from '../components/ConfirmDialog';
import { formatBalanceValue } from '../components/BalanceValue';
import { formatDateTime, formatRelative } from '../formatTime';

/** "95 MB" / "1.7 GB": whole numbers from 10 up, one decimal below. */
function formatUsage(raw: number, tor: string): string {
  if (raw === 0) return tor === '*data' ? '0 B' : tor === '*voice' ? '0 sec' : '0';
  const m = /^(-?[\d.]+) (.+)$/.exec(formatBalanceValue(raw, tor));
  if (!m) return String(raw);
  const n = Number(m[1]);
  return `${Math.abs(n) >= 10 ? Math.round(n) : Number(n.toFixed(1))} ${m[2]}`;
}

function rawUsage(raw: number, tor: string): string {
  return `${raw} ${tor === '*data' ? 'bytes' : tor === '*voice' ? 'ns' : ''}`.trim();
}

const HIDDEN_COLS_KEY = 'cgrates_ui_sessions_hidden_columns';
const DEFAULT_HIDDEN = ['RunID', 'DurationIndex'];

function loadHidden(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_COLS_KEY) || 'null');
    return Array.isArray(v) ? v : DEFAULT_HIDDEN;
  } catch { return DEFAULT_HIDDEN; }
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
  const [sortKey, setSortKey] = useState<SortKey>('SetupTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hidden, setHidden] = useState<string[]>(loadHidden);
  const [colAnchor, setColAnchor] = useState<HTMLElement | null>(null);
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; s: Session } | null>(null);
  const [bulkAll, setBulkAll] = useState<{ count: number | null; error: string | null; typed: string; busy: boolean } | null>(null);
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
    title: `Disconnect ${s.Account}`,
    confirmLabel: 'Disconnect session',
    body: (
      <Typography variant="body2" component="div">
        Sends SessionSv1.ForceDisconnect for {s.Account} ({s.OriginID}). SessionS terminates the session, charges it and
        asks the agent to hang up / release it.
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(sessionFilters(s), null, 2)}</pre>
      </Typography>
    ),
    run: async () => { const r = await api.forceDisconnect(baseUrl!, tenant, sessionFilters(s)); fetchSessions(); return r; },
  });

  const confirmTransit = (ids: string[]) => {
    const activate = passive;
    const what = `${ids.length} selected session(s)`;
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

  // Empty IDs makes SessionS transit every session on the node, ignoring tenant and filters, so count them unfiltered.
  const openBulkAll = async () => {
    setAdminAnchor(null);
    setBulkAll({ count: null, error: null, typed: '', busy: false });
    try {
      const r = await (passive ? api.getPassiveSessions : api.getActiveSessions)(baseUrl!, tenant, [], null) as Session[];
      setBulkAll(b => b && { ...b, count: new Set((r || []).map(x => x.CGRID)).size });
    } catch (e: unknown) {
      const msg = errText(e);
      setBulkAll(b => b && (msg === 'NOT_FOUND' ? { ...b, count: 0 } : { ...b, error: msg }));
    }
  };

  const runBulkAll = async () => {
    setBulkAll(b => b && { ...b, busy: true });
    try {
      await (passive ? api.activateSessions : api.deactivateSessions)(baseUrl!, tenant, []);
      setBulkAll(null);
      fetchSessions();
    } catch (e: unknown) {
      setBulkAll(b => b && { ...b, busy: false, error: errText(e) });
    }
  };

  const toggleColumn = (key: string) => setHidden(prev => {
    const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    try { localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience only */ }
    return next;
  });

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
      setSortDir(key === 'SetupTime' ? 'desc' : 'asc');
    }
  };

  const sortedSessions = useMemo(() => {
    if (!sortKey) return sessions;
    return [...sessions].sort((a, b) => {
      const val = (x: Session) => sortKey === 'SetupTime' || sortKey === 'AnswerTime' ? Date.parse(x[sortKey]) : x[sortKey as keyof Session];
      const av = val(a);
      const bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sessions, sortKey, sortDir]);

  // Tenant is left out: the page always queries exactly one tenant (shown in the selector and in Session details).
  const columns: { key: keyof Session; label: string; help?: string; render: (s: Session) => ReactNode }[] = [
    { key: 'RunID', label: 'RunID', help: 'ChargerS run this row belongs to', render: s => s.RunID },
    { key: 'Account', label: 'Account', render: s => s.Account },
    { key: 'Category', label: 'Category', render: s => s.Category },
    { key: 'Subject', label: 'Subject', render: s => s.Subject },
    { key: 'Destination', label: 'Destination', render: s => s.Destination },
    {
      key: 'Usage', label: 'Charged usage',
      help: 'Usage charged so far, including the units granted in the latest reservation (SRun TotalUsage). CGrateS does not report used units separately while the session is open.',
      render: s => <span title={rawUsage(s.Usage, s.ToR)}>{formatUsage(s.Usage, s.ToR)}</span>,
    },
    {
      key: 'DurationIndex', label: 'Rated usage', help: 'DurationIndex: usage rated so far, rounded up to the rating increments',
      render: s => <span title={rawUsage(s.DurationIndex, s.ToR)}>{formatUsage(s.DurationIndex, s.ToR)}</span>,
    },
    {
      key: 'SetupTime', label: 'Setup time',
      render: s => (
        <Tooltip title={s.SetupTime}>
          <span>{formatDateTime(s.SetupTime)}<br /><Typography variant="caption" color="text.secondary">{formatRelative(s.SetupTime)}</Typography></span>
        </Tooltip>
      ),
    },
    { key: 'LoopIndex', label: 'Debit rounds', help: 'LoopIndex: how many debit rounds (initial + updates) SessionS has run for this session', render: s => s.LoopIndex },
  ];
  const visibleColumns = columns.filter(c => !hidden.includes(c.key));
  const bulkVerb = passive ? 'Activate' : 'Deactivate';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5">Sessions</Typography>
        <Button variant="outlined" size="small" endIcon={<ArrowDropDownIcon />} onClick={e => setAdminAnchor(e.currentTarget)}>Admin actions</Button>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={passive ? 'passive' : 'active'} onChange={(_e, v) => v && setPassive(v === 'passive')}>
          <ToggleButton value="active">Active{counts ? ` (${counts.active})` : ''}</ToggleButton>
          <ToggleButton value="passive">Passive{counts ? ` (${counts.passive})` : ''}</ToggleButton>
        </ToggleButtonGroup>
        <Menu anchorEl={adminAnchor} open={!!adminAnchor} onClose={() => setAdminAnchor(null)} slotProps={{ paper: { sx: { maxWidth: 420 } } }}>
          <MenuItem onClick={openBulkAll}>
            <ListItemText primary={`${bulkVerb} all ${passive ? 'passive' : 'active'} sessions…`}
              secondary={passive ? 'Resumes charging for every passive session on this node' : 'Stops charging every active session on this node'}
              slotProps={{ primary: { color: 'error' }, secondary: { sx: { whiteSpace: 'normal' } } }} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => adminAction('Sync sessions',
            'Runs SessionSv1.SyncSessions: asks the agents for their live sessions and terminates the ones they no longer have. Only safe when sessions channel_sync_interval is 0.',
            () => api.syncSessions(baseUrl!, tenant))}>
            <ListItemText primary="Sync sessions…" secondary="Terminate sessions the agents no longer have" slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }} />
          </MenuItem>
          <MenuItem onClick={() => adminAction('Backup active sessions',
            'Runs SessionSv1.BackupActiveSessions: stores every active session in DataDB and replies with how many were stored.',
            () => api.backupActiveSessions(baseUrl!))}>
            <ListItemText primary="Backup active sessions…" secondary="Store every active session in DataDB" slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }} />
          </MenuItem>
          <MenuItem onClick={() => { setAdminAnchor(null); setDprOpen(true); }}>
            <ListItemText primary="Disconnect peer (DPR)…" secondary="Ask the agents to send a Diameter DPR to a peer" slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setAdminAnchor(null); setStirOpen(true); }}>
            <ListItemText primary="STIR/SHAKEN tester…" secondary="Verify or sign an Identity header (read-only)" slotProps={{ secondary: { sx: { whiteSpace: 'normal' } } }} />
          </MenuItem>
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
          {bulkVerb} selected ({selected.size})
        </Button>
        {counts && <Chip size="small" label={`${counts.active} active / ${counts.passive} passive`} />}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" startIcon={<ViewColumnIcon />} onClick={e => setColAnchor(e.currentTarget)}>Columns</Button>
        <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
          {columns.map(c => (
            <MenuItem key={c.key} dense onClick={() => toggleColumn(c.key)}>
              <Checkbox size="small" checked={!hidden.includes(c.key)} sx={{ p: 0, mr: 1 }} />
              <ListItemText primary={c.label} />
            </MenuItem>
          ))}
        </Menu>
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
                {visibleColumns.map(c => (
                  <TableCell key={c.key}>
                    <Tooltip title={c.help || ''} describeChild>
                      <TableSortLabel active={sortKey === c.key} direction={sortKey === c.key ? sortDir : 'asc'} onClick={() => handleSort(c.key)}>{c.label}</TableSortLabel>
                    </Tooltip>
                  </TableCell>
                ))}
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
                  {visibleColumns.map(c => <TableCell key={c.key}>{c.render(s)}</TableCell>)}
                  {!passive && (
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      <IconButton size="small" aria-label="Session actions" onClick={e => setRowMenu({ anchor: e.currentTarget, s })}><MoreVertIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              )) : <TableRow><TableCell colSpan={visibleColumns.length + 3} align="center">No {passive ? 'passive' : 'active'} sessions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Menu anchorEl={rowMenu?.anchor} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        <MenuItem onClick={() => { const s = rowMenu!.s; setRowMenu(null); setDetail(s); setDetailOpen(true); }}>Details…</MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { const s = rowMenu!.s; setRowMenu(null); confirmForceDisconnect(s); }}>Disconnect session…</MenuItem>
      </Menu>
      <ConfirmDialog open={!!bulkAll} title={`${bulkVerb} all ${passive ? 'passive' : 'active'} sessions`}
        confirmLabel={bulkAll?.count != null ? `${bulkVerb} ${bulkAll.count} sessions` : bulkVerb} busy={bulkAll?.busy}
        confirmDisabled={!bulkAll || bulkAll.count == null || bulkAll.count === 0 || bulkAll.typed.trim() !== String(bulkAll.count)}
        onConfirm={runBulkAll} onClose={() => setBulkAll(null)}>
        {bulkAll?.count == null && !bulkAll?.error ? <CircularProgress size={24} /> : bulkAll?.count != null && (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Sends SessionSv1.{bulkVerb}Sessions with no IDs, which moves <strong>all {bulkAll.count}</strong> {passive ? 'passive' : 'active'} sessions
              on this node (every tenant, ignoring the filters above) to {passive ? 'active: debit loops and timers start on this node' : 'passive: debit loops stop and no subscriber is charged here'}.
            </Typography>
            {bulkAll.count > 0 && (
              <TextField size="small" fullWidth autoFocus label={`Type ${bulkAll.count} to confirm`} value={bulkAll.typed}
                onChange={e => setBulkAll(b => b && { ...b, typed: e.target.value })} />
            )}
          </>
        )}
        {bulkAll?.error && <Alert severity="error" sx={{ mt: 2 }}>{bulkAll.error}</Alert>}
      </ConfirmDialog>
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
                      <TableCell>{k === 'Usage' || k === 'DurationIndex' ? `${formatUsage(v as number, detail.ToR)} (${rawUsage(v as number, detail.ToR)})` : (typeof v === 'object' ? JSON.stringify(v) : String(v))}</TableCell>
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
