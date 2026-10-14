import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem, CircularProgress, Alert,
  Autocomplete, Checkbox, FormControlLabel, Collapse, Divider, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { useAttributeProfileIDs, useStatQueueProfileIDs, useThresholdProfileIDs } from '../hooks';
import * as api from '../api';
import type { Account } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import KeyValueEditor, { rowsToObject, type KeyValueRow } from '../components/KeyValueEditor';
import { BalanceValueInput } from '../components/BalanceValue';
import { TORS, REQUEST_TYPES } from '../cgrConsts';

// Argument structs from sessions/sessions.go (V1AuthorizeArgs, V1InitSessionArgs, ...).
interface MethodSpec {
  label: string;
  bools: string[];
  idLists: ('AttributeIDs' | 'ThresholdIDs' | 'StatIDs')[];
  routesMaxCost?: boolean;
  flags?: 'full' | 'attributesOnly';
  help: string;
}

const METHODS: Record<string, MethodSpec> = {
  ProcessEvent: {
    label: 'ProcessEvent', bools: [], idLists: [], flags: 'full',
    help: 'Runs the subsystems selected by Flags; the reply is keyed by RunID (*raw unless *derived_reply).',
  },
  AuthorizeEvent: {
    label: 'AuthorizeEvent',
    bools: ['GetAttributes', 'AuthorizeIP', 'AuthorizeResources', 'GetMaxUsage', 'ForceDuration', 'ProcessThresholds', 'ProcessStats', 'GetRoutes', 'RoutesIgnoreErrors'],
    idLists: ['AttributeIDs', 'ThresholdIDs', 'StatIDs'], routesMaxCost: true,
    help: 'Read-only authorization: MaxUsage from the account, resource/IP authorization, routes.',
  },
  InitiateSession: {
    label: 'InitiateSession',
    bools: ['GetAttributes', 'AllocateIP', 'AllocateResources', 'InitSession', 'ForceDuration', 'ProcessThresholds', 'ProcessStats'],
    idLists: ['AttributeIDs', 'ThresholdIDs', 'StatIDs'],
    help: 'InitSession starts a real session (and debit loop for *prepaid) that stays active until terminated.',
  },
  UpdateSession: {
    label: 'UpdateSession',
    bools: ['GetAttributes', 'UpdateSession', 'ForceDuration', 'ProcessThresholds', 'ProcessStats'],
    idLists: ['AttributeIDs', 'ThresholdIDs', 'StatIDs'],
    help: 'Debits the session matching OriginID/OriginHost (initiating it if missing).',
  },
  TerminateSession: {
    label: 'TerminateSession',
    bools: ['TerminateSession', 'ForceDuration', 'ReleaseIP', 'ReleaseResources', 'ProcessThresholds', 'ProcessStats'],
    idLists: ['ThresholdIDs', 'StatIDs'],
    help: 'Ends the session matching OriginID/OriginHost. Does not create a CDR.',
  },
  ProcessMessage: {
    label: 'ProcessMessage',
    bools: ['GetAttributes', 'AllocateIP', 'AllocateResources', 'Debit', 'ForceDuration', 'ProcessThresholds', 'ProcessStats', 'GetRoutes', 'RoutesIgnoreErrors'],
    idLists: ['AttributeIDs', 'ThresholdIDs', 'StatIDs'], routesMaxCost: true,
    help: 'One-shot event (e.g. SMS): Debit charges the account immediately.',
  },
  ProcessCDR: {
    label: 'ProcessCDR', bools: [], idLists: [],
    help: 'Sends the event to CDRs with *rals: rates it, debits *prepaid/*postpaid accounts and stores a CDR. Replies "OK".',
  },
  GetCost: {
    label: 'GetCost', bools: [], idLists: [], flags: 'attributesOnly',
    help: 'Read-only rating of the event; replies with the EventCost. Only *attributes is honoured from Flags.',
  },
};

const DEFAULT_BOOLS: Record<string, boolean> = { GetAttributes: true, GetMaxUsage: true };

