import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ResourceProfile, ResourceUsage } from '../types';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResourceProfile | null>(null);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState('');

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getResourceProfileIDs(baseUrl, tenant) as string[];
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
      const [profileResult, usageResult] = await Promise.all([
        api.getResourceProfile(baseUrl, tenant, id),
        api.getResource(baseUrl, tenant, id).catch(() => null),
      ]);
      setDetail(profileResult as ResourceProfile);
      setUsage(usageResult as ResourceUsage | null);
      setEditJson(JSON.stringify(profileResult, null, 2));
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
      const parsed = JSON.parse(editJson);
      await api.setResourceProfile(baseUrl, parsed);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editJson, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeResourceProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setUsage(null);
    setSelectedId(null);
    setEditJson(JSON.stringify({
      Tenant: tenant, ID: '', FilterIDs: [], UsageTTL: -1,
      Limit: 5, Blocker: false, Stored: true, Weight: 10, ThresholdIDs: ['*none'],
    }, null, 2));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Resource Profiles</Typography>
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
          {editing ? (
            <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)}
              sx={{ fontFamily: 'monospace', mt: 1 }} />
          ) : detail && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle1">Profile</Typography>
              <Table size="small">
                <TableBody>
                  <TableRow><TableCell><strong>Tenant</strong></TableCell><TableCell>{detail.Tenant}</TableCell></TableRow>
                  <TableRow><TableCell><strong>ID</strong></TableCell><TableCell>{detail.ID}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Usage TTL</strong></TableCell><TableCell>{detail.UsageTTL}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Limit</strong></TableCell><TableCell>{detail.Limit}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Blocker</strong></TableCell><TableCell>{detail.Blocker ? 'Yes' : 'No'}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Stored</strong></TableCell><TableCell>{detail.Stored ? 'Yes' : 'No'}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Weight</strong></TableCell><TableCell>{detail.Weight}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Filter IDs</strong></TableCell><TableCell>{detail.FilterIDs?.join(', ') || 'None'}</TableCell></TableRow>
                  <TableRow><TableCell><strong>Threshold IDs</strong></TableCell><TableCell>{detail.ThresholdIDs?.join(', ') || 'None'}</TableCell></TableRow>
                </TableBody>
              </Table>

              {usage && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Usage Information</Typography>
                  {usage.Usages && Object.keys(usage.Usages).length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Usage ID</TableCell>
                          <TableCell>Tenant</TableCell>
                          <TableCell>Expiry Time</TableCell>
                          <TableCell>Units</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(usage.Usages).map(([uid, u]) => (
                          <TableRow key={uid}>
                            <TableCell>{uid}</TableCell>
                            <TableCell>{u.Tenant}</TableCell>
                            <TableCell>{u.ExpiryTime}</TableCell>
                            <TableCell>{u.Units}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography color="text.secondary">No usages</Typography>
                  )}
                  <Typography variant="body2" sx={{ mt: 1 }}><strong>TTL Index:</strong> {usage.TTLIdx || 'N/A'}</Typography>
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ mt: 2 }}>Raw JSON</Typography>
              <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'grey.50' }}>
                <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
              </Paper>
            </Box>
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
