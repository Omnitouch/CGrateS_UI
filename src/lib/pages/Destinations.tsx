import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField,
  FormControlLabel, Checkbox, Chip, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import IdMultiSelect from '../components/IdMultiSelect';
import TpToolbar, { useTpIdList, errMsg, isNotFound } from '../components/TpToolbar';
import RatingSourceToggle, { useRatingSource, SOURCE_LABEL } from '../components/RatingSource';
import RemoveConfirm, { DangerFooter } from '../components/RemoveConfirm';

interface DestForm { TPid: string; ID: string; Prefixes: string[] }

const CHIP_LIMIT = 8;

function PrefixChips({ prefixes, highlight }: { prefixes: string[]; highlight?: Set<string> }) {
  const [open, setOpen] = useState(false);
  const hit = (p: string) => !!highlight?.has(p);
  // Matched prefixes stay visible while collapsed.
  const shown = open ? prefixes : [...prefixes.filter(hit), ...prefixes.filter(p => !hit(p))].slice(0, Math.max(CHIP_LIMIT, prefixes.filter(hit).length));
  const more = prefixes.length - shown.length;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} onClick={e => e.stopPropagation()}>
      {shown.map(p => (
        <Chip key={p} size="small" label={p} color={hit(p) ? 'primary' : 'default'} variant={hit(p) ? 'filled' : 'outlined'} sx={{ fontFamily: 'monospace' }} />
      ))}
      {more > 0 && <Chip size="small" label={`+${more} more`} onClick={() => setOpen(true)} sx={{ fontWeight: 600 }} />}
      {open && prefixes.length > CHIP_LIMIT && <Chip size="small" label="Show fewer" onClick={() => setOpen(false)} variant="outlined" />}
    </Box>
  );
}

