import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, MenuItem, ToggleButton, ToggleButtonGroup,
  Chip, Tooltip, Accordion, AccordionSummary, AccordionDetails, Collapse, Table, TableBody, TableCell, TableHead, TableRow,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { BalanceValueInput, formatBalanceValue, formatDuration } from '../components/BalanceValue';
import { toLocalInput } from '../components/ActivationIntervalInput';
import { TORS, REQUEST_TYPES } from '../cgrConsts';

type Mode = 'cost' | 'data' | 'maxusage';

const MODES: Record<Mode, { label: string; method: string; help: string }> = {
  cost: { label: 'Price an event', method: 'APIerSv1.GetCost', help: 'Rates an event by subject and destination without touching any account.' },
  data: { label: 'Price data', method: 'APIerSv1.GetDataCost', help: 'Rates data usage for the subject; no destination.' },
  maxusage: { label: 'Max usage', method: 'APIerSv1.GetMaxUsage', help: 'How much the account could use now, from its balances. Empty fields take the server defaults.' },
};

// utils.ParseDurationWithNanosecs: GetCost's Usage is a Go duration and a bare number is nanoseconds.
const USAGE_UNITS = [
  { label: 'ns', factor: 1 },
  { label: 'ms', factor: 1e6 },
  { label: 's', factor: 1e9 },
  { label: 'min', factor: 60e9 },
  { label: 'h', factor: 3600e9 },
  { label: 'units', factor: 1 },
];

const nowLocal = () => toLocalInput(new Date().toISOString());

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {});
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

