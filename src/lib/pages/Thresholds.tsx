import { useState, useCallback, useEffect, type MouseEvent } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Checkbox, FormControlLabel, Tabs, Tab, Chip, Menu, MenuItem, ListItemIcon, Divider, Tooltip,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TypedConfirmDialog from '../components/TypedConfirmDialog';
import { formatDateTime } from '../formatTime';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { DurationInput, formatDuration } from '../components/BalanceValue';
import IdMultiSelect from '../components/IdMultiSelect';
import { CachingAdvanced, cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';
import { isZeroTime } from '../cgrConsts';
import type { Threshold, ThresholdProfile as ThresholdForm } from '../types';

const emptyForm = (tenant: string): ThresholdForm => ({
  Tenant: tenant,
  ID: '',
  Weight: 0,
  MaxHits: -1,
  MinHits: 0,
  MinSleep: 0,
  Blocker: false,
  Async: false,
  FilterIDs: [],
  ActionIDs: [],
  EeIDs: [],
  ActivationInterval: null,
});

const toForm = (data: ThresholdForm): ThresholdForm => ({
  ...data,
  FilterIDs: data.FilterIDs || [],
  ActionIDs: data.ActionIDs || [],
  EeIDs: data.EeIDs || [],
});

const chips = (ids: string[] | null | undefined) => (ids || []).length > 0
  ? ids!.map(f => <Chip key={f} label={f} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
  : 'None';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThresholdForm | null>(null);
  const [runtime, setRuntime] = useState<Threshold | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ThresholdForm>(emptyForm(defaultTenant));
  const [dialogTab, setDialogTab] = useState(0);
  const [caching, setCaching] = useState('');
  const idOptions = useIdOptions(['filters', 'actions', 'eeExporters'], tenant, detailOpen && editing);
  const testerOptions = useIdOptions(['thresholds'], tenant, true);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setStatus('loading');
    setError(null);
    try {
      const result = await api.getThresholdProfileIDs(baseUrl, tenant) as string[];
      setIds(result || []);
      setStatus('loaded');
    } catch (e: unknown) {
      setIds([]);
      // CGrateS answers NOT_FOUND when the tenant has no threshold profiles.
      if (e instanceof Error && e.message === 'NOT_FOUND') {
        setStatus('loaded');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to fetch');
        setStatus('error');
      }
    }
  }, [baseUrl, tenant]);

  useEffect(() => { fetchIds(); }, [fetchIds]);

  const fetchRuntime = useCallback(async (id: string) => {
    if (!baseUrl) return;
    setRuntime(null);
    setRuntimeError(null);
    try {
      setRuntime(await api.getThreshold(baseUrl, tenant, id));
    } catch (e: unknown) {
      setRuntimeError(e instanceof Error ? e.message : 'Failed to fetch threshold state');
    }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string, openInEditMode = false) => {
    if (!baseUrl) return;
    try {
      const result = await api.getThresholdProfile(baseUrl, tenant, id) as ThresholdForm;
      setDetail(result);
      setForm(toForm(result));
      setSelectedId(id);
      setEditing(openInEditMode);
      setDialogTab(0);
      setDetailOpen(true);
      fetchRuntime(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant, fetchRuntime]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setThresholdProfile(baseUrl, { ...form, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, caching, fetchIds]);

  const handleDelete = useCallback(async () => {
    if (!baseUrl || !deleteId) return;
    setBusy(true);
    try {
      await api.removeThresholdProfile(baseUrl, tenant, deleteId, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  }, [baseUrl, tenant, deleteId, caching, fetchIds]);

  const handleReset = useCallback(async () => {
    if (!baseUrl || !resetId) return;
    setBusy(true);
    try {
      await api.resetThreshold(baseUrl, tenant, resetId);
      if (detailOpen && selectedId === resetId) fetchRuntime(resetId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    } finally {
      setBusy(false);
      setResetId(null);
    }
  }, [baseUrl, tenant, resetId, detailOpen, selectedId, fetchRuntime]);

  const openMenu = (e: MouseEvent<HTMLElement>, id: string) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, id }); };
  const menuAction = (fn: (id: string) => void) => () => { if (menu) fn(menu.id); setMenu(null); };

  const handleCreate = useCallback(() => {
    setDetail(null);
    setRuntime(null);
    setRuntimeError(null);
    setSelectedId(null);
    setForm(emptyForm(tenant));
    setEditing(true);
    setDialogTab(0);
    setDetailOpen(true);
  }, [tenant]);

  const updateForm = <K extends keyof ThresholdForm>(field: K, value: ThresholdForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const renderStructuredView = () => {
    const d = detail;
    if (!d) return null;
    return (
      <Box sx={{ mt: 1 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Tenant</TableCell><TableCell>{d.Tenant}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell><TableCell>{d.ID}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Weight</TableCell><TableCell>{String(d.Weight)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Activation Interval</TableCell><TableCell>{formatActivationInterval(d.ActivationInterval)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MaxHits</TableCell><TableCell>{String(d.MaxHits)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MinHits</TableCell><TableCell>{String(d.MinHits)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>MinSleep</TableCell><TableCell>{formatDuration(d.MinSleep)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Blocker</TableCell><TableCell>{d.Blocker ? 'Yes' : 'No'}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Async</TableCell><TableCell>{d.Async ? 'Yes' : 'No'}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>FilterIDs</TableCell><TableCell>{chips(d.FilterIDs)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>ActionIDs</TableCell><TableCell>{chips(d.ActionIDs)}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>EeIDs</TableCell><TableCell>{(d.EeIDs || []).length ? chips(d.EeIDs) : 'Default exporters (thresholds.ees_exporter_ids)'}</TableCell></TableRow>
          </TableBody>
        </Table>

        <Typography variant="subtitle2" sx={{ mt: 2 }}>Runtime state</Typography>
        {runtimeError && <Alert severity="warning" sx={{ mt: 1 }}>{runtimeError}</Alert>}
        {runtime && (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', mt: 1 }}>
            <Typography variant="body2"><strong>Hits:</strong> {runtime.Hits}</Typography>
            <Typography variant="body2"><strong>Snoozed until:</strong> {isZeroTime(runtime.Snooze) ? 'Not snoozed' : formatDateTime(runtime.Snooze)}</Typography>
            <Button size="small" onClick={() => fetchRuntime(d.ID)}>Refresh</Button>
            <Button size="small" color="warning" onClick={() => setResetId(d.ID)}>Reset hits…</Button>
          </Box>
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
      {idOptions.error && <Alert severity="warning">{idOptions.error}</Alert>}
      {dialogTab === 0 ? (
        <>
          <TextField label="Tenant" size="small" fullWidth value={form.Tenant} onChange={e => updateForm('Tenant', e.target.value)} />
          <TextField label="ID" size="small" fullWidth value={form.ID} onChange={e => updateForm('ID', e.target.value)} disabled={!!selectedId} />
          <IdMultiSelect label="Filter IDs" value={form.FilterIDs} options={idOptions.get('filters')}
            onChange={v => updateForm('FilterIDs', v)} placeholder="Filter ID or inline *string:~*req.Account:1001" />
          <ActivationIntervalInput value={form.ActivationInterval} onChange={v => updateForm('ActivationInterval', v)} />
          <TextField label="Weight" size="small" fullWidth type="number" value={form.Weight} onChange={e => updateForm('Weight', Number(e.target.value))} />
          <TextField label="MaxHits" size="small" fullWidth type="number" value={form.MaxHits} onChange={e => updateForm('MaxHits', Number(e.target.value))} helperText="-1 for unlimited" />
          <TextField label="MinHits" size="small" fullWidth type="number" value={form.MinHits} onChange={e => updateForm('MinHits', Number(e.target.value))} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>MinSleep</Typography>
            <DurationInput key={selectedId ?? 'new'} value={form.MinSleep} onChange={raw => updateForm('MinSleep', raw)} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel control={<Checkbox checked={form.Blocker} onChange={e => updateForm('Blocker', e.target.checked)} />} label="Blocker" />
            <FormControlLabel control={<Checkbox checked={form.Async} onChange={e => updateForm('Async', e.target.checked)} />} label="Async" />
          </Box>
          <IdMultiSelect label="Action IDs" value={form.ActionIDs} options={idOptions.get('actions')}
            onChange={v => updateForm('ActionIDs', v)} />
          <IdMultiSelect label="EE exporter IDs" value={form.EeIDs} options={['*none', ...idOptions.get('eeExporters')]}
            onChange={v => updateForm('EeIDs', v)}
            helperText="Empty uses thresholds.ees_exporter_ids from the config; *none exports nothing" />
        </>
      ) : (
        <Paper sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'action.hover' }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(form, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Threshold Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="outlined" onClick={fetchIds} disabled={status === 'loading'}>Refresh</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>

      {status === 'loaded' && ids.length > 0 && <EventTester
        tenant={tenant}
        methods={['ThresholdSv1.GetThresholdsForEvent', 'ThresholdSv1.ProcessEvent']}
        opts={[
          { key: '*thdProfileIDs', label: 'Profile IDs', kind: 'ids', options: testerOptions.get('thresholds') },
          { key: '*thdProfileIgnoreFilters', label: 'Ignore filters', kind: 'bool' },
        ]}
        initialFields={[['Account', ''], ['EventType', '']]}
        warning="ProcessEvent counts a hit on every matching threshold and runs its actions and exporters. Use GetThresholdsForEvent to only see what matches."
        run={(method, args) => api.thresholdSEvent(baseUrl!, method, args)}
      />}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {status === 'loading' || status === 'idle' ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading thresholds" /></Box>
      ) : status === 'error' ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ mb: 2 }}>Couldn't load threshold profiles.</Typography>
          <Button variant="contained" onClick={fetchIds}>Try again</Button>
        </Paper>
      ) : ids.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" component="p" gutterBottom>No thresholds yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: 'auto' }}>
            Thresholds trigger actions when a counter crosses a limit (for example, a warning at 90% of an allowance).
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>Create threshold</Button>
        </Paper>
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
              {ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all' }}>{id}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Actions">
                      <IconButton size="small" aria-label={`Actions for ${id}`} aria-haspopup="menu" onClick={e => openMenu(e, id)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)} onClick={e => e.stopPropagation()}>
        <MenuItem onClick={menuAction(id => fetchDetail(id))}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>View
        </MenuItem>
        <MenuItem onClick={menuAction(id => fetchDetail(id, true))}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit…
        </MenuItem>
        <Divider />
        <MenuItem onClick={menuAction(setResetId)} sx={{ color: 'warning.main' }}>
          <ListItemIcon><RestartAltIcon fontSize="small" color="warning" /></ListItemIcon>Reset hits…
        </MenuItem>
        <MenuItem onClick={menuAction(setDeleteId)} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>Delete…
        </MenuItem>
      </Menu>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New'}</DialogTitle>
        <DialogContent>
          {editing ? renderEditForm() : renderStructuredView()}
          {editing && <Box sx={{ mt: 2 }}><CachingAdvanced value={caching} onChange={setCaching} /></Box>}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => { setForm(toForm(detail!)); setEditing(true); }}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => setDeleteId(selectedId)}>Delete…</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <TypedConfirmDialog open={!!resetId} title="Reset hits" expected={resetId ?? ''}
        confirmLabel="Reset hits" busy={busy} onConfirm={handleReset} onClose={() => setResetId(null)}>
        <Typography variant="body2">
          Sends ThresholdSv1.ResetThreshold for <strong>{resetId}</strong> on tenant {tenant}. Its hit counter and snooze go back to zero, so it can fire again.
        </Typography>
      </TypedConfirmDialog>

      <TypedConfirmDialog open={!!deleteId} title="Delete threshold profile" expected={deleteId ?? ''}
        confirmLabel="Delete" busy={busy} onConfirm={handleDelete} onClose={() => setDeleteId(null)}>
        <Typography variant="body2">
          Sends APIerSv1.RemoveThresholdProfile for <strong>{deleteId}</strong> on tenant {tenant}.
        </Typography>
      </TypedConfirmDialog>
    </Box>
  );
}
