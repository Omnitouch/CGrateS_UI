import { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { CDR } from '../types';

function formatNsToHMS(ns: number): string {
  const totalSeconds = Math.floor(ns / 1e9);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatUsage(usage: number, tor: string): string {
  if (tor === '*data') return `${(usage / (1024*1024)).toFixed(2)} MB`;
  if (tor === '*voice') return formatNsToHMS(usage);
  return String(usage);
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [limit, setLimit] = useState(50);
  const [results, setResults] = useState<CDR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedCDR, setSelectedCDR] = useState<CDR | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchCDRs = useCallback(async (off = 0) => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    const params: Record<string, unknown> = { Limit: limit, Offset: off };
    if (tenant) params.Tenants = [tenant];
    if (account) params.Accounts = account.split(',').map(a => a.trim());
    if (destination) params.DestinationPrefixes = destination.split(',').map(d => d.trim());
    try {
      const data = await api.getCDRs(baseUrl, params) as CDR[];
      setResults(data || []);
      setOffset(off);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch CDRs');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant, account, destination, limit]);

  const categoryTotals = useMemo(() => {
    const acc: Record<string, { cost: number; count: number }> = {};
    for (const r of results) {
      const cat = r.Category || 'unknown';
      if (!acc[cat]) acc[cat] = { cost: 0, count: 0 };
      if (r.Cost >= 0) acc[cat].cost += r.Cost;
      acc[cat].count++;
    }
    return acc;
  }, [results]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>CDRs</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} placeholder="Comma-separated" />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Prefix" />
          <TextField size="small" label="Limit" type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 50)} sx={{ width: 100 }} />
          <Button variant="contained" onClick={() => fetchCDRs(0)}>Search</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Setup Time</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Destination</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.length > 0 ? results.map((cdr, idx) => (
                  <TableRow key={idx} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedCDR(cdr); setDetailOpen(true); }}>
                    <TableCell>{offset + idx + 1}</TableCell>
                    <TableCell>{new Date(cdr.SetupTime).toLocaleString()}</TableCell>
                    <TableCell>{cdr.Account}</TableCell>
                    <TableCell>{cdr.Category}</TableCell>
                    <TableCell>{cdr.Destination}</TableCell>
                    <TableCell>{cdr.Cost}</TableCell>
                    <TableCell>{formatUsage(cdr.Usage, cdr.ToR)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} align="center">No CDRs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Button disabled={offset === 0} onClick={() => fetchCDRs(Math.max(0, offset - limit))}>Previous</Button>
            <Button disabled={results.length < limit} onClick={() => fetchCDRs(offset + limit)}>Next</Button>
          </Box>

          {results.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1">Totals by Category</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Count</TableCell><TableCell>Total Cost</TableCell></TableRow></TableHead>
                <TableBody>
                  {Object.entries(categoryTotals).map(([cat, v]) => (
                    <TableRow key={cat}><TableCell>{cat}</TableCell><TableCell>{v.count}</TableCell><TableCell>{v.cost.toFixed(4)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>CDR Details</DialogTitle>
        <DialogContent>
          {selectedCDR && (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(selectedCDR, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
