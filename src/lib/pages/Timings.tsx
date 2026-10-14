import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import IdMultiSelect, { splitIds, joinIds } from '../components/IdMultiSelect';
import TpToolbar, { useTpIdList, errMsg } from '../components/TpToolbar';

interface TimingForm {
  TPid: string;
  ID: string;
  Years: string[];
  Months: string[];
  MonthDays: string[];
  WeekDays: string[];
  StartTime: string;
  EndTime: string;
}

const thisYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => String(thisYear - 2 + i));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MONTHDAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));
// utils.WeekDays: 0 (or 7) is Sunday.
const WEEKDAY_OPTIONS = ['1', '2', '3', '4', '5', '6', '0'];

/** "*any" (or empty) means no restriction, shown as an empty selection. */
const fromTP = (s: string) => splitIds(s).filter(v => v !== '*any');
const toTP = (vals: string[]) => (vals.length ? joinIds(vals) : '*any');

const show = (vals: string[]) => (vals.length ? vals.join(', ') : '*any');

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const list = useTpIdList(baseUrl, api.getTPTimingIds);
  const [detail, setDetail] = useState<TimingForm | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testNowResult, setTestNowResult] = useState<boolean | null>(null);
  const [testNowOpen, setTestNowOpen] = useState(false);
  const [testTimeOpen, setTestTimeOpen] = useState(false);
  const [testTimeValue, setTestTimeValue] = useState('');
  const [testTimeResult, setTestTimeResult] = useState<boolean | null>(null);
  const [testTimingId, setTestTimingId] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const r = await api.getTPTiming(baseUrl, list.tpid, id) as Record<string, string>;
      const [startTime, endTime] = (r.Time || '').split(';');
      setDetail({
        TPid: r.TPid, ID: r.ID,
        Years: fromTP(r.Years), Months: fromTP(r.Months), MonthDays: fromTP(r.MonthDays), WeekDays: fromTP(r.WeekDays),
        StartTime: startTime || '', EndTime: endTime || '',
      });
      setEditing(false);
      setIsNew(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch details'));
    }
  }, [baseUrl, list.tpid]);

  const handleSave = useCallback(async () => {
    if (!baseUrl || !detail) return;
    if (!detail.TPid || !detail.ID) { setError('TPid and ID are required'); return; }
    if (!detail.StartTime) { setError('Start Time is required'); return; }
    try {
      await api.setTPTiming(baseUrl, {
        TPid: detail.TPid,
        ID: detail.ID,
        Years: toTP(detail.Years),
        Months: toTP(detail.Months),
        MonthDays: toTP(detail.MonthDays),
        WeekDays: toTP(detail.WeekDays),
        Time: detail.EndTime ? `${detail.StartTime};${detail.EndTime}` : detail.StartTime,
      });
      setDetailOpen(false);
      if (detail.TPid === list.tpid) list.refresh();
      else list.setTpid(detail.TPid);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, detail, list]);

  const handleRemove = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Remove timing ${id} from tariff plan ${list.tpid}?`)) return;
    try {
      await api.removeTPTiming(baseUrl, list.tpid, id);
      setDetailOpen(false);
      list.refresh();
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to remove'));
    }
  }, [baseUrl, list]);

  const handleCreate = () => {
    setDetail({ TPid: list.tpid, ID: '', Years: [], Months: [], MonthDays: [], WeekDays: [], StartTime: '00:00:00', EndTime: '' });
    setEditing(true);
    setIsNew(true);
    setDetailOpen(true);
  };

  const set = <K extends keyof TimingForm>(field: K, value: TimingForm[K]) => setDetail(prev => prev ? { ...prev, [field]: value } : null);

  const handleTestNow = useCallback(async (timingId: string) => {
    if (!baseUrl) return;
    setTestLoading(true);
    setTestNowResult(null);
    try {
      setTestNowResult(await api.timingIsActiveAt(baseUrl, timingId, '*now'));
      setTestNowOpen(true);
    } catch (e: unknown) {
      setError(errMsg(e, 'Test failed'));
    } finally {
      setTestLoading(false);
    }
  }, [baseUrl]);

  const handleTestSpecificTime = useCallback(async () => {
    if (!baseUrl || !testTimingId || !testTimeValue) return;
    setTestLoading(true);
    setTestTimeResult(null);
    try {
      setTestTimeResult(await api.timingIsActiveAt(baseUrl, testTimingId, testTimeValue));
    } catch (e: unknown) {
      setError(errMsg(e, 'Test failed'));
    } finally {
      setTestLoading(false);
    }
  }, [baseUrl, testTimingId, testTimeValue]);

  const shownError = error || list.error;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Timings</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <TpToolbar tpids={list.tpids} tpid={list.tpid} onTpid={list.setTpid} search={list.search} onSearch={list.setSearch} onRefresh={list.refresh}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </TpToolbar>
      </Paper>

      {shownError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); list.setError(null); }}>{shownError}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        The list and editor work on the StorDB tariff plan. The Test buttons use TimingIsActiveAt, which only sees timings already loaded into DataDB.
      </Typography>

      {list.loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>Timing ID</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {list.ids.length > 0 ? list.ids.map((id, idx) => (
                <TableRow key={id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>{id}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleTestNow(id)} sx={{ mr: 1 }}>Test Now (DataDB)</Button>
                    <Button size="small" onClick={() => { setTestTimingId(id); setTestTimeValue(''); setTestTimeResult(null); setTestTimeOpen(true); }} sx={{ mr: 1 }}>Test Time (DataDB)</Button>
                    <Button size="small" color="error" onClick={() => handleRemove(id)}>Remove</Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">{list.tpid ? 'No timings' : 'Select a tariff plan'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isNew ? 'New Timing' : editing ? 'Edit Timing' : 'Timing Details'}{detail?.ID ? ` - ${detail.ID}` : ''}</DialogTitle>
        <DialogContent>
          {detail && !editing && (
            <Table size="small"><TableBody>
              {([
                ['TPid', detail.TPid], ['Years', show(detail.Years)], ['Months', show(detail.Months)],
                ['Month days', show(detail.MonthDays)], ['Week days', show(detail.WeekDays)],
                ['Start time', detail.StartTime || '-'], ['End time', detail.EndTime || '-'],
              ] as [string, string][]).map(([k, v]) => (
                <TableRow key={k}><TableCell sx={{ fontWeight: 600 }}>{k}</TableCell><TableCell>{v}</TableCell></TableRow>
              ))}
            </TableBody></Table>
          )}
          {detail && editing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField size="small" label="TPid" value={detail.TPid} onChange={e => set('TPid', e.target.value)} disabled={!isNew}
                helperText={isNew ? 'A new TPid creates a new tariff plan' : undefined} />
              <TextField size="small" label="ID" value={detail.ID} onChange={e => set('ID', e.target.value)} disabled={!isNew} />
              <IdMultiSelect label="Years" value={detail.Years} options={YEAR_OPTIONS} onChange={v => set('Years', v)} placeholder="*any" />
              <IdMultiSelect label="Months" value={detail.Months} options={MONTH_OPTIONS} onChange={v => set('Months', v)} placeholder="*any" />
              <IdMultiSelect label="Month days" value={detail.MonthDays} options={MONTHDAY_OPTIONS} onChange={v => set('MonthDays', v)} placeholder="*any" />
              <IdMultiSelect label="Week days" value={detail.WeekDays} options={WEEKDAY_OPTIONS} onChange={v => set('WeekDays', v)} placeholder="*any"
                helperText="1 = Monday … 6 = Saturday, 0 = Sunday. Empty saves *any." />
              <TextField size="small" label="Start Time" value={detail.StartTime} onChange={e => set('StartTime', e.target.value)} placeholder="HH:MM:SS" />
              <TextField size="small" label="End Time" value={detail.EndTime} onChange={e => set('EndTime', e.target.value)} placeholder="HH:MM:SS (optional)" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isNew && detail && <Button color="error" onClick={() => handleRemove(detail.ID)}>Remove</Button>}
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={testNowOpen} onClose={() => setTestNowOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Timing Test Result (DataDB)</DialogTitle>
        <DialogContent>
          <Typography align="center" sx={{ py: 2, fontSize: 18 }}>
            {testNowResult !== null ? `Timing active = ${testNowResult}` : 'No result yet.'}
          </Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setTestNowOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={testTimeOpen} onClose={() => setTestTimeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Test Timing at Specific Time (DataDB)</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Date/Time" placeholder="YYYY-MM-DDTHH:mm:ssZ" value={testTimeValue}
            onChange={e => setTestTimeValue(e.target.value)} sx={{ mt: 1 }} />
          {testLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>}
          {testTimeResult !== null && (
            <Typography align="center" sx={{ py: 2 }}>Timing active = {String(testTimeResult)}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleTestSpecificTime} disabled={!testTimeValue || testLoading}>Test</Button>
          <Button onClick={() => setTestTimeOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
