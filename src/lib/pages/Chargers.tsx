import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, List, ListItem, ListItemText, Divider, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ChargerProfile } from '../types';

function emptyCharger(tenant: string): ChargerProfile {
  return {
    Tenant: tenant,
    ID: '',
    FilterIDs: [],
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
      await api.setChargerProfile(baseUrl, editData as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeChargerProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditData(emptyCharger(tenant));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  // --- Edit helpers ---
  const addFilterId = () => {
    setEditData(prev => ({ ...prev, FilterIDs: [...(prev.FilterIDs || []), ''] }));
  };

  const removeFilterId = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      FilterIDs: (prev.FilterIDs || []).filter((_, i) => i !== idx),
    }));
  };

  const updateFilterId = (idx: number, value: string) => {
    setEditData(prev => {
      const fids = [...(prev.FilterIDs || [])];
      fids[idx] = value;
      return { ...prev, FilterIDs: fids };
    });
  };

  const addAttributeId = () => {
    setEditData(prev => ({ ...prev, AttributeIDs: [...(prev.AttributeIDs || []), ''] }));
  };

  const removeAttributeId = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      AttributeIDs: (prev.AttributeIDs || []).filter((_, i) => i !== idx),
    }));
  };

  const updateAttributeId = (idx: number, value: string) => {
    setEditData(prev => {
      const aids = [...(prev.AttributeIDs || [])];
      aids[idx] = value;
      return { ...prev, AttributeIDs: aids };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Charger Profiles</Typography>
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
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New Charger'}</DialogTitle>
        <DialogContent dividers>
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
              <TextField
                label="RunID" size="small" fullWidth
                value={editData.RunID}
                onChange={e => setEditData(prev => ({ ...prev, RunID: e.target.value }))}
              />
              <TextField
                label="Weight" size="small" fullWidth type="number"
                value={editData.Weight}
                onChange={e => setEditData(prev => ({ ...prev, Weight: Number(e.target.value) }))}
              />

              {/* FilterIDs */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>FilterIDs</Typography>
              {(editData.FilterIDs || []).map((fid, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small" fullWidth value={fid}
                    onChange={e => updateFilterId(idx, e.target.value)}
                    placeholder="Filter ID"
                  />
                  <IconButton size="small" color="error" onClick={() => removeFilterId(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addFilterId}>Add FilterID</Button>

              <Divider />

              {/* AttributeIDs */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>AttributeIDs</Typography>
              {(editData.AttributeIDs || []).map((aid, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small" fullWidth value={aid}
                    onChange={e => updateAttributeId(idx, e.target.value)}
                    placeholder="Attribute ID (or *none)"
                  />
                  <IconButton size="small" color="error" onClick={() => removeAttributeId(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addAttributeId}>Add AttributeID</Button>
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
