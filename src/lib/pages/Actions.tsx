import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  TextField, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [actions, setActions] = useState<{ id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState('');

  const fetchActions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getActions(baseUrl, tenant);
      if (result) {
        setActions(Object.entries(result).map(([id, details]) => ({ id, count: Array.isArray(details) ? details.length : 0 })));
      } else {
        setActions([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  const handleRowClick = useCallback(async (actionId: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getActions(baseUrl, tenant);
      const details = result?.[actionId];
      setDetail(details);
      setEditJson(JSON.stringify(details, null, 2));
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    }
  }, [baseUrl, tenant]);

  const handleDelete = useCallback(async (actionId: string) => {
    if (!baseUrl || !window.confirm(`Delete action ${actionId}?`)) return;
    try {
      await api.removeActions(baseUrl, [actionId], tenant);
      fetchActions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchActions]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Actions</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchActions}>Fetch Actions</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>Action ID</TableCell><TableCell>Parts</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {actions.length > 0 ? actions.map((a, i) => (
                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(a.id)}>
                  <TableCell>{i + 1}</TableCell><TableCell>{a.id}</TableCell><TableCell>{a.count}</TableCell>
                  <TableCell align="right"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(a.id); }}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} align="center">No actions found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Action Details</DialogTitle>
        <DialogContent>
          {editing ? (
            <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)} sx={{ fontFamily: 'monospace', mt: 1 }} />
          ) : (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
