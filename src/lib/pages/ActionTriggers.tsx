import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';


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
  const [editJson, setEditJson] = useState('');

  const fetchTriggers = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true); setError(null);
    try { const r = await api.getActionTriggers(baseUrl, tenant) as Record<string, unknown>[]; setTriggers(r || []); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setTriggers([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant]);

  const handleRowClick = (trigger: Record<string, unknown>) => { setDetail(trigger); setEditJson(JSON.stringify(trigger, null, 2)); setEditing(false); setDetailOpen(true); };

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try { const parsed = JSON.parse(editJson); await api.setActionTrigger(baseUrl, { GroupID: parsed.ID || parsed.GroupID, ActionTrigger: parsed, Overwrite: true, Tenant: tenant }); setDetailOpen(false); fetchTriggers(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, editJson, tenant, fetchTriggers]);

  const handleDelete = useCallback(async () => {
    if (!baseUrl || !detail) return;
    const d = detail as Record<string, unknown>;
    const groupId = (d.ID || d.GroupID) as string;
    if (!window.confirm(`Delete trigger ${groupId}?`)) return;
    try { await api.removeActionTrigger(baseUrl, groupId, tenant); setDetailOpen(false); fetchTriggers(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, detail, tenant, fetchTriggers]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Triggers</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" onClick={fetchTriggers}>Fetch</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setDetail(null); setEditJson('{}'); setEditing(true); setDetailOpen(true); }}>Add Trigger</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell><TableCell>Threshold Type</TableCell><TableCell>Actions ID</TableCell></TableRow></TableHead><TableBody>
          {triggers.length > 0 ? triggers.map((t, i) => (<TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(t)}><TableCell>{i+1}</TableCell><TableCell>{String(t.ID || '')}</TableCell><TableCell>{String(t.ThresholdType || '')}</TableCell><TableCell>{String(t.ActionsID || '')}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={4} align="center">No triggers found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Action Trigger</DialogTitle><DialogContent>
          {editing ? <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)} sx={{ fontFamily: 'monospace', mt: 1 }} /> : <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre></Paper>}
        </DialogContent><DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          {detail ? <Button color="error" onClick={handleDelete}>Delete</Button> : null}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
