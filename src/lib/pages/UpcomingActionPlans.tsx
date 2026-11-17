import { useState, useCallback, useEffect, useMemo, type MouseEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, Chip, TablePagination, Popover, List, ListItemButton, ListItemText,
  ToggleButton, ToggleButtonGroup, Collapse,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ActionPlan, ScheduledAction } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { CompositeId, IdWithLabel } from '../components/ParsedId';
import { useConfirm } from '../components/ConfirmDialog';
import { formatDateTime, formatRelative } from '../formatTime';

const DAY_MS = 86400000;

const bare = (accId: string) => accId.slice(accId.indexOf(':') + 1);
const accountLink = (accId: string) => `../accounts?q=${encodeURIComponent(bare(accId))}`;

function RunTime({ value }: { value: string }) {
  const overdue = new Date(value).getTime() < Date.now();
  return (
    <span title={formatDateTime(value)}>
      {formatDateTime(value)}
      <Typography variant="caption" color={overdue ? 'warning.main' : 'text.secondary'} display="block">{formatRelative(value)}</Typography>
    </span>
  );
}

function Accounts({ count, ids }: { count: number; ids?: string[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (count === 0) return <Typography variant="body2" color="warning.main">None</Typography>;
  if (!ids?.length) return <Typography variant="body2" color="text.secondary">{count} account{count === 1 ? '' : 's'}</Typography>;
  if (ids.length === 1) {
    return (
      <Chip size="small" variant="outlined" label={bare(ids[0])} title={ids[0]} clickable component={RouterLink} to={accountLink(ids[0])}
        onClick={(e: MouseEvent) => e.stopPropagation()} />
    );
  }
  return (
    <>
      <Chip size="small" variant="outlined" label={`${ids.length} accounts`} clickable
        onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }} />
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} onClick={e => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <List dense sx={{ maxHeight: 320, overflow: 'auto', minWidth: 240 }}>
          {ids.map(a => (
            <ListItemButton key={a} component={RouterLink} to={accountLink(a)}>
              <ListItemText primary={a} slotProps={{ primary: { sx: { fontFamily: 'monospace', fontSize: 13 } } }} />
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [results, setResults] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<'all' | 'day'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScheduledAction | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  // GetScheduledActions only returns an account count; the IDs come from each plan's AccountIDs.
  const [planAccounts, setPlanAccounts] = useState<Record<string, string[]>>({});
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const fetchResults = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try {
      const now = new Date();
      const r = range === 'day'
        ? await api.getAllScheduledActions(baseUrl, now, new Date(now.getTime() + DAY_MS))
        : await api.getAllScheduledActions(baseUrl);
      setResults(r || []);
    } catch (e: unknown) {
      if (!api.isNotFound(e)) setError(e instanceof Error ? e.message : 'Failed');
      setResults([]);
    } finally {
      setPage(0);
      setLoaded(true);
      setLoading(false);
    }
  }, [baseUrl, range]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const pageRows = useMemo(() => results.slice(page * rowsPerPage, (page + 1) * rowsPerPage), [results, page, rowsPerPage]);

  useEffect(() => {
    if (!baseUrl) return;
    const missing = [...new Set(pageRows.filter(r => r.Accounts > 0).map(r => r.ActionPlanID))].filter(id => !(id in planAccounts));
    if (!missing.length) return;
    Promise.all(missing.map(id => api.getActionPlan(baseUrl, id)
      .then(r => [id, Object.keys((Array.isArray(r) ? r[0] : r as unknown as ActionPlan)?.AccountIDs || {})] as const)
      .catch(() => [id, []] as const)))
      .then(entries => setPlanAccounts(prev => {
        const next = { ...prev };
        for (const [id, accs] of entries) next[id] = [...accs];
        return next;
      }));
  }, [baseUrl, pageRows, planAccounts]);

  const handleDelete = useCallback((actionPlanId: string) => {
    if (!baseUrl) return;
    const n = planAccounts[actionPlanId]?.length;
    ask({
      title: 'Delete action plan',
      confirmLabel: 'Delete',
      body: <Typography>
        Delete <strong style={{ wordBreak: 'break-all' }}>{actionPlanId}</strong>? All of its timings stop
        {n ? ` and it is removed from ${n} account${n === 1 ? '' : 's'}` : ''}.
      </Typography>,
      run: async () => {
        await api.removeActionPlan(baseUrl, actionPlanId, tenant);
        setDetail(null);
        fetchResults();
        return `${actionPlanId} deleted`;
      },
    });
  }, [baseUrl, tenant, fetchResults, ask, planAccounts]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Upcoming Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <ToggleButtonGroup size="small" exclusive value={range} onChange={(_e, v) => v && setRange(v)}>
            <ToggleButton value="all">All scheduled</ToggleButton>
            <ToggleButton value="day">Next 24 h</ToggleButton>
          </ToggleButtonGroup>
          <Button startIcon={<RefreshIcon />} onClick={fetchResults} disabled={loading}>Refresh</Button>
          {loaded && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {results.length} scheduled run{results.length === 1 ? '' : 's'}{range === 'day' ? ' in the next 24 h' : ''}
            </Typography>
          )}
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {!detail && outcomeAlert}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Next run</TableCell>
                  <TableCell>Action Plan ID</TableCell>
                  <TableCell>Actions ID</TableCell>
                  <TableCell>Accounts</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.length > 0 ? pageRows.map(item => (
                  <TableRow key={item.ActionTimingUUID + item.ActionPlanID} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(item); setShowRaw(false); }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}><RunTime value={item.NextRunTime} /></TableCell>
                    <TableCell sx={{ maxWidth: 360 }}><IdWithLabel id={item.ActionPlanID} /></TableCell>
                    <TableCell sx={{ maxWidth: 260 }}><IdWithLabel id={item.ActionsID} /></TableCell>
                    <TableCell><Accounts count={item.Accounts} ids={planAccounts[item.ActionPlanID]} /></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={4} align="center">{loaded ? 'No upcoming action plans' : ''}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          {results.length > 0 && (
            <TablePagination
              component="div" count={results.length} page={page} rowsPerPage={rowsPerPage} rowsPerPageOptions={[25, 50, 100]}
              onPageChange={(_e, p) => setPage(p)} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          )}
        </Paper>
      )}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>Scheduled run</DialogTitle>
        <DialogContent>
          {outcomeAlert}
          {detail && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, columnGap: 2, rowGap: 1.5, alignItems: 'baseline', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">Next run</Typography>
              <RunTime value={detail.NextRunTime} />
              <Typography variant="body2" color="text.secondary">Action Plan ID</Typography>
              <CompositeId id={detail.ActionPlanID} />
              <Typography variant="body2" color="text.secondary">Actions ID</Typography>
              <CompositeId id={detail.ActionsID} />
              <Typography variant="body2" color="text.secondary">Action timing UUID</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{detail.ActionTimingUUID}</Typography>
              <Typography variant="body2" color="text.secondary">Accounts ({detail.Accounts})</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {detail.Accounts === 0
                  ? <Alert severity="warning" sx={{ py: 0 }}>No accounts on this plan, so this run does nothing.</Alert>
                  : (planAccounts[detail.ActionPlanID] ?? []).map(a => (
                    <Chip key={a} size="small" label={a} clickable component={RouterLink} to={accountLink(a)} />
                  ))}
              </Box>
            </Box>
          )}
          <Button size="small" sx={{ mt: 2 }} onClick={() => setShowRaw(v => !v)} startIcon={<ExpandMoreIcon sx={{ transform: showRaw ? 'rotate(180deg)' : 'none' }} />}>
            {showRaw ? 'Hide raw data' : 'Show raw data'}
          </Button>
          <Collapse in={showRaw}>
            <Paper sx={{ p: 1, mt: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'action.hover' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          </Collapse>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => detail && handleDelete(detail.ActionPlanID)} sx={{ mr: 'auto' }}>
            Delete action plan…
          </Button>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      {confirmDialog}
    </Box>
  );
}
