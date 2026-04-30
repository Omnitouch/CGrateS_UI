import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { RouteResult } from '../types';


export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [results, setResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try {
      const r = await api.getRoutes(baseUrl, { IgnoreErrors: true, Tenant: tenant, ID: 'OmniWeb', Event: { Account: account, Tenant: tenant, Subject: account, SetupTime: new Date().toISOString().slice(0, 19), Destination: destination, Usage: '1m' } }) as RouteResult[];
      setResults(r || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setResults([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, account, destination]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Route Lookup</Typography>
      <Paper sx={{ p: 2, mb: 2 }}><Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} />
        <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
        <Button variant="contained" onClick={fetchRoutes}>Search</Button>
      </Box></Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>Profile ID</TableCell><TableCell>Sorting</TableCell><TableCell>Routes</TableCell></TableRow></TableHead><TableBody>
          {results.length > 0 ? results.map((r, i) => (<TableRow key={i}><TableCell>{r.ProfileID}</TableCell><TableCell>{r.Sorting}</TableCell><TableCell>{r.Routes?.map(rt => `${rt.RouteID} (cost: ${rt.SortingData?.Cost})`).join(', ')}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} align="center">No results</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}
    </Box>
  );
}
