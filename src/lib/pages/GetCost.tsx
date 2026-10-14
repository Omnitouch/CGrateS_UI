import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, CircularProgress, Alert, MenuItem, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { BalanceValueInput, formatBalanceValue } from '../components/BalanceValue';
import { toLocalInput } from '../components/ActivationIntervalInput';
import { TORS, REQUEST_TYPES } from '../cgrConsts';

type Mode = 'cost' | 'data' | 'maxusage';

const MODE_HELP: Record<Mode, string> = {
  cost: 'APIerSv1.GetCost: rates a call by destination without touching any account.',
  data: 'APIerSv1.GetDataCost: rates *data usage (bytes) for the subject; no destination.',
  maxusage: 'APIerSv1.GetMaxUsage: how much the account can use now. Empty fields take the server defaults.',
};

const nowLocal = () => toLocalInput(new Date().toISOString());

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [mode, setMode] = useState<Mode>('cost');
  const [tenant, setTenant] = useState(defaultTenant);
  const [category, setCategory] = useState('call');
  const [subject, setSubject] = useState('');
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [tor, setTor] = useState('*voice');
  const [requestType, setRequestType] = useState('');
  const [usage, setUsage] = useState(60e9);
  const [answerTime, setAnswerTime] = useState(nowLocal);
  const [apiOpts, setApiOpts] = useState('{}');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Usage units follow the ToR: ns for *voice, bytes for *data.
  const usageTor = mode === 'data' ? '*data' : mode === 'maxusage' ? tor : '*voice';

  const changeMode = (m: Mode) => {
    setMode(m);
    setResult(null);
    if (m === 'data') { setCategory('data'); setUsage(1024 ** 2); }
    if (m === 'cost') { setCategory('call'); setUsage(60e9); }
    if (m === 'maxusage') { setCategory('call'); changeTor('*voice'); }
  };

  const changeTor = (t: string) => {
    setTor(t);
    setUsage(t === '*voice' ? 60e9 : t === '*data' ? 1024 ** 2 : 1);
  };

  const fetchCost = useCallback(async () => {
    if (!baseUrl) return;
    let opts: Record<string, unknown>;
    try {
      opts = JSON.parse(apiOpts || '{}');
      if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) throw new Error();
    } catch { setError('APIOpts must be a JSON object'); return; }
    if (mode !== 'maxusage' && !answerTime) { setError('Answer time is required'); return; }
    const at = answerTime ? new Date(answerTime).toISOString() : '';
    setLoading(true); setError(null); setResult(null);
    try {
      if (mode === 'cost') {
        // A bare number is read as nanoseconds, so always send the unit.
        setResult(await api.getCost(baseUrl, {
          Tenant: tenant, Category: category, Subject: subject, Destination: destination,
          AnswerTime: at, Usage: `${usage}ns`, APIOpts: opts,
        }));
      } else if (mode === 'data') {
        setResult(await api.getDataCost(baseUrl, {
          Tenant: tenant, Category: category, Subject: subject, AnswerTime: at, Usage: usage, Opts: opts,
        }));
      } else {
        const params: Record<string, unknown> = {
          Tenant: tenant, ToR: tor, Category: category, Account: account, Subject: subject, Destination: destination,
          Usage: tor === '*voice' ? `${usage}ns` : String(usage), APIOpts: opts,
        };
        if (requestType) params.RequestType = requestType;
        if (at) { params.SetupTime = at; params.AnswerTime = at; }
        const max = await api.getMaxUsage(baseUrl, params);
        setResult({ MaxUsage: max, Readable: max === -1 ? 'unlimited' : formatBalanceValue(max, tor) });
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [baseUrl, mode, tenant, category, subject, account, destination, tor, requestType, usage, answerTime, apiOpts]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Get Cost</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && changeMode(v)} sx={{ mb: 1 }}>
          <ToggleButton value="cost">GetCost</ToggleButton>
          <ToggleButton value="data">GetDataCost</ToggleButton>
          <ToggleButton value="maxusage">GetMaxUsage</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{MODE_HELP[mode]}</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          {mode === 'maxusage' && (
            <>
              <TextField select size="small" label="ToR" value={tor} onChange={e => changeTor(e.target.value)} sx={{ minWidth: 130 }}>
                {TORS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Request type" value={requestType} onChange={e => setRequestType(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value=""><em>Server default</em></MenuItem>
                {REQUEST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} />
            </>
          )}
          <TextField size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)} />
          <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)}
            helperText={mode === 'maxusage' ? 'Empty uses the account' : undefined} />
          {mode !== 'data' && <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />}
          <TextField size="small" label={mode === 'maxusage' ? 'Setup/answer time' : 'Answer time'} type="datetime-local" value={answerTime}
            onChange={e => setAnswerTime(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }}
            helperText={mode === 'maxusage' ? 'Empty means *now' : undefined} />
          <BalanceValueInput key={usageTor} value={usage} balanceType={usageTor} onChange={setUsage} sx={{ minWidth: 260 }} />
          <TextField size="small" label={mode === 'data' ? 'Opts (JSON)' : 'APIOpts (JSON)'} value={apiOpts} onChange={e => setApiOpts(e.target.value)}
            sx={{ minWidth: 260 }} />
          <Button variant="contained" onClick={fetchCost} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Fetch'}</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result !== null && <Paper sx={{ p: 2, bgcolor: 'grey.50' }}><Typography variant="subtitle1">Result</Typography><pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre></Paper>}
    </Box>
  );
}
