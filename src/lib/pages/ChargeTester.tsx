import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';


export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('call');
  const [destination, setDestination] = useState('');
  const [usage, setUsage] = useState('1');
  const [requestType, setRequestType] = useState('*prepaid');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!baseUrl || !account) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.processCDR(baseUrl, { Tenant: tenant, Event: { OriginHost: 'OmniWeb', OriginID: crypto.randomUUID(), Category: category, Destination: destination, Source: 'OmniWeb', Subject: account, RequestType: requestType, Account: account, Tenant: tenant, Usage: Number(usage), AnswerTime: '*now', SetupTime: '*now' } });
      setResult(r as Record<string, unknown>);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, account, category, destination, usage, requestType]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Charge Tester</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Tenant</InputLabel><Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>{tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} />
          <TextField size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)} />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <TextField size="small" label="Usage" value={usage} onChange={e => setUsage(e.target.value)} />
          <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>Type</InputLabel><Select value={requestType} label="Type" onChange={e => setRequestType(e.target.value)}><MenuItem value="*prepaid">*prepaid</MenuItem><MenuItem value="*postpaid">*postpaid</MenuItem><MenuItem value="*rated">*rated</MenuItem></Select></FormControl>
          <Button variant="contained" onClick={handleSubmit} disabled={loading || !account}>{loading ? <CircularProgress size={20} /> : 'Submit CDR'}</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && <Paper sx={{ p: 2, bgcolor: 'grey.50' }}><Typography variant="subtitle1">Response</Typography><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre></Paper>}
    </Box>
  );
}
