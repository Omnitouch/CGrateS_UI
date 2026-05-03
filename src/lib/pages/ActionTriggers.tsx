import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField, Checkbox, FormControlLabel, Divider, Autocomplete } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

const THRESHOLD_TYPES = [
  '*min_counter', '*max_counter', '*min_balance', '*max_balance',
  '*min_asr', '*max_asr', '*min_acd', '*max_acd',
  '*min_acc', '*max_acc', '*min_tcc', '*max_tcc',
  '*min_tcd', '*max_tcd', '*min_pdd', '*max_pdd',
];

const BALANCE_TYPES = ['*monetary', '*voice', '*data', '*sms', '*generic'];

interface TriggerForm {
  ID: string;
  UniqueID: string;
  ThresholdType: string;
  ThresholdValue: number;
  Recurrent: boolean;
  MinSleep: string;
  ExpirationDate: string;
  ActivationDate: string;
  BalanceID: string;
  BalanceType: string;
  BalanceDestinationIds: string;
  BalanceRatingSubject: string;
  BalanceWeight: string;
  BalanceExpirationDate: string;
  BalanceTimingTags: string;
  BalanceSharedGroups: string;
  BalanceBlocker: boolean;
  BalanceDisabled: boolean;
  Weight: number;
  ActionsID: string;
  MinQueuedItems: number;
}

const emptyTrigger = (): TriggerForm => ({
  ID: '', UniqueID: '', ThresholdType: '*min_balance', ThresholdValue: 0,
  Recurrent: false, MinSleep: '0', ExpirationDate: '', ActivationDate: '',
  BalanceID: '', BalanceType: '*monetary', BalanceDestinationIds: '',
  BalanceRatingSubject: '', BalanceWeight: '', BalanceExpirationDate: '',
  BalanceTimingTags: '', BalanceSharedGroups: '', BalanceBlocker: false,
  BalanceDisabled: false, Weight: 10, ActionsID: '', MinQueuedItems: 0,
});

function triggerToForm(t: Record<string, unknown>): TriggerForm {
  const bal = (t.Balance || {}) as Record<string, unknown>;
  return {
    ID: String(t.ID || t.GroupID || ''),
    UniqueID: String(t.UniqueID || ''),
    ThresholdType: String(t.ThresholdType || '*min_balance'),
    ThresholdValue: Number(t.ThresholdValue || 0),
    Recurrent: Boolean(t.Recurrent),
    MinSleep: String(t.MinSleep ?? '0'),
    ExpirationDate: String(t.ExpirationDate || ''),
    ActivationDate: String(t.ActivationDate || ''),
    BalanceID: String(bal.ID || ''),
    BalanceType: String(bal.Type || t.BalanceType || '*monetary'),
    BalanceDestinationIds: bal.DestinationIDs ? (typeof bal.DestinationIDs === 'string' ? bal.DestinationIDs : Object.keys(bal.DestinationIDs as Record<string, boolean>).join(';')) : '',
    BalanceRatingSubject: String(bal.RatingSubject || ''),
    BalanceWeight: String(bal.Weight ?? ''),
    BalanceExpirationDate: String(bal.ExpirationDate || ''),
    BalanceTimingTags: bal.TimingIDs ? Object.keys(bal.TimingIDs as Record<string, boolean>).join(';') : '',
    BalanceSharedGroups: bal.SharedGroups ? Object.keys(bal.SharedGroups as Record<string, boolean>).join(';') : '',
    BalanceBlocker: Boolean(bal.Blocker),
    BalanceDisabled: Boolean(bal.Disabled),
    Weight: Number(t.Weight || 0),
    ActionsID: String(t.ActionsID || ''),
    MinQueuedItems: Number(t.MinQueuedItems || 0),
  };
}

