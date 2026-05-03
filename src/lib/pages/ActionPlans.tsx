import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField, IconButton, Divider, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ActionTiming } from '../types';

interface ActionTimingForm {
  ActionsID: string;
  Years: string;
  Months: string;
  MonthDays: string;
  WeekDays: string;
  Time: string;
  Weight: string;
}

const emptyTiming = (): ActionTimingForm => ({
  ActionsID: '', Years: '*any', Months: '*any', MonthDays: '*any', WeekDays: '*any', Time: '*asap', Weight: '0',
});

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Structured edit form state
  const [editId, setEditId] = useState('');
  const [editTimings, setEditTimings] = useState<ActionTimingForm[]>([emptyTiming()]);

  // Assign to account state
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [assignAccount, setAssignAccount] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');

  // Available actions for dropdown
  const [actionIds, setActionIds] = useState<string[]>([]);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActionPlanIDs(baseUrl, tenant); setIds((r || []) as string[]); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setIds([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const fetchAccounts = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    try {
      const r = await api.getAccounts(baseUrl, tenant) as { ID: string }[] | null;
      if (r) {
        setAccountIds(r.map(a => {
          // Account ID format is "tenant:account", extract account part
          const parts = a.ID.split(':');
          return parts.length > 1 ? parts[1] : a.ID;
        }));
      }
    } catch { /* ignore */ }
  }, [baseUrl, tenant]);

  const fetchActionIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    try {
      const r = await api.getActions(baseUrl, tenant) as Record<string, unknown> | null;
      if (r) setActionIds(Object.keys(r));
    } catch { /* ignore */ }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const r = await api.getActionPlan(baseUrl, tenant, id);
      setDetail(r);
      // Populate structured form from response
      const plans = Array.isArray(r) ? r : [r];
      const plan = plans[0] as Record<string, unknown> | undefined;
      if (plan) {
        setEditId(String(plan.Id || ''));
        const timings = (plan.ActionTimings || []) as ActionTiming[];
        setEditTimings(timings.length > 0
          ? timings.map(t => ({
              ActionsID: String(t.ActionsID || ''),
              Years: String(t.Years || '*any'),
              Months: String(t.Months || '*any'),
              MonthDays: String(t.MonthDays || '*any'),
              WeekDays: String(t.WeekDays || '*any'),
              Time: String(t.Time || '*asap'),
              Weight: String(t.Weight ?? '0'),
            }))
          : [emptyTiming()]
        );
      }
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setActionPlan(baseUrl, {
        Id: editId,
        Tenant: tenant,
        Overwrite: true,
        ReloadScheduler: true,
        ActionPlan: editTimings.map(t => ({
          ActionsId: t.ActionsID,
          Years: t.Years || '*any',
          Months: t.Months || '*any',
          MonthDays: t.MonthDays || '*any',
          WeekDays: t.WeekDays || '*any',
          Time: t.Time || '*asap',
          Weight: t.Weight || '0',
        })),
      });
      setDetailOpen(false); fetchIds();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, editId, editTimings, tenant, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try { await api.removeActionPlan(baseUrl, id, tenant); fetchIds(); setDetailOpen(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setEditId('');
    setEditTimings([emptyTiming()]);
    setEditing(true);
    setDetailOpen(true);
    fetchActionIds();
  }, [fetchActionIds]);

  const handleEdit = useCallback(() => {
    setEditing(true);
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
      setAssignAccount('');
      setError(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to assign'); }
  }, [baseUrl, tenant, assignAccount, assignPlanId]);

  const updateTiming = (index: number, field: keyof ActionTimingForm, value: string) => {
    setEditTimings(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTiming = (index: number) => {
    setEditTimings(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" onClick={() => { fetchIds(); fetchAccounts(); }}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
      </Box></Paper>

      {/* Assign Action Plan to Account */}
      {ids.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Assign Action Plan to Account</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Action Plan</InputLabel>
              <Select value={assignPlanId} label="Action Plan" onChange={e => setAssignPlanId(e.target.value)}>
                {ids.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              sx={{ minWidth: 200 }}
              freeSolo
              options={accountIds}
              value={assignAccount}
              onInputChange={(_, v) => setAssignAccount(v)}
              renderInput={(params) => <TextField {...params} label="Account" />}
            />
            <Button variant="contained" color="secondary" onClick={handleAssign} disabled={!assignAccount || !assignPlanId}>Assign</Button>
          </Box>
        </Paper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Action Plan ID</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
          {ids.length > 0 ? ids.map((id, i) => (<TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}><TableCell>{i+1}</TableCell><TableCell>{id}</TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(id); }}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} align="center">No action plans found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (detail ? 'Edit Action Plan' : 'Create Action Plan') : 'Action Plan'}</DialogTitle>
        <DialogContent>
          {editing ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Action Plan ID" size="small" fullWidth value={editId} onChange={e => setEditId(e.target.value)} disabled={!!detail} />
              <Divider />
              <Typography variant="subtitle2">Action Timings</Typography>
              {editTimings.map((timing, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">Timing #{idx + 1}</Typography>
                    {editTimings.length > 1 && (
                      <IconButton size="small" color="error" onClick={() => removeTiming(idx)}><DeleteIcon fontSize="small" /></IconButton>
                    )}
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Autocomplete
                      size="small"
                      freeSolo
                      options={actionIds}
                      value={timing.ActionsID}
                      onInputChange={(_, v) => updateTiming(idx, 'ActionsID', v)}
                      renderInput={(params) => <TextField {...params} label="ActionsID" required />}
                      sx={{ gridColumn: '1 / -1' }}
                    />
                    <TextField label="Years" size="small" value={timing.Years} onChange={e => updateTiming(idx, 'Years', e.target.value)} helperText="*any, 2024, etc." />
                    <TextField label="Months" size="small" value={timing.Months} onChange={e => updateTiming(idx, 'Months', e.target.value)} helperText="*any, 1-12, etc." />
                    <TextField label="MonthDays" size="small" value={timing.MonthDays} onChange={e => updateTiming(idx, 'MonthDays', e.target.value)} helperText="*any, 1-31, etc." />
                    <TextField label="WeekDays" size="small" value={timing.WeekDays} onChange={e => updateTiming(idx, 'WeekDays', e.target.value)} helperText="*any, 1-7, etc." />
                    <TextField label="Time" size="small" value={timing.Time} onChange={e => updateTiming(idx, 'Time', e.target.value)} helperText="*asap, 00:00:00, etc." />
                    <TextField label="Weight" size="small" type="number" value={timing.Weight} onChange={e => updateTiming(idx, 'Weight', e.target.value)} />
                  </Box>
                </Paper>
              ))}
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setEditTimings(prev => [...prev, emptyTiming()])}>Add Timing</Button>
            </Box>
          ) : (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave} disabled={!editId}>Save</Button> : <Button onClick={handleEdit}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
