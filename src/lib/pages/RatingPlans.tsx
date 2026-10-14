import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField, IconButton,
  ToggleButton, ToggleButtonGroup, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import TpToolbar, { useTpIdList, errMsg, isNotFound } from '../components/TpToolbar';
import { formatDuration } from '../components/BalanceValue';

type Source = 'tp' | 'live';

interface Binding { DestinationRatesId: string; TimingId: string; Weight: number }
interface PlanForm { TPid: string; ID: string; RatingPlanBindings: Binding[] }

/** engine.RatingPlan: destination → [{Timing, Rating, Weight}] keyed into Timings/Ratings. */
interface LivePlan {
  Id: string;
  Timings: Record<string, { ID: string; StartTime: string; EndTime: string; WeekDays: number[] }>;
  Ratings: Record<string, { ConnectFee: number; RoundingMethod: string; RoundingDecimals: number; Rates: { GroupIntervalStart: number; Value: number; RateIncrement: number; RateUnit: number }[] }>;
  DestinationRates: Record<string, { Timing: string; Rating: string; Weight: number }[]>;
}

const emptyBinding = (): Binding => ({ DestinationRatesId: '', TimingId: '*any', Weight: 10 });

function LivePlanView({ plan }: { plan: LivePlan }) {
  const [raw, setRaw] = useState(false);
  const dests = Object.keys(plan.DestinationRates || {}).sort();
  return (
    <Box sx={{ mt: 1 }}>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Destination</TableCell><TableCell>Timing</TableCell><TableCell>Rates</TableCell><TableCell align="right">Weight</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {dests.flatMap(d => plan.DestinationRates[d].map((b, i) => {
            const t = plan.Timings?.[b.Timing];
            const r = plan.Ratings?.[b.Rating];
            return (
              <TableRow key={`${d}-${i}`}>
                <TableCell>{d}</TableCell>
                <TableCell>{t ? `${t.ID} ${t.StartTime}${t.EndTime ? `–${t.EndTime}` : ''}` : b.Timing}</TableCell>
                <TableCell>
                  {r ? r.Rates.map((x, j) => (
                    <div key={j}>{x.Value} / {formatDuration(x.RateUnit)} (step {formatDuration(x.RateIncrement)}, from {formatDuration(x.GroupIntervalStart)})</div>
                  )) : b.Rating}
                  {r && r.ConnectFee ? <div>connect fee {r.ConnectFee}</div> : null}
                </TableCell>
                <TableCell align="right">{b.Weight}</TableCell>
              </TableRow>
            );
          }))}
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Units shown as durations; for *data plans they are bytes.
      </Typography>
      <Button size="small" onClick={() => setRaw(r => !r)} sx={{ mt: 1 }}>{raw ? 'Hide' : 'Show'} raw</Button>
      <Collapse in={raw}>
        <Paper sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(plan, null, 2)}</pre>
        </Paper>
      </Collapse>
    </Box>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [source, setSource] = useState<Source>('tp');
  const list = useTpIdList(baseUrl, api.getTPRatingPlanIds);
  const [error, setError] = useState<string | null>(null);

  const [liveIds, setLiveIds] = useState<string[] | null>(null);
  const [liveSearch, setLiveSearch] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [livePlan, setLivePlan] = useState<LivePlan | null>(null);

  const [form, setForm] = useState<PlanForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [drIds, setDrIds] = useState<string[]>([]);
  const [timingIds, setTimingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!baseUrl || !list.tpid) return;
    Promise.all([api.getTPDestinationRateIds(baseUrl, list.tpid), api.getTPTimingIds(baseUrl, list.tpid)])
      .then(([d, t]) => { setDrIds(d || []); setTimingIds(t || []); })
      .catch(e => setError(errMsg(e, 'Failed to load destination rates/timings')));
  }, [baseUrl, list.tpid]);

  const fetchLive = useCallback(async () => {
    if (!baseUrl) return;
    setLiveLoading(true);
    setError(null);
    try {
      setLiveIds(await api.getRatingPlanIDs(baseUrl, liveSearch.trim() || undefined) || []);
    } catch (e: unknown) {
      setLiveIds([]);
      if (!isNotFound(e)) setError(errMsg(e, 'Failed to fetch rating plans'));
    } finally {
      setLiveLoading(false);
    }
  }, [baseUrl, liveSearch]);

  const changeSource = (s: Source) => {
    setSource(s);
    if (s === 'live' && liveIds === null) fetchLive();
  };

  const openTP = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const r = await api.getTPRatingPlan(baseUrl, list.tpid, id) as PlanForm;
      setForm({ TPid: r.TPid, ID: r.ID, RatingPlanBindings: r.RatingPlanBindings || [] });
      setEditing(false);
      setIsNew(false);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch details'));
    }
  }, [baseUrl, list.tpid]);

  const openLive = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      setLivePlan(await api.getRatingPlan(baseUrl, id) as LivePlan);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch rating plan'));
    }
  }, [baseUrl]);

  const save = useCallback(async () => {
    if (!baseUrl || !form) return;
    if (!form.TPid || !form.ID) { setError('TPid and ID are required'); return; }
    if (!form.RatingPlanBindings.length || form.RatingPlanBindings.some(b => !b.DestinationRatesId || !b.TimingId)) {
      setError('Every binding needs a destination rate and a timing'); return;
    }
    try {
      await api.setTPRatingPlan(baseUrl, form);
      setForm(null);
      if (form.TPid === list.tpid) list.refresh(); else list.setTpid(form.TPid);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, form, list]);

  const remove = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Remove rating plan ${id} from tariff plan ${list.tpid}?`)) return;
    try {
      await api.removeTPRatingPlan(baseUrl, list.tpid, id);
      setForm(null);
      list.refresh();
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to remove'));
    }
  }, [baseUrl, list]);

  const setBinding = (i: number, patch: Partial<Binding>) =>
    setForm(f => f && { ...f, RatingPlanBindings: f.RatingPlanBindings.map((b, j) => j === i ? { ...b, ...patch } : b) });

  const shownError = error || list.error;
  const ids = source === 'tp' ? list.ids : liveIds || [];
  const loading = source === 'tp' ? list.loading : liveLoading;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Rating Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_, v) => v && changeSource(v)}>
            <ToggleButton value="tp">Tariff plan (StorDB)</ToggleButton>
            <ToggleButton value="live">Live (DataDB)</ToggleButton>
          </ToggleButtonGroup>
          {source === 'tp' ? (
            <TpToolbar tpids={list.tpids} tpid={list.tpid} onTpid={list.setTpid} search={list.search} onSearch={list.setSearch} onRefresh={list.refresh}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setForm({ TPid: list.tpid, ID: '', RatingPlanBindings: [emptyBinding()] }); setEditing(true); setIsNew(true); }}>Create New</Button>
            </TpToolbar>
          ) : (
            <>
              <TextField size="small" label="Search ID" value={liveSearch} onChange={e => setLiveSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fetchLive(); }} />
              <Button variant="contained" onClick={fetchLive}>Search</Button>
              <Typography variant="caption" color="text.secondary">Read-only: load a tariff plan to change live rating plans.</Typography>
            </>
          )}
        </Box>
      </Paper>

      {shownError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); list.setError(null); }}>{shownError}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => (source === 'tp' ? openTP(id) : openLive(id))}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center">{source === 'tp' && !list.tpid ? 'Select a tariff plan' : 'No rating plans'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {isNew ? 'New rating plan' : `Rating plan ${form?.ID}`}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Tariff plan (StorDB){form?.TPid ? `: ${form.TPid}` : ''}</Typography>
        </DialogTitle>
        <DialogContent>
          {form && !editing && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Destination rate</TableCell><TableCell>Timing</TableCell><TableCell align="right">Weight</TableCell></TableRow></TableHead>
              <TableBody>
                {form.RatingPlanBindings.map((b, i) => (
                  <TableRow key={i}><TableCell>{b.DestinationRatesId}</TableCell><TableCell>{b.TimingId}</TableCell><TableCell align="right">{b.Weight}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {form && editing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="TPid" value={form.TPid} onChange={e => setForm({ ...form, TPid: e.target.value })} disabled={!isNew} />
                <TextField size="small" label="ID" value={form.ID} onChange={e => setForm({ ...form, ID: e.target.value })} disabled={!isNew} sx={{ flex: 1 }} />
              </Box>
              {form.RatingPlanBindings.map((b, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <SearchableSelect label="Destination rate" value={b.DestinationRatesId} options={drIds} onChange={v => setBinding(i, { DestinationRatesId: v })} sx={{ minWidth: 260, flex: 1 }} />
                  <SearchableSelect label="Timing" value={b.TimingId} options={['*any', ...timingIds]} onChange={v => setBinding(i, { TimingId: v })} sx={{ minWidth: 200 }} />
                  <TextField size="small" type="number" label="Weight" value={b.Weight} onChange={e => setBinding(i, { Weight: parseFloat(e.target.value) || 0 })} sx={{ width: 100 }} />
                  <IconButton size="small" color="error" disabled={form.RatingPlanBindings.length <= 1}
                    onClick={() => setForm({ ...form, RatingPlanBindings: form.RatingPlanBindings.filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Box><Button size="small" startIcon={<AddIcon />} onClick={() => setForm({ ...form, RatingPlanBindings: [...form.RatingPlanBindings, emptyBinding()] })}>Add binding</Button></Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isNew && form && <Button color="error" onClick={() => remove(form.ID)}>Remove</Button>}
          {editing ? <Button variant="contained" onClick={save}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setForm(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!livePlan} onClose={() => setLivePlan(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Rating plan {livePlan?.Id}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Live DataDB</Typography>
        </DialogTitle>
        <DialogContent>{livePlan && <LivePlanView plan={livePlan} />}</DialogContent>
        <DialogActions><Button onClick={() => setLivePlan(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
