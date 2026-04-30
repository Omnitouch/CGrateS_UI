import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';


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
  const [editJson, setEditJson] = useState('');

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActionPlanIDs(baseUrl, tenant); setIds((r || []) as string[]); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setIds([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try { const r = await api.getActionPlan(baseUrl, tenant, id); setDetail(r); setEditJson(JSON.stringify(r, null, 2)); setEditing(false); setDetailOpen(true); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const parsed = JSON.parse(editJson);
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      const timings = payload.ActionTimings || [];
      await api.setActionPlan(baseUrl, { Id: payload.Id, Tenant: tenant, Overwrite: true, ReloadScheduler: true, ActionPlan: timings.map((t: Record<string, unknown>) => ({ ActionsId: t.ActionsID || '', Years: t.Years || '*any', Months: t.Months || '*any', MonthDays: t.MonthDays || '*any', WeekDays: t.WeekDays || '*any', Time: t.Time || '*asap', Weight: t.Weight || '0' })) });
      setDetailOpen(false); fetchIds();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, editJson, tenant, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try { await api.removeActionPlan(baseUrl, id, tenant); fetchIds(); setDetailOpen(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null); setEditJson(JSON.stringify([{ Id: '', ActionTimings: [{ ActionsID: '', Years: '*any', Months: '*any', MonthDays: '*any', WeekDays: '*any', Time: '*asap', Weight: '0' }] }], null, 2)); setEditing(true); setDetailOpen(true);
  }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" onClick={fetchIds}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Action Plan ID</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
          {ids.length > 0 ? ids.map((id, i) => (<TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}><TableCell>{i+1}</TableCell><TableCell>{id}</TableCell><TableCell align="right"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(id); }}><DeleteIcon fontSize="small" /></IconButton></TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} align="center">No action plans found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Action Plan</DialogTitle><DialogContent>
          {editing ? <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)} sx={{ fontFamily: 'monospace', mt: 1 }} /> : <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper>}
        </DialogContent><DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
