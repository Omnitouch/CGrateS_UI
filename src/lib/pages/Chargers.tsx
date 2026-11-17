import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  TextField, List, ListItem, ListItemText, Divider, Chip, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ChargerProfile } from '../types';
import IdMultiSelect from '../components/IdMultiSelect';
import { CachingAdvanced, cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import TenantPicker from '../components/TenantPicker';
import RowActionsMenu from '../components/RowActionsMenu';
import TypedDeleteDialog from '../components/TypedDeleteDialog';
import { FilterIdsText } from '../components/FilterText';
import { describeFilterId } from '../filterText';
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

// engine/chargers.go: a lone *none skips AttributeS; an empty list lets AttributeS pick by its own filters.
function AttributesText({ ids }: { ids: string[] | null | undefined }) {
  if (!ids?.length) return <Typography variant="body2" color="text.secondary" component="span">Any matching</Typography>;
  if (ids.length === 1 && ids[0] === '*none') return <span title="*none">None (AttributeS skipped)</span>;
  return <>{ids.map(id => <Box key={id} sx={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{id}</Box>)}</>;
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [profiles, setProfiles] = useState<ChargerProfile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChargerProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<ChargerProfile>(emptyCharger(defaultTenant));
  const [caching, setCaching] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const idOptions = useIdOptions(['filters', 'attributes'], tenant, detailOpen && editing);

  const fetchProfiles = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const ids = await api.getChargerProfileIDs(baseUrl, tenant) || [];
      setProfiles(await Promise.all(ids.map(id => api.getChargerProfile(baseUrl, tenant, id) as Promise<ChargerProfile>)));
    } catch (e: unknown) {
      setProfiles([]);
      if (!api.isNotFound(e)) setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const openProfile = (p: ChargerProfile, edit: boolean) => {
    setDetail(p);
    setEditData(JSON.parse(JSON.stringify(p)));
    setSelectedId(p.ID);
    setEditing(edit);
    setCaching('');
    setDetailOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setChargerProfile(baseUrl, { ...editData, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchProfiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, caching, fetchProfiles]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl) return;
    setDeleting(true);
    try {
      await api.removeChargerProfile(baseUrl, tenant, id, cachingOpts(caching));
      setDeleteId(null);
      setDetailOpen(false);
      fetchProfiles();
    } catch (e: unknown) {
      setDeleteId(null);
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }, [baseUrl, tenant, caching, fetchProfiles]);

  const askDelete = (id: string) => { setCaching(''); setDeleteId(id); };

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditData(emptyCharger(tenant));
    setEditing(true);
    setCaching('');
    setDetailOpen(true);
  }, [tenant]);

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 1 }}>
        <Typography variant="h5">Charger Profiles</Typography>
        {profiles && <Typography variant="body2" color="text.secondary">{profiles.length} {profiles.length === 1 ? 'charger' : 'chargers'}</Typography>}
      </Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TenantPicker value={tenant} onChange={setTenant} />
          <Box sx={{ flex: 1 }} />
          <EventTester
            tenant={tenant}
            methods={['ChargerSv1.GetChargersForEvent', 'ChargerSv1.ProcessEvent']}
            opts={[{ key: '*context', label: 'Attribute context', kind: 'text', options: CONTEXTS, helperText: 'ProcessEvent passes this to AttributeS' }]}
            initialFields={[['Account', ''], ['Destination', '']]}
            run={(method, args) => api.chargerSEvent(baseUrl!, method, args)}
            layout="drawer"
            title="Test which charger matches…"
            readOnlyNote="GetChargersForEvent lists the matching profiles. ProcessEvent also runs each one's attribute profiles and returns the forked events. Neither stores anything; filters or attributes of type *http# still call their URL."
          />
          {!!profiles?.length && <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>}
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading || profiles === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : profiles.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>No charger profiles for {tenant}. Without one, ChargerS does not fork events for rating.</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell title="RunID">Run</TableCell>
                <TableCell title="FilterIDs">Applies when</TableCell>
                <TableCell title="AttributeIDs">Attributes</TableCell>
                <TableCell align="right">Weight</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.map(p => (
                <TableRow key={p.ID} hover sx={{ cursor: 'pointer', verticalAlign: 'top' }} onClick={() => openProfile(p, false)}>
                  <TableCell sx={{ fontWeight: 500, wordBreak: 'break-word' }}>{p.ID}</TableCell>
                  <TableCell><Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{p.RunID}</Box></TableCell>
                  <TableCell><FilterIdsText ids={p.FilterIDs} /></TableCell>
                  <TableCell><AttributesText ids={p.AttributeIDs} /></TableCell>
                  <TableCell align="right">{p.Weight}</TableCell>
                  <TableCell padding="checkbox">
                    <RowActionsMenu id={p.ID} onEdit={() => openProfile(p, true)} onDelete={() => askDelete(p.ID)} />
                  </TableCell>
                </TableRow>
              ))}
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
              <CachingAdvanced value={caching} onChange={setCaching} />
            </Box>
          ) : (
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
                  <Typography variant="body2" fontWeight={600}>Applies when (FilterIDs)</Typography>
                  <Box sx={{ mt: 0.5 }}><FilterIdsText ids={detail.FilterIDs} /></Box>
                  {detail.FilterIDs?.some(describeFilterId) && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {detail.FilterIDs.map((fid, i) => <Chip key={i} label={fid} size="small" variant="outlined" />)}
                    </Box>
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
          {selectedId && <Button color="error" onClick={() => askDelete(selectedId)} sx={{ mr: 'auto' }}>Delete…</Button>}
          <Button onClick={() => setDetailOpen(false)}>{editing ? 'Cancel' : 'Close'}</Button>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button variant="contained" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </DialogActions>
      </Dialog>

      <TypedDeleteDialog id={deleteId} kind="charger profile" busy={deleting} caching={caching} onCaching={setCaching}
        onConfirm={handleDelete} onClose={() => setDeleteId(null)} />
    </Box>
  );
}