// SessionSv1.ProcessEvent flags (sessions.go BiRPCv1ProcessEvent). Each sub-option is sent as "flag:option[:value]".
type SubOpt =
  | { kind: 'bool'; key: string; help?: string }
  | { kind: 'ids'; key: string; source: 'attributes' | 'thresholds' | 'stats' }
  | { kind: 'value'; key: string; label: string }
  | { kind: 'choice'; key: string; label: string; choices: string[]; required?: boolean }
  | { kind: 'free'; label: string };

interface FlagSpec {
  flag: string;
  help: string;
  opts: SubOpt[];
}

const DERIVED: SubOpt = { kind: 'bool', key: '*derived_reply', help: 'run for every charger RunID, not only *raw' };

const FLAG_SPECS: FlagSpec[] = [
  { flag: '*chargers', help: 'derive one event per matching ChargerProfile (RunID)', opts: [] },
  { flag: '*attributes', help: 'AttributeS ProcessEvent', opts: [{ kind: 'ids', key: '*ids', source: 'attributes' }, DERIVED] },
  {
    flag: '*routes', help: 'RouteS GetRoutes', opts: [
      { kind: 'bool', key: '*ignore_errors' },
      { kind: 'bool', key: '*event_cost', help: 'max cost = cost of the event' },
      { kind: 'value', key: '*maxcost', label: '*maxcost' },
      DERIVED,
    ],
  },
  { flag: '*thresholds', help: 'ThresholdS ProcessEvent (updates hit counters)', opts: [{ kind: 'ids', key: '*ids', source: 'thresholds' }, DERIVED] },
  { flag: '*stats', help: 'StatS ProcessEvent (adds to stat queues)', opts: [{ kind: 'ids', key: '*ids', source: 'stats' }, DERIVED] },
  {
    flag: '*resources', help: 'ResourceS; one action is required', opts: [
      { kind: 'choice', key: 'action', label: 'Action', choices: ['*authorize', '*allocate', '*release'], required: true }, DERIVED,
    ],
  },
  {
    flag: '*ips', help: 'IPs; one action is required', opts: [
      { kind: 'choice', key: 'action', label: 'Action', choices: ['*authorize', '*allocate', '*release'], required: true }, DERIVED,
    ],
  },
  {
    flag: '*rals', help: 'RALs charging', opts: [
      { kind: 'bool', key: '*cost', help: 'Responder.GetCost per run' },
      { kind: 'choice', key: 'action', label: 'Session action', choices: ['*authorize', '*initiate', '*update', '*terminate'] },
      { kind: 'bool', key: '*fd', help: 'force duration' },
      DERIVED,
    ],
  },
  { flag: '*stir_authenticate', help: 'verify the *stirIdentity APIOpt', opts: [DERIVED] },
  { flag: '*stir_initiate', help: 'build a STIR Identity header (ignored when *stir_authenticate is set)', opts: [DERIVED] },
  { flag: '*cdrs', help: 'send to CDRs (stores a CDR)', opts: [{ kind: 'free', label: 'CDRs flags (e.g. *rals, *store:false)' }, DERIVED] },
  { flag: '*blocker_error', help: 'stop on the first subsystem error instead of replying PARTIALLY_EXECUTED', opts: [] },
];

interface FlagState {
  on: boolean;
  bools: Record<string, boolean>;
  ids: Record<string, string[]>;
  values: Record<string, string>;
  free: string[];
}

const emptyFlag = (): FlagState => ({ on: false, bools: {}, ids: {}, values: {}, free: [] });

function buildFlags(states: Record<string, FlagState>, specs: FlagSpec[]): string[] {
  const out: string[] = [];
  for (const spec of specs) {
    const st = states[spec.flag];
    if (!st?.on) continue;
    const subs: string[] = [];
    for (const o of spec.opts) {
      if (o.kind === 'bool' && st.bools[o.key]) subs.push(o.key);
      if (o.kind === 'ids' && st.ids[o.key]?.length) subs.push(`${o.key}:${st.ids[o.key].join('&')}`);
      if (o.kind === 'value' && st.values[o.key]) subs.push(`${o.key}:${st.values[o.key]}`);
      if (o.kind === 'choice' && st.values[o.key]) subs.push(st.values[o.key]);
      if (o.kind === 'free') subs.push(...st.free);
    }
    if (subs.length === 0) out.push(spec.flag);
    else subs.forEach(s => out.push(`${spec.flag}:${s}`));
  }
  return out;
}

