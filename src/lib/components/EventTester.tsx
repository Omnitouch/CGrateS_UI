import { useState, type ReactNode } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Checkbox,
  CircularProgress, FormControlLabel, IconButton, MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import IdMultiSelect from './IdMultiSelect';
import type { CGREventArgs } from '../types';

export interface OptSpec {
  /** APIOpts key, e.g. *attrProfileIDs */
  key: string;
  label: string;
  kind: 'ids' | 'bool' | 'number' | 'text';
  options?: string[];
  helperText?: string;
}

interface EventTesterProps<M extends string> {
  tenant: string;
  methods: M[];
  opts: OptSpec[];
  initialFields: [string, string][];
  run: (method: M, args: CGREventArgs) => Promise<unknown>;
  renderResult?: (method: M, result: unknown) => ReactNode;
  title?: string;
  warning?: string;
}

type OptValue = string | string[] | boolean;

function buildOpts(specs: OptSpec[], values: Record<string, OptValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of specs) {
    const v = values[s.key];
    if (s.kind === 'ids' && Array.isArray(v) && v.length) out[s.key] = v;
    else if (s.kind === 'bool' && v === true) out[s.key] = true;
    else if (s.kind === 'number' && typeof v === 'string' && v.trim() !== '') out[s.key] = Number(v);
    else if (s.kind === 'text' && typeof v === 'string' && v.trim() !== '') out[s.key] = v.trim();
  }
  return out;
}

/** Builds a CGREvent from editable fields and APIOpts and sends it to one of the given methods. */
export default function EventTester<M extends string>({
  tenant, methods, opts, initialFields, run, renderResult, title = 'Test an event', warning,
}: EventTesterProps<M>) {
  const [method, setMethod] = useState<M>(methods[0]);
  const [eventId, setEventId] = useState('cgrates-ui-test');
  const [fields, setFields] = useState<[string, string][]>(initialFields);
  const [optValues, setOptValues] = useState<Record<string, OptValue>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ method: M; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const args: CGREventArgs = {
    Tenant: tenant,
    ID: eventId,
    Event: Object.fromEntries(fields.filter(([k, v]) => k.trim() && v !== '').map(([k, v]) => [k.trim(), v])),
    APIOpts: buildOpts(opts, optValues),
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult({ method, value: await run(method, args) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setField = (i: number, pos: 0 | 1, v: string) =>
    setFields(prev => prev.map((f, j) => (j === i ? (pos === 0 ? [v, f[1]] : [f[0], v]) : f)));

  return (
    <Accordion sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {warning && <Alert severity="warning">{warning}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label="Method" value={method} onChange={e => setMethod(e.target.value as M)} sx={{ minWidth: 300 }}>
              {methods.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Event ID" value={eventId} onChange={e => setEventId(e.target.value)} />
          </Box>

          <Typography variant="subtitle2">Event fields</Typography>
          {fields.map(([k, v], i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" label="Field" value={k} onChange={e => setField(i, 0, e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="Value" value={v} onChange={e => setField(i, 1, e.target.value)} sx={{ flex: 2 }} />
              <IconButton size="small" color="error" onClick={() => setFields(prev => prev.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box><Button size="small" startIcon={<AddIcon />} onClick={() => setFields(prev => [...prev, ['', '']])}>Add field</Button></Box>

          <Typography variant="subtitle2">Options (APIOpts)</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {opts.map(o => {
              const v = optValues[o.key];
              const set = (nv: OptValue) => setOptValues(prev => ({ ...prev, [o.key]: nv }));
              switch (o.kind) {
                case 'ids':
                  return (
                    <IdMultiSelect key={o.key} label={`${o.label} (${o.key})`} value={(v as string[]) || []}
                      options={o.options || []} onChange={set} helperText={o.helperText} sx={{ flex: '1 1 100%' }} />
                  );
                case 'bool':
                  return (
                    <FormControlLabel key={o.key} label={`${o.label} (${o.key})`}
                      control={<Checkbox checked={v === true} onChange={e => set(e.target.checked)} />} />
                  );
                default:
                  return o.options ? (
                    <Autocomplete<string, false, false, true> key={o.key} freeSolo size="small" options={o.options}
                      value={(v as string) || ''} onInputChange={(_e, nv) => set(nv)} sx={{ minWidth: 220 }}
                      renderInput={p => <TextField {...p} label={`${o.label} (${o.key})`} helperText={o.helperText} />} />
                  ) : (
                    <TextField key={o.key} size="small" label={`${o.label} (${o.key})`} value={(v as string) || ''}
                      type={o.kind === 'number' ? 'number' : 'text'} inputProps={{ step: 'any' }}
                      onChange={e => set(e.target.value)} helperText={o.helperText} sx={{ minWidth: 220 }} />
                  );
              }
            })}
          </Box>

          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
            <pre style={{ fontSize: 11, margin: 0 }}>{JSON.stringify({ method, params: [args] }, null, 2)}</pre>
          </Paper>
          <Box>
            <Button variant="contained" onClick={send} disabled={busy || !tenant}>
              {busy ? <CircularProgress size={20} /> : 'Send'}
            </Button>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {result && (renderResult?.(result.method, result.value) ?? (
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 400, overflow: 'auto' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result.value, null, 2)}</pre>
            </Paper>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
