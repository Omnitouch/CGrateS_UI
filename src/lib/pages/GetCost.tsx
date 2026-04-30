import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';


export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [category, setCategory] = useState('call');
  const [subject, setSubject] = useState('');
  const [destination, setDestination] = useState('');
  const [usage, setUsage] = useState('60');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.getCost(baseUrl, { Tenant: tenant, Category: category, Subject: subject, AnswerTime: new Date().toISOString(), Destination: destination, Usage: usage, APIOpts: {} });
      setResult(r as Record<string, unknown>);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, category, subject, destination, usage]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Get Cost</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
          <TextField size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)} />
          <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <TextField size="small" label="Usage (seconds)" value={usage} onChange={e => setUsage(e.target.value)} />
          <Button variant="contained" onClick={fetchCost} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Fetch Cost'}</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && <Paper sx={{ p: 2, bgcolor: 'grey.50' }}><Typography variant="subtitle1">Cost Result</Typography><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre></Paper>}
    </Box>
  );
}
