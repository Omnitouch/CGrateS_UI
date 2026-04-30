import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [requestText, setRequestText] = useState('{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "CoreSv1.Ping",\n  "params": [{}]\n}');
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<string | null>(null);

  const handleFormat = useCallback(() => {
    try { setRequestText(JSON.stringify(JSON.parse(requestText), null, 2)); setError(null); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Invalid JSON'); }
  }, [requestText]);

  const handleSend = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null); setResponseText('');
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(requestText); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Invalid JSON'); setLoading(false); return; }
    const start = Date.now();
    try { const r = await api.executeJsonRpc(baseUrl, payload); setResponseText(JSON.stringify(r, null, 2)); setExecTime(((Date.now() - start) / 1000).toFixed(3)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setLoading(false); }
  }, [baseUrl, requestText]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Execute JSON-RPC</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Endpoint: {baseUrl}/jsonrpc {execTime && <Chip label={`${execTime}s`} size="small" sx={{ ml: 1 }} />}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Request</Typography>
        <TextField multiline fullWidth minRows={10} value={requestText} onChange={e => setRequestText(e.target.value)} sx={{ fontFamily: 'monospace', mb: 1 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={handleFormat}>Format</Button>
          <Button variant="contained" onClick={handleSend} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Send'}</Button>
        </Box>
      </Paper>
      {responseText && <Paper sx={{ p: 2, bgcolor: 'grey.50' }}><Typography variant="subtitle2" gutterBottom>Response</Typography><pre style={{ fontSize: 12, margin: 0, maxHeight: 500, overflow: 'auto' }}>{responseText}</pre></Paper>}
    </Box>
  );
}
