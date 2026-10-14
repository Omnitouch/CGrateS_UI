import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Tabs, Tab, MenuItem, Checkbox, FormControlLabel, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';
import type { Route as RouteEntry, RouteProfile as RouteProfileForm } from '../types';

// Strategies registered in engine.NewRouteSortDispatcher (engine/libroutes.go).
const SORTING: Record<string, { label: string; params: string }> = {
  '*weight': { label: 'Weight (highest first)', params: 'Not used.' },
  '*lc': { label: 'Least cost', params: 'Not used. Cost comes from each route\'s RatingPlanIDs or AccountIDs.' },
  '*hc': { label: 'Highest cost', params: 'Not used. Cost comes from each route\'s RatingPlanIDs or AccountIDs.' },
  '*qos': { label: 'Quality of service', params: 'Stat metric IDs in priority order, e.g. *acd, *asr, *pdd (lower *pdd wins). Each route\'s StatIDs supply the metrics.' },
  '*reas': { label: 'Resource usage ascending', params: 'Not used. Usage comes from each route\'s ResourceIDs.' },
  '*reds': { label: 'Resource usage descending', params: 'Not used. Usage comes from each route\'s ResourceIDs.' },
  '*load': { label: 'Load distribution', params: 'routeID:ratio entries, plus *default:ratio for the rest (falls back to routes.default_ratio). Each route\'s StatIDs supply the load.' },
};

const emptyRoute = (): RouteEntry => ({
  ID: '', FilterIDs: [], AccountIDs: [], RatingPlanIDs: [], ResourceIDs: [], StatIDs: [],
  RouteParameters: '', Weight: 0, Blocker: false,
});

const emptyForm = (tenant: string): RouteProfileForm => ({
  Tenant: tenant,
  ID: '',
  FilterIDs: [],
  ActivationInterval: null,
  Sorting: '*weight',
  SortingParameters: [],
  Weight: 0,
  Routes: [emptyRoute()],
});

// Keeps every field of the loaded profile so a save does not wipe what the form does not show.
const toForm = (data: RouteProfileForm): RouteProfileForm => ({
  ...data,
  FilterIDs: data.FilterIDs || [],
  SortingParameters: data.SortingParameters || [],
  Routes: (data.Routes || []).map(r => ({
    ...emptyRoute(),
    ...r,
    FilterIDs: r.FilterIDs || [],
    AccountIDs: r.AccountIDs || [],
    RatingPlanIDs: r.RatingPlanIDs || [],
    ResourceIDs: r.ResourceIDs || [],
    StatIDs: r.StatIDs || [],
  })),
});

