import { useState, useCallback, useMemo, useEffect, Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, TextField, IconButton, Divider, Autocomplete, Chip, Collapse,
  InputAdornment, TablePagination, FormControlLabel, Switch, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ActionPlan } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { CompositeId, IdWithLabel, compositeProductName, compositeTitle, parseCompositeId } from '../components/ParsedId';
import ConfirmDialog, { useConfirm } from '../components/ConfirmDialog';
import { ACTION_PLAN_TIME_KEYWORDS } from '../cgrConsts';
import {
  type TimingForm, emptyTiming, timingToForm, timingErrors, formToAttr, timeIgnoresDates, describeTiming,
} from '../actionPlanTiming';

const OTHER_GROUP = 'Other';

function derivedLabel(id: string): string | null {
  return id.includes('__') ? compositeTitle(parseCompositeId(id)) : null;
}

function bareAccount(accId: string): string {
  return accId.slice(accId.indexOf(':') + 1);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy ID'}>
      <IconButton size="small" onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
        <ContentCopyIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

function PlanRow({ id, onOpen, hideLabel }: { id: string; onOpen: (id: string) => void; hideLabel?: boolean }) {
  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(id)}>
      <TableCell sx={{ width: '100%', maxWidth: 0 }}><IdWithLabel id={id} hideLabel={hideLabel} /></TableCell>
      <TableCell sx={{ width: 48, px: 1 }} align="center"><ChevronRightIcon fontSize="small" color="action" /></TableCell>
    </TableRow>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActionPlan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState('');
  const [editTimings, setEditTimings] = useState<TimingForm[]>([emptyTiming()]);

  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [assignAccount, setAssignAccount] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [showRaw, setShowRaw] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  const [unassignAccount, setUnassignAccount] = useState('');
  const [unassigning, setUnassigning] = useState(false);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const [actionIds, setActionIds] = useState<string[]>([]);

  const fetchIds = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try { setIds(((await api.getActionPlanIDs(baseUrl, tenant)) || []).sort()); }
    catch (e: unknown) {
      if (!api.isNotFound(e)) setError(e instanceof Error ? e.message : 'Failed');
      setIds([]);
    }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const fetchAccounts = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    try {
      const r = await api.getAccounts(baseUrl, tenant, 0, 0) as { ID: string }[] | null;
      setAccountIds((r || []).map(a => a.ID.slice(a.ID.indexOf(':') + 1)).sort());
    } catch { setAccountIds([]); }
  }, [baseUrl, tenant]);

  const fetchActionIds = useCallback(async () => {
    if (!baseUrl) return;
    try { setActionIds(Object.keys(await api.getActions(baseUrl, tenant) || {}).sort()); }
    catch { setActionIds([]); }
  }, [baseUrl, tenant]);

  const loadPlan = useCallback(async (id: string) => {
    const r = await api.getActionPlan(baseUrl!, id);
    return (Array.isArray(r) ? r[0] : r) as ActionPlan;
  }, [baseUrl]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const plan = await loadPlan(id);
      setDetail(plan);
      setEditId(plan.Id);
      const timings = plan.ActionTimings || [];
      setEditTimings(timings.length ? timings.map(timingToForm) : [emptyTiming()]);
      setEditing(false);
      setShowRaw(false);
      setDetailOpen(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, loadPlan]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ids.filter(id => id.toLowerCase().includes(q) || (derivedLabel(id) ?? '').toLowerCase().includes(q)) : ids;
  }, [ids, search]);
  useEffect(() => setPage(0), [search, ids]);

  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const id of filtered) {
      const g = compositeProductName(id) ?? OTHER_GROUP;
      m.set(g, [...(m.get(g) ?? []), id]);
    }
    return [...m.entries()].sort(([a], [b]) => (a === OTHER_GROUP ? 1 : b === OTHER_GROUP ? -1 : a.localeCompare(b)));
  }, [filtered]);
  // Grouping only helps when some IDs carry a product name.
  const canGroup = groups.some(([g]) => g !== OTHER_GROUP);
  const toggleGroup = (g: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  const errors = editTimings.flatMap((t, i) => timingErrors(t).map(e => `Timing #${i + 1}: ${e}`));
  const planAccounts = Object.keys(detail?.AccountIDs || {});

  // SetActionPlan with Overwrite drops every account from the plan. SetActionPlanAccounts puts them back on the
  // plan without SetAccount's *asap task queueing; it does drop the account->plan index, hence the recompute.
  const handleSave = useCallback(async () => {
    if (!baseUrl || errors.length || !editId.trim()) return;
    setSaving(true); setError(null);
    try {
      const ActionPlan = editTimings.map(formToAttr);
      if (detail) {
        const accounts = Object.keys((await loadPlan(detail.Id)).AccountIDs || {});
        if (accounts.length) {
          await api.setActionPlanAccounts(baseUrl, { Id: detail.Id, ActionPlan, AccountIDs: accounts, Overwrite: true, ReloadScheduler: true });
          await api.computeAccountActionPlans(baseUrl, tenant);
        } else {
          await api.setActionPlan(baseUrl, { Id: detail.Id, ActionPlan, Overwrite: true, ReloadScheduler: true });
        }
      } else {
        await api.setActionPlan(baseUrl, { Id: editId.trim(), ActionPlan, Overwrite: false, ReloadScheduler: true });
      }
      setDetailOpen(false); fetchIds();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }, [baseUrl, editId, editTimings, errors.length, detail, tenant, loadPlan, fetchIds]);

  const handleDelete = useCallback((plan: ActionPlan) => {
    if (!baseUrl) return;
    const n = Object.keys(plan.AccountIDs || {}).length;
    ask({
      title: 'Delete action plan',
      confirmLabel: 'Delete',
      body: <Typography>
        Delete <strong style={{ wordBreak: 'break-all' }}>{plan.Id}</strong>?
        {n > 0 ? ` It is removed from the ${n} account${n === 1 ? '' : 's'} on it and its scheduled runs stop.` : ' No accounts are on it.'}
      </Typography>,
      run: async () => {
        await api.removeActionPlan(baseUrl, plan.Id, tenant);
        setDetailOpen(false);
        fetchIds();
        return `${plan.Id} deleted`;
      },
    });
  }, [baseUrl, tenant, fetchIds, ask]);

  const openUnassign = useCallback(() => {
    const accs = Object.keys(detail?.AccountIDs || {});
    setUnassignAccount(accs.length === 1 ? accs[0] : '');
    setUnassignOpen(true);
  }, [detail]);

  const handleUnassign = useCallback(async () => {
    if (!baseUrl || !detail || !unassignAccount) return;
    const i = unassignAccount.indexOf(':');
    setUnassigning(true);
    try {
      await api.removeAccountFromActionPlan(baseUrl, unassignAccount.slice(0, i), unassignAccount.slice(i + 1), detail.Id);
      setDetail(await loadPlan(detail.Id));
      setNotice(`${unassignAccount} unassigned from ${detail.Id}.`);
      setUnassignOpen(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setUnassignOpen(false); }
    finally { setUnassigning(false); }
  }, [baseUrl, detail, unassignAccount, loadPlan]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setEditId('');
    setEditTimings([emptyTiming()]);
    setEditing(true);
    setDetailOpen(true);
    fetchActionIds();
  }, [fetchActionIds]);

  const openAssign = useCallback((planId = '') => {
    setAssignPlanId(planId);
    setAssignAccount('');
    setAssignOpen(true);
    if (!accountIds.length) fetchAccounts();
  }, [accountIds.length, fetchAccounts]);

  const handleAssign = useCallback(async () => {
    if (!baseUrl || !assignAccount || !assignPlanId) return;
    setAssigning(true);
    try {
      await api.setAccount(baseUrl, {
        Tenant: tenant,
        Account: assignAccount,
        ActionPlanIDs: [assignPlanId],
        ReloadScheduler: true,
      });
      setNotice(`${assignPlanId} attached to ${assignAccount}.`);
      setAssignOpen(false);
      setError(null);
      if (detail?.Id === assignPlanId) setDetail(await loadPlan(assignPlanId));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to assign'); setAssignOpen(false); }
    finally { setAssigning(false); }
  }, [baseUrl, tenant, assignAccount, assignPlanId, detail, loadPlan]);

  const updateTiming = (index: number, field: keyof TimingForm, value: string) => {
    setEditTimings(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTiming = (index: number) => {
    setEditTimings(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
        <Button variant="contained" onClick={fetchIds}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        <Button variant="outlined" onClick={() => openAssign()} disabled={!ids.length}>Assign plan…</Button>
      </Box></Paper>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {!detailOpen && outcomeAlert}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <Paper>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search plan ID or name" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 280 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Typography variant="body2" color="text.secondary">
              {search.trim() ? `${filtered.length} of ${ids.length} plans` : `${ids.length} plan${ids.length === 1 ? '' : 's'}`}
            </Typography>
            {canGroup && (
              <FormControlLabel sx={{ ml: 'auto' }} control={<Switch size="small" checked={grouped} onChange={e => setGrouped(e.target.checked)} />} label="Group by product" />
            )}
          </Box>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableBody>
                {!filtered.length ? (
                  <TableRow><TableCell colSpan={2} align="center">{ids.length ? 'No action plans match' : 'No action plans found'}</TableCell></TableRow>
                ) : grouped && canGroup ? groups.map(([g, gids]) => {
                  const open = openGroups.has(g) || !!search.trim();
                  return (
                    <Fragment key={g}>
                      <TableRow hover sx={{ cursor: 'pointer', bgcolor: 'action.hover' }} onClick={() => toggleGroup(g)}>
                        <TableCell sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ExpandMoreIcon fontSize="small" sx={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, fontStyle: g === OTHER_GROUP ? 'italic' : undefined }}>{g}</Typography>
                            <Chip size="small" label={gids.length} />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: 48, px: 1 }} align="center" />
                      </TableRow>
                      {open && gids.map(id => <PlanRow key={id} id={id} onOpen={fetchDetail} hideLabel={g !== OTHER_GROUP} />)}
                    </Fragment>
                  );
                }) : filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(id => <PlanRow key={id} id={id} onOpen={fetchDetail} />)}
              </TableBody>
            </Table>
          </TableContainer>
          {!(grouped && canGroup) && filtered.length > 0 && (
            <TablePagination
              component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage} rowsPerPageOptions={[25, 50, 100]}
              onPageChange={(_e, p) => setPage(p)} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          )}
        </Paper>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {!detail ? 'Create Action Plan' : `${editing ? 'Edit ' : ''}${compositeProductName(detail.Id) ?? 'Action Plan'}`}
          {detail && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', pt: 0.5 }}>{detail.Id}</Typography>
              <CopyButton text={detail.Id} />
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          {detailOpen && outcomeAlert}
          {editing ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Action Plan ID" size="small" fullWidth value={editId} onChange={e => setEditId(e.target.value)} disabled={!!detail} />
              {detail && planAccounts.length > 0 && (
                <Alert severity="info">
                  {planAccounts.length} account{planAccounts.length === 1 ? '' : 's'} on this plan stay attached when you save.
                  Their *asap timings are not run again, and an *asap timing added here won't run for them.
                </Alert>
              )}
              <Divider />
              <Typography variant="subtitle2">Action Timings</Typography>
              {editTimings.map((timing, idx) => {
                const datesIgnored = timeIgnoresDates(timing.Time);
                const errs = timingErrors(timing);
                const fieldErr = (label: string) => errs.find(e => e.startsWith(`${label}:`));
                return (
                  <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold">Timing #{idx + 1}</Typography>
                      {editTimings.length > 1 && (
                        <IconButton size="small" color="error" onClick={() => removeTiming(idx)}><DeleteIcon fontSize="small" /></IconButton>
                      )}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                      <SearchableSelect label="ActionsID" value={timing.ActionsID} options={actionIds}
                        onChange={v => updateTiming(idx, 'ActionsID', v)} sx={{ gridColumn: '1 / -1' }} />
                      <Autocomplete<string, false, false, true>
                        freeSolo size="small" options={[...ACTION_PLAN_TIME_KEYWORDS, '00:00:00']}
                        value={timing.Time}
                        onInputChange={(_e, v) => updateTiming(idx, 'Time', v)}
                        renderInput={params => (
                          <TextField {...params} label="Time" error={!!fieldErr('Time')}
                            helperText={fieldErr('Time') ?? 'hh:mm:ss, *asap, +1h (once, after), *recurring+1h, or a keyword'} />
                        )}
                      />
                      <TextField label="Weight" size="small" type="number" value={timing.Weight}
                        onChange={e => updateTiming(idx, 'Weight', e.target.value)} error={!!fieldErr('Weight')} helperText={fieldErr('Weight')} />
                      {(['Years', 'Months', 'MonthDays', 'WeekDays'] as const).map(f => (
                        <TextField key={f} label={f} size="small" value={timing[f]} disabled={datesIgnored}
                          onChange={e => updateTiming(idx, f, e.target.value)}
                          error={!datesIgnored && !!fieldErr(f)}
                          helperText={datesIgnored ? `Ignored with ${timing.Time.trim()}` : fieldErr(f) ?? {
                            Years: '*any or e.g. 2027;2028', Months: '*any or 1-12, ;-separated',
                            MonthDays: '*any or 1-31, ;-separated', WeekDays: '*any or 0-7 (0 and 7 are Sunday)',
                          }[f]} />
                      ))}
                    </Box>
                  </Paper>
                );
              })}
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setEditTimings(prev => [...prev, emptyTiming()])}>Add Timing</Button>
            </Box>
          ) : detail && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2">Timings</Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead><TableRow><TableCell>Actions</TableCell><TableCell>Schedule</TableCell><TableCell>Weight</TableCell></TableRow></TableHead>
                <TableBody>
                  {(detail.ActionTimings || []).map(at => {
                    const f = timingToForm(at);
                    return (
                      <TableRow key={at.Uuid}>
                        <TableCell><CompositeId id={at.ActionsID} compact /></TableCell>
                        <TableCell>{describeTiming(f)}</TableCell>
                        <TableCell>{at.Weight}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">Accounts ({planAccounts.length})</Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => openAssign(detail.Id)}>Assign account…</Button>
                  {planAccounts.length > 0 && (
                    <Button size="small" color="error" onClick={openUnassign}>Unassign…</Button>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, mb: 2 }}>
                {planAccounts.length ? planAccounts.map(a => (
                  <Tooltip key={a} title="Open in Accounts">
                    <Chip size="small" label={a} clickable component={RouterLink} to={`../accounts?q=${encodeURIComponent(bareAccount(a))}`} />
                  </Tooltip>
                )) : <Typography variant="body2" color="text.secondary">None</Typography>}
              </Box>
              <Button size="small" onClick={() => setShowRaw(v => !v)} startIcon={<ExpandMoreIcon sx={{ transform: showRaw ? 'rotate(180deg)' : 'none' }} />}>
                {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
              </Button>
              <Collapse in={showRaw}>
                <Paper sx={{ p: 1, mt: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'action.hover' }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
                </Paper>
              </Collapse>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {editing && errors.length > 0 && (
            <Typography variant="caption" color="error" sx={{ mr: 'auto', pl: 2 }}>{errors[0]}</Typography>
          )}
          {detail && !editing && (
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(detail)} sx={{ mr: 'auto' }}>Delete…</Button>
          )}
          {editing
            ? <Button variant="contained" onClick={handleSave} disabled={saving || !editId.trim() || errors.length > 0}>Save</Button>
            : <Button onClick={() => { setEditing(true); fetchActionIds(); }}>Edit</Button>}
          <Box sx={{ width: 16 }} />
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={assigning ? undefined : () => setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign action plan to account</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <SearchableSelect label="Action Plan" value={assignPlanId} options={ids} onChange={setAssignPlanId} fullWidth maxOptions={200}
              groupBy={canGroup ? (id => compositeProductName(id) ?? OTHER_GROUP) : undefined} />
            <SearchableSelect label="Account" value={assignAccount} options={accountIds} onChange={setAssignAccount} fullWidth maxOptions={200}
              placeholder={accountIds.length ? undefined : 'Loading accounts…'} />
            <Typography variant="caption" color="text.secondary">
              Calls SetAccount with this plan on tenant {tenant}. The plan's *asap timings run for the account straight away; the rest run on schedule.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)} disabled={assigning}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={assigning || !assignAccount || !assignPlanId}>
            {assigning ? <CircularProgress size={20} /> : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={unassignOpen} title="Unassign account" confirmLabel="Unassign" busy={unassigning}
        confirmDisabled={!unassignAccount} onConfirm={handleUnassign} onClose={() => setUnassignOpen(false)}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {planAccounts.length > 1 && (
            <SearchableSelect label="Account" value={unassignAccount} options={planAccounts} onChange={setUnassignAccount} fullWidth />
          )}
          <Typography>
            Remove {unassignAccount ? <strong>{unassignAccount}</strong> : 'the chosen account'} from <strong style={{ wordBreak: 'break-all' }}>{detail?.Id}</strong>?
            The plan's scheduled actions stop running for that account (RemoveActionTiming).
          </Typography>
        </Box>
      </ConfirmDialog>
      {confirmDialog}
    </Box>
  );
}
