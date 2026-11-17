import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, AlertTitle, IconButton,
  TextField, Tabs, Tab, Checkbox, FormControlLabel, TablePagination, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ResourceProfile, ResourceUsage } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';
import { DurationInput, formatDuration } from '../components/BalanceValue';
import { isZeroTime } from '../cgrConsts';
import { formatDateTime } from '../formatTime';
import TypedConfirmDialog from '../components/TypedConfirmDialog';

interface RowInfo {
  profile?: ResourceProfile;
  profileError?: string;
  usage?: ResourceUsage;
  usageError?: string;
}

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const isActive = (expiry: string) => isZeroTime(expiry) || new Date(expiry).getTime() > Date.now();

// GetResource returns usages whose TTL has passed until ResourceS next cleans them up.
function unitsInUse(u: ResourceUsage) {
  return Object.values(u.Usages || {}).filter(x => isActive(x.ExpiryTime)).reduce((sum, x) => sum + x.Units, 0);
}

function UsageError({ error, summary }: { error: string; summary?: string }) {
  const noService = error.includes("can't find service ResourceSv1");
  return (
    <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
      <AlertTitle>Couldn't read current usage</AlertTitle>
      {summary && <Typography variant="body2">{summary}</Typography>}
      {noService && (
        <Typography variant="body2">
          This engine has no ResourceS service registered (it is usually disabled in the engine config), so allocations aren't being tracked.
        </Typography>
      )}
      <Box component="details" sx={{ mt: 1 }}>
        <summary style={{ cursor: 'pointer' }}>Error details</summary>
        <Box component="code" sx={{ display: 'block', mt: 0.5, fontSize: 12, wordBreak: 'break-all' }}>{error}</Box>
      </Box>
    </Alert>
  );
}

const emptyProfile = (tenant: string): ResourceProfile => ({
  Tenant: tenant, ID: '', FilterIDs: [], ActivationInterval: null, UsageTTL: -1,
  Limit: 1, AllocationMessage: '', Blocker: false, Stored: false, Weight: 0, ThresholdIDs: [],
});

const toForm = (p: ResourceProfile): ResourceProfile => ({
  ...p,
  FilterIDs: p.FilterIDs || [],
  ThresholdIDs: p.ThresholdIDs || [],
});

