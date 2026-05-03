import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Autocomplete, Checkbox, FormControlLabel,
  Collapse,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Account } from '../types';

interface CategoryOption {
  label: string;
  value: string;
}

const defaultCategories: CategoryOption[] = [
  { label: 'SMS', value: 'sms' },
  { label: 'Data', value: 'data' },
  { label: 'Call', value: 'call' },
];

const usagePresets: Record<string, number[]> = {
  sms: [1, 2, 3],
  sms_a2p: [1, 2, 3],
  data: [1, 1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 * 1024 * 1024],
  call: [1e9, 10e9, 60e9, 600e9],
  default: [1, 10, 100, 1000],
};

const usageLabels: Record<string, string[]> = {
  sms: ['1', '2', '3'],
  sms_a2p: ['1', '2', '3'],
  data: ['1 Byte', '1 MB', '10 MB', '100 MB', '1 GB'],
  call: ['1 second', '10 seconds', '1 minute', '10 minutes'],
  default: ['1', '10', '100', '1000'],
};

interface ProcessingFlags {
  ProcessStatQueues: boolean;
  ProcessThresholds: boolean;
  ReleaseResources: boolean;
  AllocateResources: boolean;
  AuthorizeResources: boolean;
  GetSuppliers: boolean;
  GetAttributes: boolean;
  GetMaxUsage: boolean;
}

let globalRequestId = 3;

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);

  // Account search
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [accountInputValue, setAccountInputValue] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  const [direction, setDirection] = useState('*out');
  const [category, setCategory] = useState(defaultCategories[0]?.value || 'sms');
  const [tor, setTor] = useState('');
  const [destination, setDestination] = useState('');
  const [subject, setSubject] = useState('');
  const [usage, setUsage] = useState<number>(usagePresets[defaultCategories[0]?.value || 'sms']?.[0] ?? 1);
  const [requestType, setRequestType] = useState('*prepaid');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const [flags, setFlags] = useState<ProcessingFlags>({
    ProcessStatQueues: false,
    ProcessThresholds: false,
    ReleaseResources: false,
    AllocateResources: false,
    AuthorizeResources: false,
    GetSuppliers: false,
    GetAttributes: true,
    GetMaxUsage: true,
  });

  const currentPresets = usagePresets[category] || usagePresets.default;
  const currentLabels = usageLabels[category] || usageLabels.default;

  const requestTypes = ['*prepaid', '*postpaid', '*rated'];

  // Fetch accounts for autocomplete
  useEffect(() => {
    if (!baseUrl || !tenant) return;
    setAccountLoading(true);
    api.getAccounts(baseUrl, tenant, 0, 200)
      .then((data) => {
        const accounts = data as Account[];
        if (Array.isArray(accounts)) {
          setAccountOptions(accounts.map(a => a.ID.replace(`${tenant}:`, '')));
        } else {
          setAccountOptions([]);
        }
      })
      .catch(() => setAccountOptions([]))
      .finally(() => setAccountLoading(false));
  }, [baseUrl, tenant]);

  // Clear state when tenant changes
  useEffect(() => {
    setAccount(null);
    setSubject('');
    setTor('');
    setResult(null);
    setAccountInputValue('');
  }, [tenant]);

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    const presets = usagePresets[value] || usagePresets.default;
    setUsage(presets[0]);
  };

  const handleFlagChange = (key: keyof ProcessingFlags) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const requestObject = useMemo(() => {
    return {
      method: 'SessionSv1.ProcessCDR',
      params: [
        {
          Tenant: tenant,
          ...flags,
          Event: {
            OriginHost: 'OmniWeb',
            OriginID: crypto.randomUUID(),
            Direction: direction,
            Category: category,
            ...(tor ? { ToR: tor } : {}),
            Destination: destination,
            Source: 'OmniWeb',
            Subject: subject || account || '',
            RequestType: requestType,
            Account: account || '',
            Tenant: tenant,
            Usage: usage,
            AnswerTime: '*now',
            SetupTime: '*now',
          },
        },
      ],
      id: globalRequestId,
    };
  }, [tenant, flags, direction, category, tor, destination, subject, requestType, account, usage]);

  const handleSubmit = useCallback(async () => {
    if (!baseUrl || !account) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const req = {
      ...requestObject,
      params: requestObject.params.map(p => ({
        ...p,
        Event: {
          ...p.Event,
          OriginID: crypto.randomUUID(),
        },
      })),
      id: globalRequestId++,
    };

    try {
      const r = await api.processCDR(baseUrl, req.params[0]);
      setResult(r as Record<string, unknown>);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, account, requestObject]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Charge Tester</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        {/* Row 1: Tenant + Account */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Autocomplete
            size="small"
            sx={{ minWidth: 250 }}
            options={accountOptions}
            loading={accountLoading}
            value={account}
            onChange={(_e, newValue) => setAccount(newValue)}
            inputValue={accountInputValue}
            onInputChange={(_e, newInputValue) => setAccountInputValue(newInputValue)}
            renderInput={(params) => (
              <TextField {...params} label="Account" placeholder="Search accounts..." />
            )}
            freeSolo={false}
          />
        </Box>

        {/* Row 2: Direction, Usage, Request Type */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Direction</InputLabel>
            <Select value={direction} label="Direction" onChange={e => setDirection(e.target.value)}>
              <MenuItem value="*out">*out</MenuItem>
              <MenuItem value="*in">*in</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Usage</InputLabel>
            <Select value={usage} label="Usage" onChange={e => setUsage(Number(e.target.value))}>
              {currentPresets.map((val, idx) => (
                <MenuItem key={idx} value={val}>
                  {val} ({currentLabels[idx]})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select value={requestType} label="Type" onChange={e => setRequestType(e.target.value)}>
              {requestTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Row 3: Category, ToR, Subject */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={e => handleCategoryChange(e.target.value)}>
              {defaultCategories.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="ToR" value={tor} onChange={e => setTor(e.target.value)} sx={{ minWidth: 120 }} />
          <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)} sx={{ minWidth: 150 }} />
        </Box>

        {/* Row 4: Destination */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} fullWidth />
        </Box>

        {/* Row 5: Processing Flags */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {(Object.keys(flags) as Array<keyof ProcessingFlags>).map(key => (
            <FormControlLabel
              key={key}
              control={<Checkbox size="small" checked={flags[key]} onChange={() => handleFlagChange(key)} />}
              label={key}
              sx={{ mr: 2 }}
            />
          ))}
        </Box>

        {/* Submit */}
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !account}>
          {loading ? <CircularProgress size={20} /> : 'Submit CDR'}
        </Button>
      </Paper>

      {/* Show/Hide Request JSON */}
      <Button
        variant="text"
        onClick={() => setShowRequest(!showRequest)}
        sx={{ mb: 1 }}
      >
        {showRequest ? 'Hide Request JSON' : 'Show Request JSON'}
      </Button>
      <Collapse in={showRequest}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>Request:</Typography>
          <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(requestObject, null, 2)}
          </pre>
        </Paper>
      </Collapse>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle1">Response</Typography>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );
}
