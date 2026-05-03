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
  const [detailId, setDetailId] = useState<string | null>(null);
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
      setDetailId(actionId);
      setEditJson(JSON.stringify(details, null, 2));
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const parsed = JSON.parse(editJson);
      const parts = Array.isArray(parsed) ? parsed : [parsed];
      const actionsId = detailId || parts[0]?.Id || '';

      const updatedActions = parts.map((part: Record<string, unknown>) => {
        const balance = part.Balance as Record<string, unknown> | null;
        const action: Record<string, unknown> = {
          Identifier: (part.Identifier || part.ActionType) as string,
          ExtraParameters: (part.ExtraParameters || '') as string,
          ExpiryTime: (part.ExpirationString || '') as string,
          Weight: (part.Weight || 0) as number,
        };
        if (balance) {
          if (balance.ID) action.BalanceId = balance.ID;
          if (balance.Uuid) action.BalanceUuid = balance.Uuid;
          if (balance.Type) action.BalanceType = balance.Type;
          if (typeof balance.Disabled === 'boolean') action.BalanceDisabled = balance.Disabled ? 'true' : 'false';
          const balValue = balance.Value as Record<string, unknown> | null;
          action.Units = balValue?.Static || 0;
          action.DestinationIds = typeof balance.DestinationIDs === 'object' && balance.DestinationIDs
            ? Object.keys(balance.DestinationIDs as Record<string, boolean>).join(';')
            : (balance.DestinationIDs || '');
          action.RatingSubject = balance.RatingSubject || '';
          action.BalanceWeight = balance.Weight || 0;
          if (typeof (part as Record<string, unknown>).BalanceBlocker === 'boolean') {
            action.BalanceBlocker = (part as Record<string, unknown>).BalanceBlocker ? 'true' : 'false';
          }
        }
        if (part.Filters) {
          action.Filters = Array.isArray(part.Filters) ? (part.Filters as string[]).join(';') : part.Filters || '';
        }
        return action;
      });

      await api.setActions(baseUrl, {
        ActionsId: actionsId,
        Tenant: tenant,
        Overwrite: true,
        Actions: updatedActions,
      });
      setDetailOpen(false);
      fetchActions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editJson, detailId, tenant, fetchActions]);

  const handleDelete = useCallback(async (actionId: string) => {
    if (!baseUrl || !window.confirm(`Delete action ${actionId}?`)) return;
    try {
      await api.removeActions(baseUrl, [actionId], tenant);
      fetchActions();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchActions]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setDetailId(null);
    setEditJson(JSON.stringify([{
      Id: '', ActionType: '', ExtraParameters: '', Filters: '',
      ExpirationString: '', Weight: 0,
      Balance: { ID: '', Type: '', Value: { Static: 0 }, DestinationIDs: {}, RatingSubject: '', Weight: 0 },
    }], null, 2));
    setEditing(true);
    setDetailOpen(true);
  }, []);

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
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
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
        <DialogTitle>{detailId ? `Action: ${detailId}` : 'Create New Action'}</DialogTitle>
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
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          {detailId && <Button color="error" onClick={() => handleDelete(detailId)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
