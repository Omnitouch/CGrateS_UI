import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Tabs, Tab,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

interface RouteEntry {
  RouteID: string;
  RouteParameters: string;
  Weight: number;
}

interface RouteProfileForm {
  Tenant: string;
  ID: string;
  Weight: number;
  Routes: RouteEntry[];
}

const emptyRoute = (): RouteEntry => ({ RouteID: '', RouteParameters: '', Weight: 0 });

const emptyForm = (tenant: string): RouteProfileForm => ({
  Tenant: tenant,
  ID: '',
  Weight: 0,
  Routes: [emptyRoute()],
});

const toForm = (data: Record<string, unknown>, tenant: string): RouteProfileForm => ({
  Tenant: (data.Tenant as string) || tenant,
  ID: (data.ID as string) || '',
  Weight: (data.Weight as number) ?? 0,
  Routes: Array.isArray(data.Routes) ? (data.Routes as RouteEntry[]).map(r => ({
    RouteID: r.RouteID || '',
    RouteParameters: r.RouteParameters || '',
    Weight: r.Weight ?? 0,
  })) : [emptyRoute()],
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
  const [form, setForm] = useState<RouteProfileForm>(emptyForm(defaultTenant));
  const [dialogTab, setDialogTab] = useState(0);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getRouteProfileIDs(baseUrl, tenant) as string[];
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
      const result = await api.getRouteProfile(baseUrl, tenant, id);
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
      await api.setRouteProfile(baseUrl, form as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeRouteProfile(baseUrl, tenant, id);
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

  const updateForm = (field: keyof RouteProfileForm, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateRoute = (index: number, field: keyof RouteEntry, value: unknown) => {
    setForm(prev => {
      const routes = [...prev.Routes];
      routes[index] = { ...routes[index], [field]: value };
      return { ...prev, Routes: routes };
    });
  };

  const addRoute = () => {
    setForm(prev => ({ ...prev, Routes: [...prev.Routes, emptyRoute()] }));
  };

  const removeRoute = (index: number) => {
    setForm(prev => ({ ...prev, Routes: prev.Routes.filter((_, i) => i !== index) }));
  };

  const renderStructuredView = () => {
    const d = detail as Record<string, unknown> | null;
    if (!d) return null;
    const routes = (d.Routes as RouteEntry[]) || [];
    return (
      <Box sx={{ mt: 1 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Tenant</TableCell><TableCell>{d.Tenant as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell><TableCell>{d.ID as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Weight</TableCell><TableCell>{String(d.Weight)}</TableCell></TableRow>
          </TableBody>
        </Table>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Routes ({routes.length})</Typography>
        {routes.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>RouteID</TableCell>
                  <TableCell>RouteParameters</TableCell>
                  <TableCell>Weight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {routes.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.RouteID}</TableCell>
                    <TableCell>{r.RouteParameters || '-'}</TableCell>
                    <TableCell>{r.Weight}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">No routes defined</Typography>
        )}
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

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">Routes</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addRoute}>Add Route</Button>
          </Box>
          {form.Routes.map((route, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight="bold">Route {idx + 1}</Typography>
                <IconButton size="small" color="error" onClick={() => removeRoute(idx)} disabled={form.Routes.length <= 1}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField label="RouteID" size="small" fullWidth value={route.RouteID} onChange={e => updateRoute(idx, 'RouteID', e.target.value)} />
                <TextField label="RouteParameters" size="small" fullWidth value={route.RouteParameters} onChange={e => updateRoute(idx, 'RouteParameters', e.target.value)} />
                <TextField label="Weight" size="small" fullWidth type="number" value={route.Weight} onChange={e => updateRoute(idx, 'Weight', Number(e.target.value))} />
              </Box>
            </Paper>
          ))}
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
      <Typography variant="h5" gutterBottom>Route Profiles</Typography>
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
