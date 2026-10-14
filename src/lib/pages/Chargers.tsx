import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, List, ListItem, ListItemText, Divider, Chip, Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ChargerProfile } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';

const CONTEXTS = ['*any', '*sessions', '*cdrs', '*chargers'];

function emptyCharger(tenant: string): ChargerProfile {
  return {
    Tenant: tenant,
    ID: '',
    FilterIDs: [],
    ActivationInterval: null,
    AttributeIDs: [],
    RunID: '*default',
    Weight: 0,
  };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChargerProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<ChargerProfile>(emptyCharger(defaultTenant));
  const [caching, setCaching] = useState('');
  const idOptions = useIdOptions(['filters', 'attributes'], tenant, detailOpen && editing);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getChargerProfileIDs(baseUrl, tenant) as string[];
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  // Auto-fetch on tenant change
  useEffect(() => {
    if (baseUrl && tenant) {
      fetchIds();
    }
  }, [tenant, baseUrl, fetchIds]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getChargerProfile(baseUrl, tenant, id) as ChargerProfile;
      setDetail(result);
      setEditData(JSON.parse(JSON.stringify(result)));
      setSelectedId(id);
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setChargerProfile(baseUrl, { ...editData, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, caching, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeChargerProfile(baseUrl, tenant, id, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditData(emptyCharger(tenant));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Charger Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
          <CachingSelect value={caching} onChange={setCaching} />
        </Box>
      </Paper>

      <EventTester
        tenant={tenant}
        methods={['ChargerSv1.GetChargersForEvent', 'ChargerSv1.ProcessEvent']}
        opts={[{ key: '*context', label: 'Attribute context', kind: 'text', options: CONTEXTS, helperText: 'ProcessEvent passes this to AttributeS' }]}
        initialFields={[['Account', ''], ['Destination', '']]}
        run={(method, args) => api.chargerSEvent(baseUrl!, method, args)}
      />

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
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New Charger'}</DialogTitle>
        <DialogContent dividers>
          {editing && idOptions.error && <Alert severity="warning" sx={{ mb: 1 }}>{idOptions.error}</Alert>}
          {editing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Tenant" size="small" fullWidth
                value={editData.Tenant}
                onChange={e => setEditData(prev => ({ ...prev, Tenant: e.target.value }))}
              />
              <TextField
                label="ID" size="small" fullWidth
                value={editData.ID}
                onChange={e => setEditData(prev => ({ ...prev, ID: e.target.value }))}
              />
              <Autocomplete<string, false, false, true>
                freeSolo size="small" options={['*default']}
                value={editData.RunID} onInputChange={(_e, v) => setEditData(prev => ({ ...prev, RunID: v }))}
                renderInput={p => <TextField {...p} label="RunID" helperText="*default is the main charging run; other names create extra runs" />}
              />
              <TextField
                label="Weight" size="small" fullWidth type="number"
                value={editData.Weight}
                onChange={e => setEditData(prev => ({ ...prev, Weight: Number(e.target.value) }))}
              />
              <IdMultiSelect
                label="Filter IDs" value={editData.FilterIDs || []} options={idOptions.get('filters')}
                onChange={v => setEditData(prev => ({ ...prev, FilterIDs: v }))}
                placeholder="Filter ID or inline *string:~*req.Account:1001"
              />
              <ActivationIntervalInput
                value={editData.ActivationInterval}
                onChange={v => setEditData(prev => ({ ...prev, ActivationInterval: v }))}
              />
              <IdMultiSelect
                label="Attribute IDs" value={editData.AttributeIDs || []} options={['*none', ...idOptions.get('attributes')]}
                onChange={v => setEditData(prev => ({ ...prev, AttributeIDs: v }))}
                helperText="*none skips AttributeS; inline attributes like *constant:*req.RequestType:*prepaid are accepted"
              />
            </Box>
          ) : (
            /* --- View mode --- */
            detail && (
              <List dense>
                <ListItem>
                  <ListItemText primary="Tenant" secondary={detail.Tenant} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="ID" secondary={detail.ID} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="RunID" secondary={detail.RunID} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Weight" secondary={detail.Weight} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Activation Interval" secondary={formatActivationInterval(detail.ActivationInterval)} />
                </ListItem>
                <Divider />
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2" fontWeight={600}>FilterIDs</Typography>
                  {detail.FilterIDs && detail.FilterIDs.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {detail.FilterIDs.map((fid, i) => <Chip key={i} label={fid} size="small" variant="outlined" />)}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </ListItem>
                <Divider />
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2" fontWeight={600}>AttributeIDs</Typography>
                  {detail.AttributeIDs && detail.AttributeIDs.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {detail.AttributeIDs.map((aid, i) => <Chip key={i} label={aid} size="small" color="primary" variant="outlined" />)}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  )}
                </ListItem>
              </List>
            )
          )}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => handleDelete(selectedId)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