function CostUsageInput({ value, unit, onValue, onUnit }: { value: string; unit: string; onValue: (v: string) => void; onUnit: (u: string) => void }) {
  const factor = USAGE_UNITS.find(u => u.label === unit)!.factor;
  const ns = Math.round((parseFloat(value) || 0) * factor);
  return (
    <Box sx={{ display: 'flex', gap: 1, minWidth: 260 }}>
      <TextField
        size="small" type="number" label="Usage" value={value} onChange={e => onValue(e.target.value)}
        helperText={unit === 'units' ? 'For non-time rates (data, SMS): counted in the rate\'s own unit' : 'Duration of the event'}
        slotProps={{
          htmlInput: { step: 'any', min: 0 },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={`Sent as Usage "${ns}ns". CGrateS reads Usage as a duration; rates that are not time-based count 1 ns as 1 unit.`}>
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField select size="small" label="Unit" value={unit} onChange={e => onUnit(e.target.value)} sx={{ minWidth: 90 }}>
        {USAGE_UNITS.map(u => <MenuItem key={u.label} value={u.label}>{u.label}</MenuItem>)}
      </TextField>
    </Box>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ lineHeight: 1.3 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
  );
}

/** EventCost (engine/eventcost.go): Charges -> Rating -> Rates/RatingFilters, all keyed by short IDs. */
function EventCostBreakdown({ ec, fmtUsage }: { ec: Json; fmtUsage: (n: number) => string }) {
  const rating = obj(ec.Rating);
  const rates = obj(ec.Rates);
  const filters = obj(ec.RatingFilters);
  const charges = Array.isArray(ec.Charges) ? ec.Charges as Json[] : [];
  const usage = num(ec.Usage);
  return (
    <>
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
        <Stat label="Total" value={num(ec.Cost) ?? '—'} />
        <Stat label="Usage rated" value={usage !== undefined ? fmtUsage(usage) : '—'} sub={usage !== undefined ? `${usage} ns` : undefined} />
        <Stat label="Charging intervals" value={charges.length} />
      </Box>
      {charges.map((c, ci) => {
        const r = obj(rating[String(c.RatingID)]);
        const f = obj(filters[String(r.RatingFiltersID)]);
        const rateList = Array.isArray(rates[String(r.RatesID)]) ? rates[String(r.RatesID)] as Json[] : [];
        const incs = Array.isArray(c.Increments) ? c.Increments as Json[] : [];
        return (
          <Paper key={ci} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Interval {ci + 1}</Typography>
              {num(c.CompressFactor) !== undefined && num(c.CompressFactor) !== 1 && <Chip size="small" label={`× ${c.CompressFactor}`} />}
              {f.RatingPlanID !== undefined && <Chip size="small" variant="outlined" label={`Rating plan ${f.RatingPlanID}`} />}
              {f.DestinationID !== undefined && <Chip size="small" variant="outlined" label={`Destination ${f.DestinationID} (prefix ${f.DestinationPrefix})`} />}
              {r.ConnectFee !== undefined && <Chip size="small" variant="outlined" label={`Connect fee ${r.ConnectFee}`} />}
              {r.RoundingMethod !== undefined && <Chip size="small" variant="outlined" label={`Rounding ${r.RoundingMethod}, ${r.RoundingDecimals} dp`} />}
              {!!r.MaxCost && <Chip size="small" variant="outlined" label={`Max cost ${r.MaxCost} ${r.MaxCostStrategy || ''}`} />}
            </Box>
            {rateList.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary">Rate</Typography>
                <Table size="small" sx={{ mb: 1 }}>
                  <TableHead><TableRow><TableCell>From</TableCell><TableCell>Price</TableCell><TableCell>Per</TableCell><TableCell>Charged in steps of</TableCell></TableRow></TableHead>
                  <TableBody>
                    {rateList.map((rt, i) => (
                      <TableRow key={i}>
                        <TableCell>{fmtUsage(num(rt.GroupIntervalStart) ?? 0)}</TableCell>
                        <TableCell>{String(rt.Value)}</TableCell>
                        <TableCell>{fmtUsage(num(rt.RateUnit) ?? 0)}</TableCell>
                        <TableCell>{fmtUsage(num(rt.RateIncrement) ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
            <Typography variant="caption" color="text.secondary">Increments</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Usage</TableCell><TableCell>Cost</TableCell><TableCell>Repeated</TableCell><TableCell>Accounting ID</TableCell></TableRow></TableHead>
              <TableBody>
                {incs.map((inc, i) => (
                  <TableRow key={i}>
                    <TableCell>{fmtUsage(num(inc.Usage) ?? 0)}</TableCell>
                    <TableCell>{String(inc.Cost)}</TableCell>
                    <TableCell>{String(inc.CompressFactor)}</TableCell>
                    <TableCell>{String(inc.AccountingID || '—')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        );
      })}
    </>
  );
}

/** DataCost (engine/datacost.go). */
function DataCostBreakdown({ dc }: { dc: Json }) {
  const spans = Array.isArray(dc.DataSpans) ? dc.DataSpans as Json[] : [];
  return (
    <>
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
        <Stat label="Total" value={num(dc.Cost) ?? '—'} />
        <Stat label="Spans" value={spans.length} />
      </Box>
      {spans.length > 0 && (
        <Table size="small">
          <TableHead><TableRow><TableCell>From</TableCell><TableCell>To</TableCell><TableCell>Cost</TableCell><TableCell>Rating plan</TableCell><TableCell>Destination</TableCell><TableCell>Increments</TableCell></TableRow></TableHead>
          <TableBody>
            {spans.map((s, i) => (
              <TableRow key={i}>
                <TableCell>{String(s.DataStart)}</TableCell><TableCell>{String(s.DataEnd)}</TableCell><TableCell>{String(s.Cost)}</TableCell>
                <TableCell>{String(s.RatingPlanId || '—')}</TableCell><TableCell>{String(s.MatchedDestId || '—')}</TableCell>
                <TableCell>{Array.isArray(s.Increments) ? s.Increments.length : 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

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
  const [costUsage, setCostUsage] = useState('1');
  const [costUnit, setCostUnit] = useState('min');
  const [answerTime, setAnswerTime] = useState(nowLocal);
  const [apiOpts, setApiOpts] = useState('{}');
  const [result, setResult] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usageTor = mode === 'data' ? '*data' : tor;

  const changeTor = (t: string) => {
    setTor(t);
    setUsage(t === '*voice' ? 60e9 : t === '*data' ? 1024 ** 2 : 1);
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setResult(null);
    if (m === 'data') { setCategory('data'); setUsage(1024 ** 2); }
    if (m === 'cost') setCategory('call');
    if (m === 'maxusage') { setCategory('call'); changeTor('*voice'); }
  };

  const costUsageNs = Math.round((parseFloat(costUsage) || 0) * USAGE_UNITS.find(u => u.label === costUnit)!.factor);
  const fmtCostUsage = (n: number) => (costUnit === 'units' ? String(n) : formatDuration(n) || '0');

  const fetchCost = useCallback(async () => {
    if (!baseUrl) return;
    let opts: Record<string, unknown>;
    try {
      opts = JSON.parse(apiOpts || '{}');
      if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) throw new Error();
    } catch { setError('APIOpts (under Advanced options) must be a JSON object'); return; }
    if (mode !== 'maxusage' && !answerTime) { setError('Answer time is required'); return; }
    const at = answerTime ? new Date(answerTime).toISOString() : '';
    setLoading(true); setError(null); setResult(null);
    try {
      if (mode === 'cost') {
        setResult(await api.getCost(baseUrl, {
          Tenant: tenant, Category: category, Subject: subject, Destination: destination,
          AnswerTime: at, Usage: `${costUsageNs}ns`, APIOpts: opts,
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
  }, [baseUrl, mode, tenant, category, subject, account, destination, tor, requestType, usage, costUsageNs, answerTime, apiOpts]);

  const res = obj(result);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography variant="h5">Get Cost</Typography>
        <Tooltip title={`Calls ${MODES[mode].method}, which only reads rating data and balances.`}>
          <Chip icon={<LockIcon />} color="success" variant="outlined" label="Read-only — nothing is charged" />
        </Tooltip>
      </Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && changeMode(v)} sx={{ mb: 1 }}>
          {(Object.keys(MODES) as Mode[]).map(m => (
            <Tooltip key={m} title={MODES[m].method}><ToggleButton value={m}>{MODES[m].label}</ToggleButton></Tooltip>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{MODES[mode].help}</Typography>
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
          {mode === 'cost'
            ? <CostUsageInput value={costUsage} unit={costUnit} onValue={setCostUsage} onUnit={setCostUnit} />
            : (
              <Box sx={{ minWidth: 260 }}>
                <Typography variant="caption" color="text.secondary">Usage ({usageTor})</Typography>
                <BalanceValueInput key={usageTor} value={usage} balanceType={usageTor} onChange={setUsage} />
              </Box>
            )}
        </Box>
        <Accordion disableGutters elevation={0} sx={{ mt: 2, bgcolor: 'transparent', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
            <Typography variant="body2" color="text.secondary">Advanced options</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <TextField size="small" label={mode === 'data' ? 'Opts (JSON)' : 'APIOpts (JSON)'} value={apiOpts} onChange={e => setApiOpts(e.target.value)}
              sx={{ minWidth: 360 }} helperText="Passed through to the call as-is" />
          </AccordionDetails>
        </Accordion>
        <Button variant="contained" onClick={fetchCost} disabled={loading} sx={{ mt: 1 }}>
          {loading ? <CircularProgress size={20} /> : mode === 'maxusage' ? 'Check max usage' : 'Calculate price'}
        </Button>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result !== null && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>{mode === 'maxusage' ? 'Max usage' : 'Price breakdown'}</Typography>
          {mode === 'cost' && <EventCostBreakdown ec={res} fmtUsage={fmtCostUsage} />}
          {mode === 'data' && <DataCostBreakdown dc={res} />}
          {mode === 'maxusage' && <Stat label="Can use now" value={String(res.Readable)} sub={`${res.MaxUsage} raw`} />}
          <Button size="small" sx={{ mt: 1 }} onClick={() => setShowRaw(v => !v)}>{showRaw ? 'Hide raw' : 'Show raw'}</Button>
          <Collapse in={showRaw}>
            <Paper variant="outlined" sx={{ p: 1.5, mt: 1, maxHeight: 400, overflow: 'auto' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
            </Paper>
          </Collapse>
        </Paper>
      )}
    </Box>
  );
}