/** The query as typed, plus number forms without separators and without a leading +, since prefixes are matched literally. */
function queryForms(q: string) {
  const forms = new Set([q]);
  if (/^[+\d\s\-().]+$/.test(q)) {
    const n = q.replace(/[\s\-().]/g, '');
    forms.add(n);
    forms.add(n.replace(/^\+/, ''));
  }
  forms.delete('');
  return [...forms];
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [source, setSource] = useRatingSource();
  const list = useTpIdList(baseUrl, api.getTPDestinationIDs);
  const [error, setError] = useState<string | null>(null);

  const [live, setLive] = useState<api.LiveDestination[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [query, setQuery] = useState('');

  const [form, setForm] = useState<DestForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => { if (source === 'live' && live === null) fetchLive(); }, [source, live, fetchLive]);

  // GetReverseDestination only answers exact prefixes, so numbers are matched here the way the engine walks them: longest prefix first.
  const search = useMemo(() => {
    const q = query.trim();
    const all = [...(live || [])].sort((a, b) => a.Id.localeCompare(b.Id));
    if (!q) return { rows: all, hits: new Map<string, Set<string>>(), best: [] as string[], bestPrefix: '' };
    const forms = queryForms(q);
    const lower = q.toLowerCase();
    const covers = (p: string) => forms.some(f => f.startsWith(p));
    const hits = new Map<string, Set<string>>();
    let bestPrefix = '';
    for (const d of all) {
      const m = (d.Prefixes || []).filter(p => covers(p) || forms.some(f => p.startsWith(f)));
      if (m.length) hits.set(d.Id, new Set(m));
      for (const p of d.Prefixes || []) if (covers(p) && p.length > bestPrefix.length) bestPrefix = p;
    }
    const best = bestPrefix ? all.filter(d => d.Prefixes?.includes(bestPrefix)).map(d => d.Id) : [];
    const longestCovering = (d: api.LiveDestination) => Math.max(0, ...(d.Prefixes || []).filter(covers).map(p => p.length));
    const rows = all.filter(d => hits.has(d.Id) || d.Id.toLowerCase().includes(lower))
      .sort((a, b) => longestCovering(b) - longestCovering(a));
    return { rows, hits, best, bestPrefix };
  }, [live, query]);

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

  const remove = useCallback(async () => {
    if (!baseUrl || !removing) return;
    setBusy(true);
    try {
      if (source === 'tp') { await api.removeTPDestination(baseUrl, list.tpid, removing); list.refresh(); }
      else { await api.removeDestination(baseUrl, removing); fetchLive(); }
      setRemoving(null);
      setForm(null);
    } catch (e: unknown) {
      setRemoving(null);
      setError(errMsg(e, 'Failed to remove'));
    } finally {
      setBusy(false);
    }
  }, [baseUrl, source, list, fetchLive, removing]);

  const shownError = error || list.error;
  const loading = source === 'tp' ? list.loading : liveLoading;
  const q = query.trim();

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Destinations</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <RatingSourceToggle value={source} onChange={setSource} />
          {source === 'tp' ? (
            <TpToolbar tpids={list.tpids} tpid={list.tpid} onTpid={list.setTpid} search={list.search} onSearch={list.setSearch} onRefresh={list.refresh}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={create}>Create New</Button>
            </TpToolbar>
          ) : (
            <>
              <TextField size="small" placeholder="Name, prefix or phone number" value={query} onChange={e => setQuery(e.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 320 } }} aria-label="Search destinations"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
              <Button variant="outlined" onClick={fetchLive}>Reload</Button>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={create}>Create New</Button>
            </>
          )}
        </Box>
        {source === 'live' && q && live && (
          <Typography variant="body2" sx={{ mt: 1.5 }} color="text.secondary">
            {search.bestPrefix
              ? <>Longest prefix for <b>{q}</b> is <b style={{ fontFamily: 'monospace' }}>{search.bestPrefix}</b>, in {search.best.join(', ')}.{search.rows.length > search.best.length && ' Rating uses the longest prefix the rating plan has a rate for, so the other matches below can still apply.'}</>
              : `${search.rows.length} of ${live.length} destinations match`}
          </Typography>
        )}
      </Paper>

      {shownError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); list.setError(null); }}>{shownError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : source === 'tp' ? (
        <TableContainer component={Paper} sx={{ maxWidth: 900 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {list.ids.length > 0 ? list.ids.map(id => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => openTP(id)}>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell align="center">{list.tpid ? 'No destinations' : 'Select a tariff plan'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper} sx={{ maxWidth: 1400 }}>
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead><TableRow>
              <TableCell sx={{ width: { xs: 140, sm: 260 } }}>ID</TableCell><TableCell>Prefixes</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {search.rows.length > 0 ? search.rows.map(d => {
                const isBest = search.best.includes(d.Id);
                return (
                  <TableRow key={d.Id} hover selected={isBest} sx={{ cursor: 'pointer', verticalAlign: 'top' }} onClick={() => openLive(d)}>
                    <TableCell sx={{ wordBreak: 'break-word', fontWeight: isBest ? 600 : undefined }}>
                      {d.Id}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {(d.Prefixes || []).length} prefix{(d.Prefixes || []).length === 1 ? '' : 'es'}{isBest ? ' · best match' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell><PrefixChips key={q} prefixes={d.Prefixes || []} highlight={search.hits.get(d.Id)} /></TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={2} align="center">{q ? `Nothing matches “${q}”` : 'No destinations in DataDB'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {isNew ? 'New destination' : `Destination ${form?.ID}`}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {SOURCE_LABEL[source]}{source === 'tp' && form?.TPid ? `: ${form.TPid}` : ''}
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
        <DangerFooter onRemove={!isNew && form ? () => setRemoving(form.ID) : undefined}>
          <Button onClick={() => setForm(null)}>Close</Button>
          {editing ? <Button variant="contained" onClick={save}>Save</Button> : <Button variant="contained" onClick={() => setEditing(true)}>Edit</Button>}
        </DangerFooter>
      </Dialog>

      <RemoveConfirm id={removing} what="destination" busy={busy} onConfirm={remove} onClose={() => setRemoving(null)}
        where={source === 'tp' ? `tariff plan ${list.tpid}` : 'the live DataDB (affects rating immediately)'} />
    </Box>
  );
}
