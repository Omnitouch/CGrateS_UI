import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [tpids, setTpids] = useState<string[]>([]);
  const [selectedTpid, setSelectedTpid] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Test timing modals
  const [testNowResult, setTestNowResult] = useState<boolean | null>(null);
  const [testNowOpen, setTestNowOpen] = useState(false);
  const [testTimeOpen, setTestTimeOpen] = useState(false);
  const [testTimeValue, setTestTimeValue] = useState('');
  const [testTimeResult, setTestTimeResult] = useState<boolean | null>(null);
  const [testTimingId, setTestTimingId] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const fetchTpids = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const result = await api.getTPIds(baseUrl);
      setTpids(result || []);
    } catch { setTpids([]); }
  }, [baseUrl]);

  useState(() => { fetchTpids(); });

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !selectedTpid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTPTimingIds(baseUrl, selectedTpid) as string[];
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, selectedTpid]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getTiming(baseUrl, selectedTpid, id) as Record<string, unknown>;
      // Parse Time field or use StartTime/EndTime
      let startTime = '*any';
      let endTime = '*any';
      if (result.StartTime && result.EndTime) {
        startTime = String(result.StartTime);
        endTime = String(result.EndTime);
      } else if (result.Time) {
        const [start, end] = String(result.Time).split(';');
        startTime = start || '*any';
        endTime = end || '*any';
      }
      setDetail({
        ID: String(result.ID || ''),
        Years: result.Years && Array.isArray(result.Years) && (result.Years as string[]).length > 0 ? (result.Years as string[]).join(',') : String(result.Years || '*any'),
        Months: result.Months && Array.isArray(result.Months) && (result.Months as string[]).length > 0 ? (result.Months as string[]).join(',') : String(result.Months || '*any'),
        MonthDays: result.MonthDays && Array.isArray(result.MonthDays) && (result.MonthDays as string[]).length > 0 ? (result.MonthDays as string[]).join(',') : String(result.MonthDays || '*any'),
        WeekDays: result.WeekDays && Array.isArray(result.WeekDays) && (result.WeekDays as string[]).length > 0 ? (result.WeekDays as string[]).join(',') : String(result.WeekDays || '*any'),
        StartTime: startTime,
        EndTime: endTime,
      });
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, selectedTpid]);

  const handleSave = useCallback(async () => {
    if (!baseUrl || !detail) return;
    try {
      const combinedTime = `${detail.StartTime || '*any'};${detail.EndTime || '*any'}`;
      await api.setTPTiming(baseUrl, {
        TPid: selectedTpid,
        ID: detail.ID,
        Years: detail.Years || '*any',
        Months: detail.Months || '*any',
        MonthDays: detail.MonthDays || '*any',
        WeekDays: detail.WeekDays || '*any',
        Time: combinedTime,
      });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, detail, selectedTpid, fetchIds]);

  const handleCreate = () => {
    setDetail({
      ID: '', Years: '*any', Months: '*any', MonthDays: '*any',
      WeekDays: '*any', StartTime: '*any', EndTime: '*any',
    });
    setEditing(true);
    setDetailOpen(true);
  };

  const handleEditChange = (field: string, value: string) => {
    setDetail(prev => prev ? { ...prev, [field]: value } : null);
  };

  // Test Now
  const handleTestNow = useCallback(async (timingId: string) => {
    if (!baseUrl) return;
    setTestLoading(true);
    setTestNowResult(null);
    try {
      const result = await api.timingIsActiveAt(baseUrl, timingId, '*now');
      setTestNowResult(result);
      setTestNowOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestLoading(false);
    }
  }, [baseUrl]);

  // Test Specific Time
  const handleTestSpecificTime = useCallback(async () => {
    if (!baseUrl || !testTimingId || !testTimeValue) return;
    setTestLoading(true);
    setTestTimeResult(null);
    try {
      const result = await api.timingIsActiveAt(baseUrl, testTimingId, testTimeValue);
      setTestTimeResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestLoading(false);
    }
  }, [baseUrl, testTimingId, testTimeValue]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Timings</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>TPID</InputLabel>
            <Select value={selectedTpid} label="TPID" onChange={e => setSelectedTpid(e.target.value)}>
              {tpids.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchIds} disabled={!selectedTpid}>Search</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>Timing ID</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>{id}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleTestNow(id)} sx={{ mr: 1 }}>Test Now</Button>
                    <Button size="small" onClick={() => { setTestTimingId(id); setTestTimeValue(''); setTestTimeResult(null); setTestTimeOpen(true); }}>Test Time</Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No results</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Timing Detail/Edit Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Timing' : 'Timing Details'}{detail?.ID ? ` - ${detail.ID}` : ''}</DialogTitle>
        <DialogContent>
          {detail && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField size="small" label="ID" value={detail.ID} onChange={e => handleEditChange('ID', e.target.value)} disabled={!editing} />
              <TextField size="small" label="Years" value={detail.Years} onChange={e => handleEditChange('Years', e.target.value)} disabled={!editing} />
              <TextField size="small" label="Months" value={detail.Months} onChange={e => handleEditChange('Months', e.target.value)} disabled={!editing} />
              <TextField size="small" label="Month Days" value={detail.MonthDays} onChange={e => handleEditChange('MonthDays', e.target.value)} disabled={!editing} />
              <TextField size="small" label="Week Days" value={detail.WeekDays} onChange={e => handleEditChange('WeekDays', e.target.value)} disabled={!editing} />
              <TextField size="small" label="Start Time" value={detail.StartTime} onChange={e => handleEditChange('StartTime', e.target.value)} disabled={!editing} placeholder="e.g. 08:00:00" />
              <TextField size="small" label="End Time" value={detail.EndTime} onChange={e => handleEditChange('EndTime', e.target.value)} disabled={!editing} placeholder="e.g. 17:00:00" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Test Now Result Dialog */}
      <Dialog open={testNowOpen} onClose={() => setTestNowOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Timing Test Result</DialogTitle>
        <DialogContent>
          <Typography align="center" sx={{ py: 2, fontSize: 18 }}>
            {testNowResult !== null ? `Timing active = ${testNowResult}` : 'No result yet.'}
          </Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setTestNowOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Test Specific Time Dialog */}
      <Dialog open={testTimeOpen} onClose={() => setTestTimeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Test Timing at Specific Time</DialogTitle>
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
