import { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField,
  ToggleButton, ToggleButtonGroup, FormControlLabel, Checkbox, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import IdMultiSelect from '../components/IdMultiSelect';
import TpToolbar, { useTpIdList, errMsg, isNotFound } from '../components/TpToolbar';

type Source = 'tp' | 'live';

interface DestForm { TPid: string; ID: string; Prefixes: string[] }

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [source, setSource] = useState<Source>('tp');
  const list = useTpIdList(baseUrl, api.getTPDestinationIDs);
  const [error, setError] = useState<string | null>(null);

  const [live, setLive] = useState<api.LiveDestination[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveFilter, setLiveFilter] = useState('');
  const [reversePrefix, setReversePrefix] = useState('');
  const [reverseResult, setReverseResult] = useState<string | null>(null);

  const [form, setForm] = useState<DestForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const fetchLive = useCallback(async () => {
    if (!baseUrl) return;
    setLiveLoading(true);
    setError(null);
    try {
      setLive(await api.getDestinations(baseUrl) || []);
    } catch (e: unknown) {
      setLive([]);
      if (!isNotFound(e)) setError(errMsg(e, 'Failed to fetch destinations'));
    } finally {
      setLiveLoading(false);
    }
  }, [baseUrl]);

  const changeSource = (s: Source) => {
    setSource(s);
    if (s === 'live' && live === null) fetchLive();
  };

  const shownLive = useMemo(() => {
    const q = liveFilter.trim().toLowerCase();
    const all = [...(live || [])].sort((a, b) => a.Id.localeCompare(b.Id));
    return q ? all.filter(d => d.Id.toLowerCase().includes(q) || d.Prefixes.some(p => p.includes(q))) : all;
  }, [live, liveFilter]);

  const lookupReverse = useCallback(async () => {
    if (!baseUrl || !reversePrefix) return;
    try {
      const ids = await api.getReverseDestination(baseUrl, reversePrefix.trim());
      setReverseResult(ids.length ? ids.join(', ') : 'No destination has this exact prefix');
    } catch (e: unknown) {
      setReverseResult(isNotFound(e) ? 'No destination has this exact prefix' : errMsg(e, 'Lookup failed'));
    }
  }, [baseUrl, reversePrefix]);

  const openTP = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const r = await api.getTPDestination(baseUrl, list.tpid, id) as { TPid: string; ID: string; Prefixes: string[] | null };
      setForm({ TPid: r.TPid, ID: r.ID, Prefixes: r.Prefixes || [] });
      setEditing(false);
      setIsNew(false);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch details'));
    }
  }, [baseUrl, list.tpid]);

  const openLive = (d: api.LiveDestination) => {
    setForm({ TPid: '', ID: d.Id, Prefixes: d.Prefixes || [] });
    setEditing(false);
    setIsNew(false);
    setOverwrite(true);
  };

  const create = () => {
    setForm({ TPid: list.tpid, ID: '', Prefixes: [] });
    setEditing(true);
    setIsNew(true);
    setOverwrite(false);
  };

  const save = useCallback(async () => {
    if (!baseUrl || !form) return;
    if (!form.ID || !form.Prefixes.length || (source === 'tp' && !form.TPid)) {
      setError(source === 'tp' ? 'TPid, ID and at least one prefix are required' : 'ID and at least one prefix are required');
      return;
    }
    try {
      if (source === 'tp') {
        await api.setTPDestination(baseUrl, form.TPid, form.ID, form.Prefixes);
        if (form.TPid === list.tpid) list.refresh(); else list.setTpid(form.TPid);
      } else {
        await api.setDestination(baseUrl, form.ID, form.Prefixes, overwrite);
        fetchLive();
      }
      setForm(null);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, form, source, overwrite, list, fetchLive]);

  const remove = useCallback(async (id: string) => {
    if (!baseUrl) return;
    const where = source === 'tp' ? `tariff plan ${list.tpid}` : 'the live DataDB (affects rating immediately)';
    if (!window.confirm(`Remove destination ${id} from ${where}?`)) return;
    try {
      if (source === 'tp') { await api.removeTPDestination(baseUrl, list.tpid, id); list.refresh(); }
      else { await api.removeDestination(baseUrl, id); fetchLive(); }
      setForm(null);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to remove'));
    }
  }, [baseUrl, source, list, fetchLive]);

  const shownError = error || list.error;
  const loading = source === 'tp' ? list.loading : liveLoading;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Destinations</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_, v) => v && changeSource(v)}>
            <ToggleButton value="tp">Tariff plan (StorDB)</ToggleButton>
            <ToggleButton value="live">Live (DataDB)</ToggleButton>
          </ToggleButtonGroup>
          {source === 'tp' ? (
            <TpToolbar tpids={list.tpids} tpid={list.tpid} onTpid={list.setTpid} search={list.search} onSearch={list.setSearch} onRefresh={list.refresh}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={create}>Create New</Button>
            </TpToolbar>
          ) : (
            <>
              <TextField size="small" label="Filter ID or prefix" value={liveFilter} onChange={e => setLiveFilter(e.target.value)} />
              <Button variant="contained" onClick={fetchLive}>Reload</Button>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={create}>Create New</Button>
            </>
          )}
        </Box>
        {source === 'live' && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 2 }}>
            <TextField size="small" label="Reverse lookup prefix" value={reversePrefix} onChange={e => { setReversePrefix(e.target.value); setReverseResult(null); }}
              onKeyDown={e => { if (e.key === 'Enter') lookupReverse(); }} />
            <Button size="small" onClick={lookupReverse} disabled={!reversePrefix}>Which destinations?</Button>
            {reverseResult && <Typography variant="body2">{reverseResult}</Typography>}
          </Box>
        )}
      </Paper>

      {shownError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); list.setError(null); }}>{shownError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : source === 'tp' ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {list.ids.length > 0 ? list.ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => openTP(id)}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center">{list.tpid ? 'No destinations' : 'Select a tariff plan'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell><TableCell>Prefixes</TableCell></TableRow></TableHead>
            <TableBody>
              {shownLive.length > 0 ? shownLive.map((d, idx) => (
                <TableRow key={d.Id} hover sx={{ cursor: 'pointer' }} onClick={() => openLive(d)}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{d.Id}</TableCell>
                  <TableCell>{(d.Prefixes || []).slice(0, 8).join(', ')}{(d.Prefixes || []).length > 8 ? ` … (${d.Prefixes.length})` : ''}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No destinations in DataDB</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {isNew ? 'New destination' : `Destination ${form?.ID}`}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {source === 'tp' ? `Tariff plan (StorDB)${form?.TPid ? `: ${form.TPid}` : ''}` : 'Live DataDB'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {form && !editing && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>{form.Prefixes.length} prefixes</Typography>
              {form.Prefixes.map(p => <Chip key={p} size="small" label={p} sx={{ fontFamily: 'monospace' }} />)}
            </Box>
          )}
          {form && editing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {source === 'tp' && (
                <TextField size="small" label="TPid" value={form.TPid} onChange={e => setForm({ ...form, TPid: e.target.value })} disabled={!isNew} />
              )}
              <TextField size="small" label="ID" value={form.ID} onChange={e => setForm({ ...form, ID: e.target.value })} disabled={!isNew} />
              <IdMultiSelect label="Prefixes" value={form.Prefixes} options={[]} onChange={v => setForm({ ...form, Prefixes: v })}
                helperText="Type a prefix and press Enter" />
              {source === 'live' && (
                <FormControlLabel control={<Checkbox checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />}
                  label="Overwrite if it exists (otherwise the server answers EXISTS)" />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isNew && form && <Button color="error" onClick={() => remove(form.ID)}>Remove</Button>}
          {editing ? <Button variant="contained" onClick={save}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setForm(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