function formatTTL(ttl: number) {
  return ttl > 0 ? formatDuration(ttl) : `Never expires (${ttl})`;
}

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
  const [usageError, setUsageError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ResourceProfile>(emptyProfile(defaultTenant));
  const [rawJson, setRawJson] = useState('');
  const [dialogTab, setDialogTab] = useState(0);
  const [caching, setCaching] = useState('');
  const idOptions = useIdOptions(['filters', 'thresholds'], tenant, detailOpen && editing);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [rows, setRows] = useState<Record<string, RowInfo>>({});
  const requested = useRef(new Set<string>());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getResourceProfileIDs(baseUrl, tenant) as string[];
      requested.current = new Set();
      setRows({});
      setPage(0);
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  const visibleIds = ids.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  useEffect(() => {
    if (!baseUrl) return;
    const patch = (id: string, info: RowInfo) => setRows(prev => ({ ...prev, [id]: { ...prev[id], ...info } }));
    for (const id of visibleIds) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      api.getResourceProfile(baseUrl, tenant, id)
        .then(p => patch(id, { profile: p as ResourceProfile }))
        .catch((e: unknown) => patch(id, { profileError: errText(e, 'Failed to fetch profile') }));
      api.getResource(baseUrl, tenant, id)
        .then(u => patch(id, { usage: u as ResourceUsage }))
        .catch((e: unknown) => patch(id, { usageError: errText(e, 'Failed to fetch usage') }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, tenant, visibleIds.join('\n')]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const profile = await api.getResourceProfile(baseUrl, tenant, id) as ResourceProfile;
      setDetail(profile);
      setForm(toForm(profile));
      setSelectedId(id);
      setEditing(false);
      setDialogTab(0);
      setDetailOpen(true);
      setUsage(null);
      setUsageError(null);
      api.getResource(baseUrl, tenant, id)
        .then(r => setUsage(r as ResourceUsage))
        .catch((e: unknown) => setUsageError(errText(e, 'Failed to fetch usage')));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const profile = dialogTab === 1 ? JSON.parse(rawJson) as ResourceProfile : form;
      await api.setResourceProfile(baseUrl, { ...profile, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, rawJson, dialogTab, caching, fetchIds]);

  const handleDelete = useCallback(async () => {
    if (!baseUrl || !deleteId) return;
    setDeleting(true);
    try {
      await api.removeResourceProfile(baseUrl, tenant, deleteId, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }, [baseUrl, tenant, deleteId, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setUsage(null);
    setUsageError(null);
    setSelectedId(null);
    setForm(emptyProfile(tenant));
    setDialogTab(0);
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  const updateForm = <K extends keyof ResourceProfile>(field: K, value: ResourceProfile[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const switchTab = (tab: number) => {
    if (tab === 1) {
      setRawJson(JSON.stringify(form, null, 2));
    } else {
      try {
        setForm(toForm(JSON.parse(rawJson)));
      } catch (e: unknown) {
        setError(`Raw JSON is invalid: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    setDialogTab(tab);
  };

  const inUseText = usage ? String(unitsInUse(usage)) : usageError ? 'unknown' : '…';
  const pageUsageErrors = visibleIds.map(id => rows[id]?.usageError).filter((e): e is string => !!e);

  const renderEditForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Tabs value={dialogTab} onChange={(_, v) => switchTab(v)}>
        <Tab label="Fields" />
        <Tab label="Raw JSON" />
      </Tabs>
      {idOptions.error && <Alert severity="warning">{idOptions.error}</Alert>}
      {dialogTab === 0 ? (
        <>
          <TextField label="Tenant" size="small" fullWidth value={form.Tenant} onChange={e => updateForm('Tenant', e.target.value)} />
          <TextField label="ID" size="small" fullWidth value={form.ID} onChange={e => updateForm('ID', e.target.value)} disabled={!!selectedId} />
          <IdMultiSelect label="Filter IDs" value={form.FilterIDs} options={idOptions.get('filters')}
            onChange={v => updateForm('FilterIDs', v)} placeholder="Filter ID or inline *string:~*req.Account:1001" />
          <ActivationIntervalInput value={form.ActivationInterval} onChange={v => updateForm('ActivationInterval', v)} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Usage TTL (0 or negative: usages never expire)</Typography>
            <DurationInput key={selectedId ?? 'new'} value={form.UsageTTL} onChange={raw => updateForm('UsageTTL', raw < 0 ? -1 : raw)} />
          </Box>
          <TextField label="Limit" size="small" fullWidth type="number" inputProps={{ step: 'any' }} value={form.Limit}
            onChange={e => updateForm('Limit', Number(e.target.value))} helperText="Units that can be allocated at once" />
          <TextField label="Allocation message" size="small" fullWidth value={form.AllocationMessage}
            onChange={e => updateForm('AllocationMessage', e.target.value)} helperText="Returned by AuthorizeResources/AllocateResources; empty returns the resource ID" />
          <TextField label="Weight" size="small" fullWidth type="number" value={form.Weight} onChange={e => updateForm('Weight', Number(e.target.value))} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel control={<Checkbox checked={form.Blocker} onChange={e => updateForm('Blocker', e.target.checked)} />} label="Blocker" />
            <FormControlLabel control={<Checkbox checked={form.Stored} onChange={e => updateForm('Stored', e.target.checked)} />} label="Stored" />
          </Box>
          <IdMultiSelect label="Threshold IDs" value={form.ThresholdIDs} options={['*none', ...idOptions.get('thresholds')]}
            onChange={v => updateForm('ThresholdIDs', v)} helperText="Empty checks every matching threshold; *none checks none" />
        </>
      ) : (
        <TextField multiline fullWidth minRows={15} value={rawJson} onChange={e => setRawJson(e.target.value)}
          sx={{ fontFamily: 'monospace' }} />
      )}
    </Box>
  );

  const renderView = (d: ResourceProfile) => (
    <Box sx={{ mt: 1 }}>
      <Typography variant="h6" component="p" sx={{ mb: 2 }}>
        Limit: {d.Limit} · In use: {inUseText}
      </Typography>

      <Typography variant="subtitle1">Current usage</Typography>
      {usageError && <UsageError error={usageError} />}
      {!usage && !usageError && <CircularProgress size={20} sx={{ my: 1 }} />}
      {usage && (
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            In use: {unitsInUse(usage)} of {d.Limit}
            <Typography component="span" variant="body2" color="text.secondary"> (units held by allocations that haven't expired)</Typography>
          </Typography>
          {usage.Usages && Object.keys(usage.Usages).length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usage ID</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Units</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(usage.Usages).map(([uid, u]) => (
                  <TableRow key={uid}>
                    <TableCell sx={{ wordBreak: 'break-all' }}>{uid}</TableCell>
                    <TableCell>
                      {isZeroTime(u.ExpiryTime) ? 'Never' : formatDateTime(u.ExpiryTime)}
                      {!isActive(u.ExpiryTime) && <Typography component="span" variant="body2" color="text.secondary"> (expired, not counted)</Typography>}
                    </TableCell>
                    <TableCell>{u.Units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">No allocations</Typography>
          )}
        </Box>
      )}

      <Typography variant="subtitle1" sx={{ mt: 2 }}>Profile</Typography>
      <Table size="small">
        <TableBody>
          <TableRow><TableCell><strong>Tenant</strong></TableCell><TableCell>{d.Tenant}</TableCell></TableRow>
          <TableRow><TableCell><strong>ID</strong></TableCell><TableCell>{d.ID}</TableCell></TableRow>
          <TableRow><TableCell><strong>Limit</strong></TableCell><TableCell>{d.Limit}</TableCell></TableRow>
          <TableRow><TableCell><strong>Usage TTL</strong></TableCell><TableCell>{formatTTL(d.UsageTTL)}</TableCell></TableRow>
          <TableRow><TableCell><strong>Activation Interval</strong></TableCell><TableCell>{formatActivationInterval(d.ActivationInterval)}</TableCell></TableRow>
          <TableRow><TableCell><strong>Allocation message</strong></TableCell><TableCell>{d.AllocationMessage || '-'}</TableCell></TableRow>
          <TableRow><TableCell><strong>Blocker</strong></TableCell><TableCell>{d.Blocker ? 'Yes' : 'No'}</TableCell></TableRow>
          <TableRow><TableCell><strong>Stored</strong></TableCell><TableCell>{d.Stored ? 'Yes' : 'No'}</TableCell></TableRow>
          <TableRow><TableCell><strong>Weight</strong></TableCell><TableCell>{d.Weight}</TableCell></TableRow>
          <TableRow><TableCell><strong>Filter IDs</strong></TableCell><TableCell>{d.FilterIDs?.join(', ') || 'None'}</TableCell></TableRow>
          <TableRow><TableCell><strong>Threshold IDs</strong></TableCell><TableCell>{d.ThresholdIDs?.join(', ') || 'None'}</TableCell></TableRow>
        </TableBody>
      </Table>

      <Typography variant="subtitle2" sx={{ mt: 2 }}>Raw JSON</Typography>
      <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'action.hover' }}>
        <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify({ Profile: d, Resource: usage }, null, 2)}</pre>
      </Paper>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Resource Profiles</Typography>
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
        methods={[
          'ResourceSv1.GetResourcesForEvent', 'ResourceSv1.AuthorizeResources',
          'ResourceSv1.AllocateResources', 'ResourceSv1.ReleaseResources',
        ]}
        opts={[
          { key: '*rsUsageID', label: 'Usage ID', kind: 'text', helperText: 'Identifies the allocation; empty uses resources opts *usageID' },
          { key: '*rsUnits', label: 'Units', kind: 'number' },
          { key: '*rsUsageTTL', label: 'Usage TTL', kind: 'text', helperText: 'e.g. 30s; overrides the profile UsageTTL' },
        ]}
        initialFields={[['Account', '']]}
        warning="AllocateResources holds the units until ReleaseResources with the same Usage ID or until the usage TTL expires."
        run={(method, args) => api.resourceSEvent(baseUrl!, method, args)}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <>
          {pageUsageErrors.length > 0 && (
            <UsageError error={pageUsageErrors[0]}
              summary={`Failed for ${pageUsageErrors.length} of ${visibleIds.length} resources on this page.`} />
          )}
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell align="right">Limit</TableCell>
                  <TableCell align="right">In use</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleIds.length > 0 ? visibleIds.map((id, idx) => {
                  const r = rows[id];
                  return (
                    <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{id}</TableCell>
                      <TableCell align="right">
                        {r?.profile ? r.profile.Limit
                          : r?.profileError ? <Tooltip title={r.profileError}><span>—</span></Tooltip>
                          : <CircularProgress size={14} aria-label="Loading limit" />}
                      </TableCell>
                      <TableCell align="right">
                        {r?.usage ? unitsInUse(r.usage)
                          : r?.usageError ? <Tooltip title={`Couldn't read current usage: ${r.usageError}`}><span>—</span></Tooltip>
                          : <CircularProgress size={14} aria-label="Loading usage" />}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" aria-label={`Edit ${id}`} onClick={e => { e.stopPropagation(); fetchDetail(id); }}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete…">
                          <IconButton size="small" color="error" aria-label={`Delete ${id}`} onClick={e => { e.stopPropagation(); setDeleteId(id); }}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={5} align="center">No items found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {ids.length > 0 && (
              <TablePagination component="div" count={ids.length} page={page} rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[25, 50, 100]} onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} />
            )}
          </TableContainer>
        </>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New'}</DialogTitle>
        <DialogContent>
          {editing ? renderEditForm() : detail && renderView(detail)}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => { setForm(toForm(detail!)); setDialogTab(0); setEditing(true); }}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => setDeleteId(selectedId)}>Delete…</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <TypedConfirmDialog open={!!deleteId} title="Delete resource profile" expected={deleteId ?? ''}
        confirmLabel="Delete" busy={deleting} onConfirm={handleDelete} onClose={() => setDeleteId(null)}>
        <Typography variant="body2">
          Sends APIerSv1.RemoveResourceProfile for <strong>{deleteId}</strong> on tenant {tenant}. Any current allocations on it are dropped.
        </Typography>
      </TypedConfirmDialog>
    </Box>
  );
}
