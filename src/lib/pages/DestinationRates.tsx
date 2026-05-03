import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  Collapse, IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';

interface DestRateEntry {
  DestinationId: string;
  RateId: string;
  RoundingMethod: string;
  RoundingDecimals: number;
  MaxCost: number;
  MaxCostStrategy: string;
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [tpids, setTpids] = useState<string[]>([]);
  const [selectedTpid, setSelectedTpid] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedDest, setExpandedDest] = useState<Record<string, unknown> | null>(null);
  const [expandedRate, setExpandedRate] = useState<Record<string, unknown> | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedType, setExpandedType] = useState<'dest' | 'rate' | null>(null);
  const [subLoading, setSubLoading] = useState(false);

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
      const result = await api.getTPDestinationRateIds(baseUrl, selectedTpid) as string[];
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
      const result = await api.getTPDestinationRate(baseUrl, selectedTpid, id);
      setDetail(result);
      setExpandedRow(null);
      setExpandedDest(null);
      setExpandedRate(null);
      setExpandedType(null);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, selectedTpid]);

  const fetchDestinationDetail = useCallback(async (destId: string, rowIdx: number) => {
    if (!baseUrl) return;
    if (expandedRow === rowIdx && expandedType === 'dest') {
      setExpandedRow(null);
      setExpandedType(null);
      return;
    }
    setSubLoading(true);
    try {
      const result = await api.getTPDestination(baseUrl, selectedTpid, destId);
      setExpandedDest(result as Record<string, unknown>);
      setExpandedRow(rowIdx);
      setExpandedType('dest');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch destination details');
    } finally {
      setSubLoading(false);
    }
  }, [baseUrl, selectedTpid, expandedRow, expandedType]);

  const fetchRateDetail = useCallback(async (rateId: string, rowIdx: number) => {
    if (!baseUrl) return;
    if (expandedRow === rowIdx && expandedType === 'rate') {
      setExpandedRow(null);
      setExpandedType(null);
      return;
    }
    setSubLoading(true);
    try {
      const result = await api.getTPRate(baseUrl, selectedTpid, rateId);
      setExpandedRate(result as Record<string, unknown>);
      setExpandedRow(rowIdx);
      setExpandedType('rate');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch rate details');
    } finally {
      setSubLoading(false);
    }
  }, [baseUrl, selectedTpid, expandedRow, expandedType]);

  const renderDetailTable = () => {
    const d = detail as Record<string, unknown> | null;
    if (!d) return null;
    const rates = (d.DestinationRates as DestRateEntry[]) || [];
    return (
      <Box sx={{ mt: 1 }}>
        {d.TPid != null && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>TPid:</strong> {d.TPid as string} &nbsp; <strong>ID:</strong> {d.ID as string}
          </Typography>
        )}
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
                <>
                  <TableRow key={i} hover>
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => fetchDestinationDetail(r.DestinationId, i)}
                        endIcon={expandedRow === i && expandedType === 'dest' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                      >
                        {r.DestinationId}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => fetchRateDetail(r.RateId, i)}
                        endIcon={expandedRow === i && expandedType === 'rate' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                      >
                        {r.RateId}
                      </Button>
                    </TableCell>
                    <TableCell>{r.RoundingMethod}</TableCell>
                    <TableCell>{r.RoundingDecimals}</TableCell>
                    <TableCell>{r.MaxCost}</TableCell>
                    <TableCell>{r.MaxCostStrategy}</TableCell>
                  </TableRow>
                  <TableRow key={`expand-${i}`}>
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
                </>
              )) : (
                <TableRow><TableCell colSpan={6} align="center">No destination rates</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Destination Rates</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>TPID</InputLabel>
            <Select value={selectedTpid} label="TPID" onChange={e => setSelectedTpid(e.target.value)}>
              {tpids.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchIds} disabled={!selectedTpid}>Search</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>ID</TableCell></TableRow></TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                  <TableCell>{idx + 1}</TableCell><TableCell>{id}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={2} align="center">No results</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Destination Rate Details</DialogTitle>
        <DialogContent>
          {renderDetailTable()}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
