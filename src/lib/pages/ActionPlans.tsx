import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Alert, TextField, IconButton, Divider, Autocomplete, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ActionPlan } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { CompositeId } from '../components/ParsedId';
import { ACTION_PLAN_TIME_KEYWORDS } from '../cgrConsts';
import {
  type TimingForm, emptyTiming, timingToForm, timingErrors, formToAttr, timeIgnoresDates, describeTiming,
} from '../actionPlanTiming';

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
  const [notice, setNotice] = useState<string | null>(null);

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
      setDetailOpen(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, loadPlan]);

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

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete action plan ${id}? It is removed from every account on it.`)) return;
    try { await api.removeActionPlan(baseUrl, id, tenant); fetchIds(); setDetailOpen(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, tenant, fetchIds]);

  const handleRemoveAccount = useCallback(async (accId: string) => {
    if (!baseUrl || !detail) return;
    const i = accId.indexOf(':');
    if (!window.confirm(`Remove account ${accId} from ${detail.Id}?`)) return;
    try {
      await api.removeAccountFromActionPlan(baseUrl, accId.slice(0, i), accId.slice(i + 1), detail.Id);
      setDetail(await loadPlan(detail.Id));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, detail, loadPlan]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setEditId('');
    setEditTimings([emptyTiming()]);
    setEditing(true);
    setDetailOpen(true);
    fetchActionIds();
  }, [fetchActionIds]);

  const handleAssign = useCallback(async () => {
    if (!baseUrl || !assignAccount || !assignPlanId) return;
    try {
      await api.setAccount(baseUrl, {
        Tenant: tenant,
        Account: assignAccount,
        ActionPlanIDs: [assignPlanId],
        ReloadScheduler: true,
      });
      setNotice(`${assignPlanId} attached to ${assignAccount}.`);
      setAssignAccount('');
      setError(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to assign'); }
  }, [baseUrl, tenant, assignAccount, assignPlanId]);

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
        <Button variant="contained" onClick={() => { fetchIds(); fetchAccounts(); }}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
      </Box></Paper>

      {ids.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Assign Action Plan to Account</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <SearchableSelect label="Action Plan" value={assignPlanId} options={ids} onChange={setAssignPlanId} sx={{ minWidth: 200 }} />
            <SearchableSelect label="Account" value={assignAccount} options={accountIds} onChange={setAssignAccount} sx={{ minWidth: 200 }} />
            <Button variant="contained" color="secondary" onClick={handleAssign} disabled={!assignAccount || !assignPlanId}>Assign</Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            The plan's *asap timings run for the account straight away; the rest run on schedule.
          </Typography>
        </Paper>
      )}

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Action Plan ID</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
          {ids.length > 0 ? ids.map((id, i) => (<TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}><TableCell>{i + 1}</TableCell><TableCell><CompositeId id={id} compact /></TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(id); }}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} align="center">No action plans found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (detail ? `Edit Action Plan ${detail.Id}` : 'Create Action Plan') : `Action Plan ${detail?.Id ?? ''}`}</DialogTitle>
        <DialogContent>
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
              <Typography variant="subtitle2">Accounts ({planAccounts.length})</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1, mb: 2 }}>
                {planAccounts.length ? planAccounts.map(a => (
                  <Chip key={a} size="small" label={a} onDelete={() => handleRemoveAccount(a)} />
                )) : <Typography variant="body2" color="text.secondary">None</Typography>}
              </Box>
              <Typography variant="subtitle2">Raw JSON</Typography>
              <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'action.hover' }}>
                <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {editing && errors.length > 0 && (
            <Typography variant="caption" color="error" sx={{ mr: 'auto', pl: 2 }}>{errors[0]}</Typography>
          )}
          {editing
            ? <Button variant="contained" onClick={handleSave} disabled={saving || !editId.trim() || errors.length > 0}>Save</Button>
            : <Button onClick={() => { setEditing(true); fetchActionIds(); }}>Edit</Button>}
          {detail && !editing && <Button color="error" onClick={() => handleDelete(detail.Id)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