const list = (ids: string[] | null | undefined) => (ids || []).join(', ') || '-';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RouteProfileForm | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RouteProfileForm>(emptyForm(defaultTenant));
  const [dialogTab, setDialogTab] = useState(0);
  const [caching, setCaching] = useState('');
  const idOptions = useIdOptions(['filters', 'accounts', 'ratingPlans', 'resources', 'stats'], tenant, detailOpen && editing);

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
      const result = await api.getRouteProfile(baseUrl, tenant, id) as RouteProfileForm;
      setDetail(result);
      setForm(toForm(result));
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
      await api.setRouteProfile(baseUrl, { ...form, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, caching, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeRouteProfile(baseUrl, tenant, id, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setForm(emptyForm(tenant));
    setEditing(true);
    setDialogTab(0);
    setDetailOpen(true);
  }, [tenant]);

  const updateForm = <K extends keyof RouteProfileForm>(field: K, value: RouteProfileForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateRoute = <K extends keyof RouteEntry>(index: number, field: K, value: RouteEntry[K]) => {
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
    const d = detail;
    if (!d) return null;
    const routes = d.Routes || [];
    return (
      <Box sx={{ mt: 1 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Tenant</TableCell><TableCell>{d.Tenant}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell><TableCell>{d.ID}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Filter IDs</TableCell><TableCell>{list(d.FilterIDs)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Activation Interval</TableCell><TableCell>{formatActivationInterval(d.ActivationInterval)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Sorting</TableCell><TableCell>{d.Sorting}{SORTING[d.Sorting] ? ` (${SORTING[d.Sorting].label})` : ''}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Sorting Parameters</TableCell><TableCell>{list(d.SortingParameters)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Weight</TableCell><TableCell>{String(d.Weight)}</TableCell></TableRow>
          </TableBody>
        </Table>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Routes ({routes.length})</Typography>
        {routes.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Parameters</TableCell>
                  <TableCell>Weight</TableCell>
                  <TableCell>Filters</TableCell>
                  <TableCell>Accounts</TableCell>
                  <TableCell>Rating Plans</TableCell>
                  <TableCell>Resources</TableCell>
                  <TableCell>Stats</TableCell>
                  <TableCell>Blocker</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {routes.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.ID}</TableCell>
                    <TableCell>{r.RouteParameters || '-'}</TableCell>
                    <TableCell>{r.Weight}</TableCell>
                    <TableCell>{list(r.FilterIDs)}</TableCell>
                    <TableCell>{list(r.AccountIDs)}</TableCell>
                    <TableCell>{list(r.RatingPlanIDs)}</TableCell>
                    <TableCell>{list(r.ResourceIDs)}</TableCell>
                    <TableCell>{list(r.StatIDs)}</TableCell>
                    <TableCell>{r.Blocker ? <Chip label="Blocker" size="small" /> : '-'}</TableCell>
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

  const sortingInfo = SORTING[form.Sorting];

  const renderEditForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)}>
        <Tab label="Fields" />
        <Tab label="Raw Data" />
      </Tabs>
      {idOptions.error && <Alert severity="warning">{idOptions.error}</Alert>}
      {dialogTab === 0 ? (
        <>
          <TextField label="Tenant" size="small" fullWidth value={form.Tenant} onChange={e => updateForm('Tenant', e.target.value)} />
          <TextField label="ID" size="small" fullWidth value={form.ID} onChange={e => updateForm('ID', e.target.value)} disabled={!!selectedId} />
          <IdMultiSelect label="Filter IDs" value={form.FilterIDs} options={idOptions.get('filters')}
            onChange={v => updateForm('FilterIDs', v)} placeholder="Filter ID or inline *string:~*req.Account:1001" />
          <ActivationIntervalInput value={form.ActivationInterval} onChange={v => updateForm('ActivationInterval', v)} />
          <TextField select label="Sorting" size="small" fullWidth value={form.Sorting} onChange={e => updateForm('Sorting', e.target.value)}>
            {!sortingInfo && <MenuItem value={form.Sorting}>{form.Sorting} (not supported by RouteS)</MenuItem>}
            {Object.entries(SORTING).map(([k, v]) => <MenuItem key={k} value={k}>{k} - {v.label}</MenuItem>)}
          </TextField>
          <IdMultiSelect label="Sorting Parameters" value={form.SortingParameters}
            options={form.Sorting === '*qos' ? ['*acd', '*asr', '*tcd', '*acc', '*tcc', '*pdd', '*ddc'] : form.Sorting === '*load' ? ['*default:1'] : []}
            onChange={v => updateForm('SortingParameters', v)} helperText={sortingInfo?.params} />
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
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField label="ID" size="small" fullWidth value={route.ID} onChange={e => updateRoute(idx, 'ID', e.target.value)} />
                  <TextField label="Weight" size="small" type="number" sx={{ width: 140 }} value={route.Weight} onChange={e => updateRoute(idx, 'Weight', Number(e.target.value))} />
                </Box>
                <TextField label="Route Parameters" size="small" fullWidth value={route.RouteParameters}
                  onChange={e => updateRoute(idx, 'RouteParameters', e.target.value)} helperText="Returned with the route, e.g. a gateway or trunk name" />
                <IdMultiSelect label="Filter IDs" value={route.FilterIDs} options={idOptions.get('filters')} onChange={v => updateRoute(idx, 'FilterIDs', v)} />
                <IdMultiSelect label="Account IDs" value={route.AccountIDs} options={idOptions.get('accounts')} onChange={v => updateRoute(idx, 'AccountIDs', v)} />
                <IdMultiSelect label="Rating Plan IDs" value={route.RatingPlanIDs} options={idOptions.get('ratingPlans')} onChange={v => updateRoute(idx, 'RatingPlanIDs', v)} />
                <IdMultiSelect label="Resource IDs" value={route.ResourceIDs} options={idOptions.get('resources')} onChange={v => updateRoute(idx, 'ResourceIDs', v)} />
                <IdMultiSelect label="Stat IDs" value={route.StatIDs} options={idOptions.get('stats')} onChange={v => updateRoute(idx, 'StatIDs', v)}
                  helperText="StatID or StatID:metric" />
                <FormControlLabel label="Blocker (stop after this route)"
                  control={<Checkbox checked={route.Blocker} onChange={e => updateRoute(idx, 'Blocker', e.target.checked)} />} />
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
          <CachingSelect value={caching} onChange={setCaching} />
        </Box>
      </Paper>

      <EventTester
        tenant={tenant}
        methods={['RouteSv1.GetRouteProfilesForEvent']}
        opts={[]}
        initialFields={[['Account', ''], ['Destination', '']]}
        run={(_method, args) => api.getRouteProfilesForEvent(baseUrl!, args)}
        title="Which profiles match an event"
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

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New'}</DialogTitle>
        <DialogContent>
          {editing ? renderEditForm() : renderStructuredView()}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => { setForm(toForm(detail!)); setEditing(true); }}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => handleDelete(selectedId)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
