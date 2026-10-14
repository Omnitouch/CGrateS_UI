import { Fragment, useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  Collapse, IconButton, Tabs, Tab, TextField, MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import TpToolbar, { useTpIdList, errMsg } from '../components/TpToolbar';

interface DestRateEntry {
  DestinationId: string;
  RateId: string;
  RoundingMethod: string;
  RoundingDecimals: number;
  MaxCost: number;
  MaxCostStrategy: string;
}

interface RateSlot {
  ConnectFee: number;
  Rate: number;
  RateUnit: string;
  RateIncrement: string;
  GroupIntervalStart: string;
}

interface DRForm { TPid: string; ID: string; DestinationRates: DestRateEntry[] }
interface RateForm { TPid: string; ID: string; RateSlots: RateSlot[] }

// utils.ROUNDING_* and MetaMaxCostFree / MetaMaxCostDisconnect.
const ROUNDING_METHODS = ['*up', '*middle', '*down'];
const MAX_COST_STRATEGIES = ['', '*free', '*disconnect'];

const emptyDR = (): DestRateEntry => ({ DestinationId: '', RateId: '', RoundingMethod: '*up', RoundingDecimals: 4, MaxCost: 0, MaxCostStrategy: '' });
const emptySlot = (): RateSlot => ({ ConnectFee: 0, Rate: 0, RateUnit: '60s', RateIncrement: '60s', GroupIntervalStart: '0s' });

type Tab = 'dr' | 'rate';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [tab, setTab] = useState<Tab>('dr');
  const drList = useTpIdList(baseUrl, api.getTPDestinationRateIds);
  const rateList = useTpIdList(baseUrl, api.getTPRateIds);
  const list = tab === 'dr' ? drList : rateList;
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<DRForm | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedDest, setExpandedDest] = useState<Record<string, unknown> | null>(null);
  const [expandedRate, setExpandedRate] = useState<Record<string, unknown> | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedType, setExpandedType] = useState<'dest' | 'rate' | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  const [drForm, setDrForm] = useState<DRForm | null>(null);
  const [rateForm, setRateForm] = useState<RateForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [destIds, setDestIds] = useState<string[]>([]);
  const [rateIds, setRateIds] = useState<string[]>([]);

  // Keep both tabs on the same tariff plan.
  const setTpid = (v: string) => { drList.setTpid(v); rateList.setTpid(v); };
  const tpid = drList.tpid;

  const loadRefs = useCallback(async (forTpid: string) => {
    if (!baseUrl || !forTpid) return;
    try {
      const [d, r] = await Promise.all([api.getTPDestinationIDs(baseUrl, forTpid), api.getTPRateIds(baseUrl, forTpid)]);
      setDestIds(d || []);
      setRateIds(r || []);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to load destinations/rates'));
    }
  }, [baseUrl]);

  useEffect(() => { loadRefs(tpid); }, [tpid, loadRefs]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getTPDestinationRate(baseUrl, tpid, id) as DRForm;
      setDetail(result);
      setExpandedRow(null);
      setExpandedDest(null);
      setExpandedRate(null);
      setExpandedType(null);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch details'));
    }
  }, [baseUrl, tpid]);

  const openRate = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const r = await api.getTPRate(baseUrl, tpid, id) as RateForm;
      setRateForm({ TPid: r.TPid, ID: r.ID, RateSlots: r.RateSlots || [] });
      setIsNew(false);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch rate'));
    }
  }, [baseUrl, tpid]);

  const fetchDestinationDetail = useCallback(async (destId: string, rowIdx: number) => {
    if (!baseUrl) return;
    if (expandedRow === rowIdx && expandedType === 'dest') {
      setExpandedRow(null);
      setExpandedType(null);
      return;
    }
    setSubLoading(true);
    try {
      const result = await api.getTPDestination(baseUrl, tpid, destId);
      setExpandedDest(result as Record<string, unknown>);
      setExpandedRow(rowIdx);
      setExpandedType('dest');
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch destination details'));
    } finally {
      setSubLoading(false);
    }
  }, [baseUrl, tpid, expandedRow, expandedType]);

  const fetchRateDetail = useCallback(async (rateId: string, rowIdx: number) => {
    if (!baseUrl) return;
    if (expandedRow === rowIdx && expandedType === 'rate') {
      setExpandedRow(null);
      setExpandedType(null);
      return;
    }
    setSubLoading(true);
    try {
      const result = await api.getTPRate(baseUrl, tpid, rateId);
      setExpandedRate(result as Record<string, unknown>);
      setExpandedRow(rowIdx);
      setExpandedType('rate');
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch rate details'));
    } finally {
      setSubLoading(false);
    }
  }, [baseUrl, tpid, expandedRow, expandedType]);

  const afterSave = (savedTpid: string, l: typeof drList) => {
    if (savedTpid === tpid) { l.refresh(); loadRefs(tpid); } else setTpid(savedTpid);
  };

  const saveDR = useCallback(async () => {
    if (!baseUrl || !drForm) return;
    if (!drForm.TPid || !drForm.ID) { setError('TPid and ID are required'); return; }
    if (!drForm.DestinationRates.length || drForm.DestinationRates.some(r => !r.DestinationId || !r.RateId)) {
      setError('Every row needs a destination and a rate'); return;
    }
    try {
      await api.setTPDestinationRate(baseUrl, drForm);
      setDrForm(null);
      setDetailOpen(false);
      afterSave(drForm.TPid, drList);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, drForm]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRate = useCallback(async () => {
    if (!baseUrl || !rateForm) return;
    if (!rateForm.TPid || !rateForm.ID || !rateForm.RateSlots.length) { setError('TPid, ID and at least one slot are required'); return; }
    try {
      await api.setTPRate(baseUrl, rateForm);
      setRateForm(null);
      afterSave(rateForm.TPid, rateList);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, rateForm]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(async (kind: Tab, id: string) => {
    if (!baseUrl || !window.confirm(`Remove ${kind === 'dr' ? 'destination rate' : 'rate'} ${id} from tariff plan ${tpid}?`)) return;
    try {
      if (kind === 'dr') { await api.removeTPDestinationRate(baseUrl, tpid, id); drList.refresh(); setDetailOpen(false); setDrForm(null); }
      else { await api.removeTPRate(baseUrl, tpid, id); rateList.refresh(); loadRefs(tpid); setRateForm(null); }
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to remove'));
    }
  }, [baseUrl, tpid, drList, rateList, loadRefs]);

  const create = () => {
    setIsNew(true);
    if (tab === 'dr') setDrForm({ TPid: tpid, ID: '', DestinationRates: [emptyDR()] });
    else setRateForm({ TPid: tpid, ID: '', RateSlots: [emptySlot()] });
  };

  const setDRRow = (i: number, patch: Partial<DestRateEntry>) =>
    setDrForm(f => f && { ...f, DestinationRates: f.DestinationRates.map((r, j) => j === i ? { ...r, ...patch } : r) });
  const setSlot = (i: number, patch: Partial<RateSlot>) =>
    setRateForm(f => f && { ...f, RateSlots: f.RateSlots.map((s, j) => j === i ? { ...s, ...patch } : s) });

  const renderDetailTable = () => {
    const d = detail;
    if (!d) return null;
    const rates = d.DestinationRates || [];
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>TPid:</strong> {d.TPid} &nbsp; <strong>ID:</strong> {d.ID}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>DestinationId</TableCell>
                <TableCell>RateId</TableCell>
                <TableCell>RoundingMethod</TableCell>
                <TableCell>RoundingDecimals</TableCell>
                <TableCell>MaxCost</TableCell>
                <TableCell>MaxCostStrategy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rates.length > 0 ? rates.map((r, i) => (
                <Fragment key={i}>
                  <TableRow hover>
                    <TableCell>
                      <Button size="small" variant="text" onClick={() => fetchDestinationDetail(r.DestinationId, i)}
                        endIcon={expandedRow === i && expandedType === 'dest' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}>
                        {r.DestinationId}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="text" onClick={() => fetchRateDetail(r.RateId, i)}
                        endIcon={expandedRow === i && expandedType === 'rate' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}>
                        {r.RateId}
                      </Button>
                    </TableCell>
                    <TableCell>{r.RoundingMethod}</TableCell>
                    <TableCell>{r.RoundingDecimals}</TableCell>
                    <TableCell>{r.MaxCost}</TableCell>
                    <TableCell>{r.MaxCostStrategy || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0, borderBottom: expandedRow === i ? undefined : 'none' }}>
                      <Collapse in={expandedRow === i} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1, px: 2 }}>
                          {subLoading ? (
                            <CircularProgress size={20} />
                          ) : expandedType === 'dest' && expandedDest ? (
                            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                              <Typography variant="subtitle2" gutterBottom>Destination: {r.DestinationId}</Typography>
                              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(expandedDest, null, 2)}</pre>
                            </Paper>
                          ) : expandedType === 'rate' && expandedRate ? (
                            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                              <Typography variant="subtitle2" gutterBottom>Rate: {r.RateId}</Typography>
                              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(expandedRate, null, 2)}</pre>
                            </Paper>
                          ) : null}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )) : (
                <TableRow><TableCell colSpan={6} align="center">No destination rates</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const shownError = error || drList.error || rateList.error;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Destination Rates</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <TpToolbar tpids={drList.tpids} tpid={tpid} onTpid={setTpid} search={list.search} onSearch={list.setSearch} onRefresh={list.refresh}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={create}>Create New</Button>
        </TpToolbar>
      </Paper>

      {shownError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); drList.setError(null); rateList.setError(null); }}>{shownError}</Alert>}

      <Tabs value={tab} onChange={(_, v) => { setTab(v); if (v === 'rate' && tpid && !rateList.ids.length) rateList.refresh(); }} sx={{ mb: 1 }}>
        <Tab value="dr" label="Destination rates" />
        <Tab value="rate" label="Rates" />
      </Tabs>

      {list.loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {list.ids.length > 0 ? list.ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => (tab === 'dr' ? fetchDetail(id) : openRate(id))}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center">{tpid ? 'No results' : 'Select a tariff plan'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Destination Rate Details</DialogTitle>
        <DialogContent>{renderDetailTable()}</DialogContent>
        <DialogActions>
          {detail && <Button color="error" onClick={() => remove('dr', detail.ID)}>Remove</Button>}
          {detail && <Button onClick={() => { setIsNew(false); setDrForm({ TPid: detail.TPid, ID: detail.ID, DestinationRates: (detail.DestinationRates || []).map(r => ({ ...emptyDR(), ...r })) }); setDetailOpen(false); }}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!drForm} onClose={() => setDrForm(null)} maxWidth="lg" fullWidth>
        <DialogTitle>{isNew ? 'New destination rate' : `Edit ${drForm?.ID}`}</DialogTitle>
        <DialogContent>
          {drForm && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="TPid" value={drForm.TPid} onChange={e => setDrForm({ ...drForm, TPid: e.target.value })} disabled={!isNew} />
                <TextField size="small" label="ID" value={drForm.ID} onChange={e => setDrForm({ ...drForm, ID: e.target.value })} disabled={!isNew} sx={{ flex: 1 }} />
              </Box>
              {drForm.DestinationRates.map((r, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <SearchableSelect label="Destination" value={r.DestinationId} options={destIds} onChange={v => setDRRow(i, { DestinationId: v })} sx={{ minWidth: 220 }} />
                  <SearchableSelect label="Rate" value={r.RateId} options={rateIds} onChange={v => setDRRow(i, { RateId: v })} sx={{ minWidth: 220 }} />
                  <TextField select size="small" label="Rounding" value={r.RoundingMethod} onChange={e => setDRRow(i, { RoundingMethod: e.target.value })} sx={{ width: 120 }}>
                    {ROUNDING_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField size="small" type="number" label="Decimals" value={r.RoundingDecimals} onChange={e => setDRRow(i, { RoundingDecimals: parseInt(e.target.value) || 0 })} sx={{ width: 100 }} />
                  <TextField size="small" type="number" label="Max cost" value={r.MaxCost} onChange={e => setDRRow(i, { MaxCost: parseFloat(e.target.value) || 0 })} sx={{ width: 110 }} />
                  <TextField select size="small" label="Max cost strategy" value={r.MaxCostStrategy} onChange={e => setDRRow(i, { MaxCostStrategy: e.target.value })} sx={{ width: 160 }}>
                    {MAX_COST_STRATEGIES.map(m => <MenuItem key={m} value={m}>{m || <em>none</em>}</MenuItem>)}
                  </TextField>
                  <IconButton size="small" color="error" disabled={drForm.DestinationRates.length <= 1}
                    onClick={() => setDrForm({ ...drForm, DestinationRates: drForm.DestinationRates.filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Box><Button size="small" startIcon={<AddIcon />} onClick={() => setDrForm({ ...drForm, DestinationRates: [...drForm.DestinationRates, emptyDR()] })}>Add row</Button></Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={saveDR}>Save</Button>
          <Button onClick={() => setDrForm(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rateForm} onClose={() => setRateForm(null)} maxWidth="md" fullWidth>
        <DialogTitle>{isNew ? 'New rate' : `Rate ${rateForm?.ID}`}</DialogTitle>
        <DialogContent>
          {rateForm && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="TPid" value={rateForm.TPid} onChange={e => setRateForm({ ...rateForm, TPid: e.target.value })} disabled={!isNew} />
                <TextField size="small" label="ID" value={rateForm.ID} onChange={e => setRateForm({ ...rateForm, ID: e.target.value })} disabled={!isNew} sx={{ flex: 1 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">Durations take units (60s, 1m, 1h); for *data a bare number of bytes works too.</Typography>
              {rateForm.RateSlots.map((s, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField size="small" type="number" label="Connect fee" value={s.ConnectFee} onChange={e => setSlot(i, { ConnectFee: parseFloat(e.target.value) || 0 })} sx={{ width: 110 }} />
                  <TextField size="small" type="number" label="Rate" value={s.Rate} onChange={e => setSlot(i, { Rate: parseFloat(e.target.value) || 0 })} sx={{ width: 110 }} />
                  <TextField size="small" label="Rate unit" value={s.RateUnit} onChange={e => setSlot(i, { RateUnit: e.target.value })} sx={{ width: 110 }} />
                  <TextField size="small" label="Increment" value={s.RateIncrement} onChange={e => setSlot(i, { RateIncrement: e.target.value })} sx={{ width: 110 }} />
                  <TextField size="small" label="From (group start)" value={s.GroupIntervalStart} onChange={e => setSlot(i, { GroupIntervalStart: e.target.value })} sx={{ width: 140 }} />
                  <IconButton size="small" color="error" disabled={rateForm.RateSlots.length <= 1}
                    onClick={() => setRateForm({ ...rateForm, RateSlots: rateForm.RateSlots.filter((_, j) => j !== i) })}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              ))}
              <Box><Button size="small" startIcon={<AddIcon />} onClick={() => setRateForm({ ...rateForm, RateSlots: [...rateForm.RateSlots, emptySlot()] })}>Add slot</Button></Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isNew && rateForm && <Button color="error" onClick={() => remove('rate', rateForm.ID)}>Remove</Button>}
          <Button variant="contained" onClick={saveRate}>Save</Button>
          <Button onClick={() => setRateForm(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