const newOriginID = () => `cgrui-${crypto.randomUUID()}`;

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [method, setMethod] = useState('ProcessEvent');
  const spec = METHODS[method];

  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [subject, setSubject] = useState('');
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState('');
  const [tor, setTor] = useState('*voice');
  const [requestType, setRequestType] = useState('*prepaid');
  const [usage, setUsage] = useState(60e9);
  const [setupTime, setSetupTime] = useState('*now');
  const [answerTime, setAnswerTime] = useState('*now');
  const [originID, setOriginID] = useState(newOriginID);
  const [originHost, setOriginHost] = useState('CGrateS_UI');
  const [newIdPerSend, setNewIdPerSend] = useState(true);
  const [extraEvent, setExtraEvent] = useState<KeyValueRow[]>([]);
  const [apiOpts, setApiOpts] = useState<KeyValueRow[]>([]);

  const [bools, setBools] = useState<Record<string, boolean>>(DEFAULT_BOOLS);
  const [idLists, setIdLists] = useState<Record<string, string[]>>({});
  const [routesMaxCost, setRoutesMaxCost] = useState('');
  const [flagStates, setFlagStates] = useState<Record<string, FlagState>>({
    '*rals': { ...emptyFlag(), on: true, values: { action: '*authorize' } },
  });

  const [result, setResult] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const { data: attributeIds } = useAttributeProfileIDs(tenant);
  const { data: thresholdIds } = useThresholdProfileIDs(tenant);
  const { data: statIds } = useStatQueueProfileIDs(tenant);
  const idOptions = { attributes: attributeIds || [], thresholds: thresholdIds || [], stats: statIds || [] };
  const idListSource = { AttributeIDs: idOptions.attributes, ThresholdIDs: idOptions.thresholds, StatIDs: idOptions.stats };

  useEffect(() => {
    if (!baseUrl || !tenant) return;
    api.getAccounts(baseUrl, tenant, 0, 500)
      .then(data => setAccountOptions(Array.isArray(data) ? (data as Account[]).map(a => a.ID.replace(`${tenant}:`, '')) : []))
      .catch(() => setAccountOptions([]));
  }, [baseUrl, tenant]);

  const flagSpecs = spec.flags === 'attributesOnly'
    ? FLAG_SPECS.filter(f => f.flag === '*attributes').map(f => ({ ...f, opts: f.opts.filter(o => o !== DERIVED) }))
    : FLAG_SPECS;
  const flags = useMemo(() => buildFlags(flagStates, flagSpecs), [flagStates, flagSpecs]);
  const missingChoice = spec.flags ? flagSpecs.find(f => flagStates[f.flag]?.on
    && f.opts.some(o => o.kind === 'choice' && o.required && !flagStates[f.flag].values[o.key])) : undefined;

  const buildParams = useCallback((oid: string) => {
    const event: Record<string, unknown> = {
      Tenant: tenant,
      OriginID: oid,
      OriginHost: originHost,
      ToR: tor,
      RequestType: requestType,
      Account: account,
      Destination: destination,
      SetupTime: setupTime,
      AnswerTime: answerTime,
      Usage: usage,
    };
    if (subject) event.Subject = subject;
    if (category) event.Category = category;
    Object.assign(event, rowsToObject(extraEvent));
    const cgrEvent = { Tenant: tenant, ID: crypto.randomUUID(), Event: event, APIOpts: rowsToObject(apiOpts) };
    if (method === 'ProcessCDR') return cgrEvent;
    if (spec.flags) return { Flags: flags, ...cgrEvent };
    const args: Record<string, unknown> = {};
    spec.bools.forEach(b => { args[b] = !!bools[b]; });
    spec.idLists.forEach(l => { args[l] = idLists[l] || []; });
    if (spec.routesMaxCost) args.RoutesMaxCost = routesMaxCost;
    return { ...args, ...cgrEvent };
  }, [tenant, originHost, tor, requestType, account, destination, setupTime, answerTime, usage, subject, category,
    extraEvent, apiOpts, method, spec, flags, bools, idLists, routesMaxCost]);

  const preview = useMemo(() => ({ method: `SessionSv1.${method}`, params: [buildParams(originID)] }), [method, buildParams, originID]);

  const handleSubmit = useCallback(async () => {
    if (!baseUrl) return;
    const oid = newIdPerSend ? newOriginID() : originID;
    if (oid !== originID) setOriginID(oid);
    setLoading(true); setError(null); setResult(undefined);
    try {
      setResult(await api.sessionCall(baseUrl, method, buildParams(oid)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, method, buildParams, newIdPerSend, originID]);

  const updateFlag = (flag: string, fn: (s: FlagState) => FlagState) =>
    setFlagStates(prev => ({ ...prev, [flag]: fn(prev[flag] || emptyFlag()) }));

  const writes = method === 'ProcessCDR' || (method === 'ProcessEvent' && flagStates['*cdrs']?.on);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Event Tester</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sends an event to SessionS. These calls act on the live system: charging flags debit accounts, session flags open or close sessions.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 1 }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <TextField select size="small" label="Method" value={method} onChange={e => setMethod(e.target.value)} sx={{ minWidth: 220 }}>
            {Object.keys(METHODS).map(m => <MenuItem key={m} value={m}>SessionSv1.{m}</MenuItem>)}
          </TextField>
        </Box>
        <Typography variant="caption" color="text.secondary">{spec.help}</Typography>
        {writes && <Alert severity="warning" sx={{ mt: 1 }}>This writes a CDR and may debit the account.</Alert>}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Event</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
          <Autocomplete
            freeSolo size="small" sx={{ minWidth: 240 }}
            options={accountOptions}
            value={account}
            onInputChange={(_e, v) => setAccount(v)}
            renderInput={params => <TextField {...params} label="Account" />}
          />
          <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)} helperText="Empty: rated as the Account" />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <TextField size="small" label="Category" value={category} onChange={e => setCategory(e.target.value)} helperText="Empty: server default_category" />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
          <TextField select size="small" label="ToR" value={tor} onChange={e => setTor(e.target.value)} sx={{ minWidth: 130 }}>
            {TORS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Request Type" value={requestType} onChange={e => setRequestType(e.target.value)} sx={{ minWidth: 160 }}>
            {REQUEST_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="caption" color="text.secondary">Usage</Typography>
            <BalanceValueInput key={tor} value={usage} balanceType={tor} onChange={setUsage} />
          </Box>
          <TextField size="small" label="SetupTime" value={setupTime} onChange={e => setSetupTime(e.target.value)} sx={{ width: 150 }} />
          <TextField size="small" label="AnswerTime" value={answerTime} onChange={e => setAnswerTime(e.target.value)} sx={{ width: 150 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <TextField size="small" label="OriginID" value={originID} onChange={e => setOriginID(e.target.value)} sx={{ minWidth: 380 }}
            slotProps={{ input: { endAdornment: (
              <Tooltip title="New OriginID"><IconButton size="small" onClick={() => setOriginID(newOriginID())}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
            ) } }} />
          <TextField size="small" label="OriginHost" value={originHost} onChange={e => setOriginHost(e.target.value)} />
          <FormControlLabel control={<Checkbox size="small" checked={newIdPerSend} onChange={e => setNewIdPerSend(e.target.checked)} />}
            label="New OriginID on each send (untick to Update/Terminate the same session)" />
        </Box>
        <KeyValueEditor label="Extra Event fields" rows={extraEvent} onChange={setExtraEvent} keyPlaceholder="Field (e.g. ExtraField1)" />
      </Paper>

      {spec.flags && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Flags</Typography>
          {flagSpecs.map(f => {
            const st = flagStates[f.flag] || emptyFlag();
            return (
              <Box key={f.flag} sx={{ mb: 1 }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={st.on} onChange={e => updateFlag(f.flag, s => ({ ...s, on: e.target.checked }))} />}
                  label={<><code>{f.flag}</code> <Typography component="span" variant="caption" color="text.secondary">{f.help}</Typography></>}
                />
                {st.on && f.opts.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', ml: 4, mt: 0.5 }}>
                    {f.opts.map((o, i) => {
                      switch (o.kind) {
                        case 'bool':
                          return (
                            <FormControlLabel key={i}
                              control={<Checkbox size="small" checked={!!st.bools[o.key]} onChange={e => updateFlag(f.flag, s => ({ ...s, bools: { ...s.bools, [o.key]: e.target.checked } }))} />}
                              label={<Tooltip title={o.help || ''}><code>{o.key}</code></Tooltip>}
                            />
                          );
                        case 'ids':
                          return (
                            <IdMultiSelect key={i} label={`${o.key} (empty: all matching)`} fullWidth={false} sx={{ minWidth: 300 }}
                              value={st.ids[o.key] || []} options={idOptions[o.source]}
                              onChange={v => updateFlag(f.flag, s => ({ ...s, ids: { ...s.ids, [o.key]: v } }))} />
                          );
                        case 'value':
                          return (
                            <TextField key={i} size="small" label={o.label} value={st.values[o.key] || ''} sx={{ width: 140 }}
                              onChange={e => updateFlag(f.flag, s => ({ ...s, values: { ...s.values, [o.key]: e.target.value } }))} />
                          );
                        case 'choice':
                          return (
                            <TextField key={i} select size="small" label={o.label} value={st.values[o.key] || ''} sx={{ minWidth: 170 }}
                              error={o.required && !st.values[o.key]}
                              onChange={e => updateFlag(f.flag, s => ({ ...s, values: { ...s.values, [o.key]: e.target.value } }))}>
                              {!o.required && <MenuItem value=""><em>None</em></MenuItem>}
                              {o.choices.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </TextField>
                          );
                        case 'free':
                          return (
                            <IdMultiSelect key={i} label={o.label} fullWidth={false} sx={{ minWidth: 300 }}
                              value={st.free} options={['*rals', '*store:false', '*export', '*chargers', '*attributes', '*stats', '*thresholds', '*reprocess', '*refund', '*rerate']}
                              onChange={v => updateFlag(f.flag, s => ({ ...s, free: v }))} />
                          );
                      }
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">Flags sent: </Typography>
          <code style={{ fontSize: 12 }}>{JSON.stringify(flags)}</code>
        </Paper>
      )}

      {!spec.flags && spec.bools.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {spec.bools.map(b => (
              <FormControlLabel key={b} sx={{ mr: 2 }}
                control={<Checkbox size="small" checked={!!bools[b]} onChange={e => setBools(prev => ({ ...prev, [b]: e.target.checked }))} />}
                label={b} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            {spec.idLists.map(l => (
              <IdMultiSelect key={l} label={l} fullWidth={false} sx={{ minWidth: 280 }}
                value={idLists[l] || []} options={idListSource[l]}
                onChange={v => setIdLists(prev => ({ ...prev, [l]: v }))} />
            ))}
            {spec.routesMaxCost && (
              <TextField size="small" label="RoutesMaxCost" value={routesMaxCost} onChange={e => setRoutesMaxCost(e.target.value)}
                helperText="A number or *event_cost" />
            )}
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <KeyValueEditor label="APIOpts" rows={apiOpts} onChange={setApiOpts}
          keyOptions={['*sessionsDebitInterval', '*sessionsChargeable', '*attrProfileIDs', '*attrProcessRuns', '*context',
            '*rouLimit', '*rouOffset', '*rouProfileCount', '*rsUsageTTL', '*rsUnits',
            '*stirIdentity', '*stirATest', '*stirOriginatorTn', '*stirOriginatorURI', '*stirDestinationTn', '*stirDestinationURI',
            '*stirPayloadMaxDuration', '*stirPublicKeyPath', '*stirPrivateKeyPath']} />
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !!missingChoice}>
          {loading ? <CircularProgress size={20} /> : `Send ${method}`}
        </Button>
        {missingChoice && <Typography variant="caption" color="error">{missingChoice.flag} needs an action</Typography>}
        <Button variant="text" onClick={() => setShowRequest(!showRequest)}>
          {showRequest ? 'Hide Request JSON' : 'Show Request JSON'}
        </Button>
      </Box>
      <Collapse in={showRequest}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(preview, null, 2)}</pre>
        </Paper>
      </Collapse>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result !== undefined && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Reply</Typography>
          <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(result, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );
}
