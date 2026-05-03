import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

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
  const [editJson, setEditJson] = useState('');

  // Metrics
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsId, setMetricsId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, string> | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStatQueueProfileIDs(baseUrl, tenant) as string[];
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
      const result = await api.getStatQueueProfile(baseUrl, tenant, id);
      setDetail(result);
      setEditJson(JSON.stringify(result, null, 2));
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
      await api.setStatQueueProfile(baseUrl, parsed);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editJson, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeStatQueueProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditJson(JSON.stringify({ Tenant: tenant, ID: '' }, null, 2));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  const fetchMetrics = useCallback(async (id: string) => {
    if (!baseUrl) return;
    setMetricsLoading(true);
    setMetrics(null);
    setMetricsId(id);
    setMetricsOpen(true);
    try {
      const result = await api.getQueueStringMetrics(baseUrl, tenant, id);
      setMetrics(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [baseUrl, tenant]);

  const handleResetQueue = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Reset stat queue ${id}?`)) return;
    try {
      await api.resetStatQueue(baseUrl, tenant, id);
      // Refresh metrics if viewing
      if (metricsOpen && metricsId === id) fetchMetrics(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    }
  }, [baseUrl, tenant, metricsOpen, metricsId, fetchMetrics]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Stat Queue Profiles</Typography>
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
                    <IconButton size="small" title="View Metrics" onClick={e => { e.stopPropagation(); fetchMetrics(id); }}><BarChartIcon fontSize="small" /></IconButton>
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

      {/* Profile Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New'}</DialogTitle>
        <DialogContent>
          {editing ? (
            <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)}
              sx={{ fontFamily: 'monospace', mt: 1 }} />
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
          {selectedId && <Button color="error" onClick={() => handleDelete(selectedId)}>Delete</Button>}
          {selectedId && <Button onClick={() => fetchMetrics(selectedId)}>View Metrics</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsOpen} onClose={() => setMetricsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Metrics: {metricsId}</DialogTitle>
        <DialogContent>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : metrics ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell><Chip label={k} size="small" /></TableCell>
                      <TableCell>{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No metrics available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {metricsId && <Button color="warning" onClick={() => handleResetQueue(metricsId)}>Reset Queue</Button>}
          <Button onClick={() => setMetricsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
