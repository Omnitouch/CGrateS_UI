import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Checkbox, FormControlLabel, Tabs, Tab, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

interface ThresholdForm {
  Tenant: string;
  ID: string;
  Weight: number;
  MaxHits: number;
  MinHits: number;
  MinSleep: string;
  Blocker: boolean;
  Async: boolean;
  FilterIDs: string[];
  ActionIDs: string[];
}

const emptyForm = (tenant: string): ThresholdForm => ({
  Tenant: tenant,
  ID: '',
  Weight: 0,
  MaxHits: -1,
  MinHits: 0,
  MinSleep: '0',
  Blocker: false,
  Async: false,
  FilterIDs: [],
  ActionIDs: [],
});

const toForm = (data: Record<string, unknown>, tenant: string): ThresholdForm => ({
  Tenant: (data.Tenant as string) || tenant,
  ID: (data.ID as string) || '',
  Weight: (data.Weight as number) ?? 0,
  MaxHits: (data.MaxHits as number) ?? -1,
  MinHits: (data.MinHits as number) ?? 0,
  MinSleep: (data.MinSleep as string) || '0',
  Blocker: (data.Blocker as boolean) ?? false,
  Async: (data.Async as boolean) ?? false,
  FilterIDs: (data.FilterIDs as string[]) || [],
  ActionIDs: (data.ActionIDs as string[]) || [],
});

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ThresholdForm>(emptyForm(defaultTenant));
  const [dialogTab, setDialogTab] = useState(0);
  const [newFilterId, setNewFilterId] = useState('');
  const [newActionId, setNewActionId] = useState('');

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getThresholdProfileIDs(baseUrl, tenant) as string[];
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getThresholdProfile(baseUrl, tenant, id);
      setDetail(result);
      setForm(toForm(result as Record<string, unknown>, tenant));
      setSelectedId(id);
      setEditing(false);
      setDialogTab(0);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setThresholdProfile(baseUrl, form as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeThresholdProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setForm(emptyForm(tenant));
    setEditing(true);
    setDialogTab(0);
    setDetailOpen(true);
  }, [tenant]);

  const updateForm = (field: keyof ThresholdForm, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addFilterId = () => {
    if (newFilterId.trim() && !form.FilterIDs.includes(newFilterId.trim())) {
      updateForm('FilterIDs', [...form.FilterIDs, newFilterId.trim()]);
      setNewFilterId('');
    }
  };

  const removeFilterId = (id: string) => {
    updateForm('FilterIDs', form.FilterIDs.filter(f => f !== id));
  };

  const addActionId = () => {
    if (newActionId.trim() && !form.ActionIDs.includes(newActionId.trim())) {
      updateForm('ActionIDs', [...form.ActionIDs, newActionId.trim()]);
      setNewActionId('');
    }
  };

  const removeActionId = (id: string) => {
    updateForm('ActionIDs', form.ActionIDs.filter(a => a !== id));
  };

  const renderStructuredView = () => {
    const d = detail as Record<string, unknown> | null;
    if (!d) return null;
    return (
      <Box sx={{ mt: 1 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Tenant</TableCell><TableCell>{d.Tenant as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell><TableCell>{d.ID as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Weight</TableCell><TableCell>{String(d.Weight)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MaxHits</TableCell><TableCell>{String(d.MaxHits)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MinHits</TableCell><TableCell>{String(d.MinHits)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MinSleep</TableCell><TableCell>{d.MinSleep as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Blocker</TableCell><TableCell>{d.Blocker ? 'Yes' : 'No'}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Async</TableCell><TableCell>{d.Async ? 'Yes' : 'No'}</TableCell></TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>FilterIDs</TableCell>
              <TableCell>
                {(d.FilterIDs as string[] || []).length > 0
                  ? (d.FilterIDs as string[]).map(f => <Chip key={f} label={f} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
                  : 'None'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>ActionIDs</TableCell>
              <TableCell>
                {(d.ActionIDs as string[] || []).length > 0
                  ? (d.ActionIDs as string[]).map(a => <Chip key={a} label={a} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
                  : 'None'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    );
  };

  const renderEditForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)}>
        <Tab label="Fields" />
        <Tab label="Raw Data" />
      </Tabs>
      {dialogTab === 0 ? (
        <>
          <TextField label="Tenant" size="small" fullWidth value={form.Tenant} onChange={e => updateForm('Tenant', e.target.value)} />
          <TextField label="ID" size="small" fullWidth value={form.ID} onChange={e => updateForm('ID', e.target.value)} disabled={!!selectedId} />
          <TextField label="Weight" size="small" fullWidth type="number" value={form.Weight} onChange={e => updateForm('Weight', Number(e.target.value))} />
          <TextField label="MaxHits" size="small" fullWidth type="number" value={form.MaxHits} onChange={e => updateForm('MaxHits', Number(e.target.value))} helperText="-1 for unlimited" />
          <TextField label="MinHits" size="small" fullWidth type="number" value={form.MinHits} onChange={e => updateForm('MinHits', Number(e.target.value))} />
          <TextField label="MinSleep" size="small" fullWidth value={form.MinSleep} onChange={e => updateForm('MinSleep', e.target.value)} helperText="e.g. 1s, 1m, 0" />
          <FormControlLabel control={<Checkbox checked={form.Blocker} onChange={e => updateForm('Blocker', e.target.checked)} />} label="Blocker" />
          <FormControlLabel control={<Checkbox checked={form.Async} onChange={e => updateForm('Async', e.target.checked)} />} label="Async" />

          <Typography variant="subtitle2">Filter IDs</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {form.FilterIDs.map(f => (
              <Chip key={f} label={f} onDelete={() => removeFilterId(f)} size="small" />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" value={newFilterId} onChange={e => setNewFilterId(e.target.value)} placeholder="Add filter ID"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFilterId(); } }} sx={{ flex: 1 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={addFilterId}>Add</Button>
          </Box>

          <Typography variant="subtitle2">Action IDs</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {form.ActionIDs.map(a => (
              <Chip key={a} label={a} onDelete={() => removeActionId(a)} size="small" />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" value={newActionId} onChange={e => setNewActionId(e.target.value)} placeholder="Add action ID"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addActionId(); } }} sx={{ flex: 1 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={addActionId}>Add</Button>
          </Box>
        </>
      ) : (
        <Paper sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(form, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Threshold Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>ID</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{id}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); fetchDetail(id); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(id); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No items found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New'}</DialogTitle>
        <DialogContent>
          {editing ? renderEditForm() : renderStructuredView()}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => { setForm(toForm(detail as Record<string, unknown>, tenant)); setEditing(true); }}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => handleDelete(selectedId)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