function formToPayload(f: TriggerForm): Record<string, unknown> {
  const destIds: Record<string, boolean> = {};
  if (f.BalanceDestinationIds) f.BalanceDestinationIds.split(';').forEach(d => { if (d.trim()) destIds[d.trim()] = true; });
  const sharedGroups: Record<string, boolean> = {};
  if (f.BalanceSharedGroups) f.BalanceSharedGroups.split(';').forEach(g => { if (g.trim()) sharedGroups[g.trim()] = true; });
  const timingIds: Record<string, boolean> = {};
  if (f.BalanceTimingTags) f.BalanceTimingTags.split(';').forEach(t => { if (t.trim()) timingIds[t.trim()] = true; });

  return {
    ID: f.ID,
    UniqueID: f.UniqueID || undefined,
    ThresholdType: f.ThresholdType,
    ThresholdValue: f.ThresholdValue,
    Recurrent: f.Recurrent,
    MinSleep: f.MinSleep || '0',
    ExpirationDate: f.ExpirationDate || '*unlimited',
    ActivationDate: f.ActivationDate || '*unlimited',
    Balance: {
      ID: f.BalanceID || undefined,
      Type: f.BalanceType || '*monetary',
      DestinationIDs: Object.keys(destIds).length > 0 ? destIds : undefined,
      RatingSubject: f.BalanceRatingSubject || undefined,
      Weight: f.BalanceWeight ? Number(f.BalanceWeight) : undefined,
      ExpirationDate: f.BalanceExpirationDate || undefined,
      TimingIDs: Object.keys(timingIds).length > 0 ? timingIds : undefined,
      SharedGroups: Object.keys(sharedGroups).length > 0 ? sharedGroups : undefined,
      Blocker: f.BalanceBlocker || undefined,
      Disabled: f.BalanceDisabled || undefined,
    },
    Weight: f.Weight,
    ActionsID: f.ActionsID,
    MinQueuedItems: f.MinQueuedItems,
  };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [triggers, setTriggers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TriggerForm>(emptyTrigger());

  // Available actions for dropdown
  const [actionIds, setActionIds] = useState<string[]>([]);

  const fetchTriggers = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActionTriggers(baseUrl, tenant) as Record<string, unknown>[]; setTriggers(r || []); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setTriggers([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const fetchActionIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    try {
      const r = await api.getActions(baseUrl, tenant) as Record<string, unknown> | null;
      if (r) setActionIds(Object.keys(r));
    } catch { /* ignore */ }
  }, [baseUrl, tenant]);

  const handleRowClick = (trigger: Record<string, unknown>) => {
    setDetail(trigger);
    setForm(triggerToForm(trigger));
    setEditing(false);
    setDetailOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const payload = formToPayload(form);
      await api.setActionTrigger(baseUrl, {
        GroupID: form.ID,
        ActionTrigger: payload,
        Overwrite: true,
        Tenant: tenant,
      });
      setDetailOpen(false); fetchTriggers();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, form, tenant, fetchTriggers]);

  const handleDelete = useCallback(async () => {
    if (!baseUrl || !detail) return;
    const d = detail as Record<string, unknown>;
    const groupId = (d.ID || d.GroupID) as string;
    if (!window.confirm(`Delete trigger ${groupId}?`)) return;
    try { await api.removeActionTrigger(baseUrl, groupId, tenant); setDetailOpen(false); fetchTriggers(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, detail, tenant, fetchTriggers]);

  const handleEdit = useCallback(() => {
    setEditing(true);
    fetchActionIds();
  }, [fetchActionIds]);

  const updateForm = <K extends keyof TriggerForm>(field: K, value: TriggerForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Triggers</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" onClick={fetchTriggers}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setDetail(null); setForm(emptyTrigger()); setEditing(true); setDetailOpen(true); fetchActionIds(); }}>Add Trigger</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow>
          <TableCell>#</TableCell>
          <TableCell>ID</TableCell>
          <TableCell>Threshold Type</TableCell>
          <TableCell>Threshold Value</TableCell>
          <TableCell>Balance Type</TableCell>
          <TableCell>Actions ID</TableCell>
        </TableRow></TableHead><TableBody>
          {triggers.length > 0 ? triggers.map((t, i) => {
            const bal = (t.Balance || {}) as Record<string, unknown>;
            return (
              <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(t)}>
                <TableCell>{i+1}</TableCell>
                <TableCell>{String(t.ID || '')}</TableCell>
                <TableCell>{String(t.ThresholdType || '')}</TableCell>
                <TableCell>{String(t.ThresholdValue ?? '')}</TableCell>
                <TableCell>{String(bal.Type || t.BalanceType || '')}</TableCell>
                <TableCell>{String(t.ActionsID || '')}</TableCell>
              </TableRow>
            );
          }) : <TableRow><TableCell colSpan={6} align="center">No triggers found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (detail ? 'Edit Action Trigger' : 'Create Action Trigger') : 'Action Trigger'}</DialogTitle>
        <DialogContent>
          {editing ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Group ID" size="small" fullWidth value={form.ID} onChange={e => updateForm('ID', e.target.value)} disabled={!!detail} />
              <TextField label="Unique ID" size="small" fullWidth value={form.UniqueID} onChange={e => updateForm('UniqueID', e.target.value)} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Threshold Type</InputLabel>
                  <Select value={form.ThresholdType} label="Threshold Type" onChange={e => updateForm('ThresholdType', e.target.value)}>
                    {THRESHOLD_TYPES.map(tt => <MenuItem key={tt} value={tt}>{tt}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Threshold Value" size="small" type="number" value={form.ThresholdValue} onChange={e => updateForm('ThresholdValue', Number(e.target.value))} />
                <FormControl size="small" fullWidth>
                  <InputLabel>Balance Type</InputLabel>
                  <Select value={form.BalanceType} label="Balance Type" onChange={e => updateForm('BalanceType', e.target.value)}>
                    {BALANCE_TYPES.map(bt => <MenuItem key={bt} value={bt}>{bt}</MenuItem>)}
                  </Select>
                </FormControl>
                <Autocomplete
                  size="small"
                  freeSolo
                  options={actionIds}
                  value={form.ActionsID}
                  onInputChange={(_, v) => updateForm('ActionsID', v)}
                  renderInput={(params) => <TextField {...params} label="ActionsID" required />}
                />
              </Box>
              <FormControlLabel control={<Checkbox checked={form.Recurrent} onChange={e => updateForm('Recurrent', e.target.checked)} />} label="Recurrent" />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField label="MinSleep" size="small" value={form.MinSleep} onChange={e => updateForm('MinSleep', e.target.value)} helperText="e.g. 0, 1h, 24h" />
                <TextField label="Weight" size="small" type="number" value={form.Weight} onChange={e => updateForm('Weight', Number(e.target.value))} />
                <TextField label="Expiration Date" size="small" value={form.ExpirationDate} onChange={e => updateForm('ExpirationDate', e.target.value)} helperText="*unlimited or 2025-12-31T00:00:00Z" />
                <TextField label="Activation Date" size="small" value={form.ActivationDate} onChange={e => updateForm('ActivationDate', e.target.value)} helperText="*unlimited or 2025-01-01T00:00:00Z" />
                <TextField label="MinQueuedItems" size="small" type="number" value={form.MinQueuedItems} onChange={e => updateForm('MinQueuedItems', Number(e.target.value))} />
              </Box>

              <Divider />
              <Typography variant="subtitle2">Balance Parameters</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField label="Balance ID" size="small" value={form.BalanceID} onChange={e => updateForm('BalanceID', e.target.value)} />
                <TextField label="Balance Weight" size="small" value={form.BalanceWeight} onChange={e => updateForm('BalanceWeight', e.target.value)} />
                <TextField label="Destination IDs" size="small" value={form.BalanceDestinationIds} onChange={e => updateForm('BalanceDestinationIds', e.target.value)} helperText="Semicolon-separated" />
                <TextField label="Rating Subject" size="small" value={form.BalanceRatingSubject} onChange={e => updateForm('BalanceRatingSubject', e.target.value)} />
                <TextField label="Balance Expiration Date" size="small" value={form.BalanceExpirationDate} onChange={e => updateForm('BalanceExpirationDate', e.target.value)} />
                <TextField label="Timing Tags" size="small" value={form.BalanceTimingTags} onChange={e => updateForm('BalanceTimingTags', e.target.value)} helperText="Semicolon-separated" />
                <TextField label="Shared Groups" size="small" value={form.BalanceSharedGroups} onChange={e => updateForm('BalanceSharedGroups', e.target.value)} helperText="Semicolon-separated" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel control={<Checkbox checked={form.BalanceBlocker} onChange={e => updateForm('BalanceBlocker', e.target.checked)} />} label="Blocker" />
                <FormControlLabel control={<Checkbox checked={form.BalanceDisabled} onChange={e => updateForm('BalanceDisabled', e.target.checked)} />} label="Disabled" />
              </Box>
            </Box>
          ) : (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave} disabled={!form.ID}>Save</Button> : <Button onClick={handleEdit}>Edit</Button>}
          {detail ? <Button color="error" onClick={handleDelete}>Delete</Button> : null}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
