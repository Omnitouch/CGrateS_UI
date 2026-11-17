import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  FormControlLabel, Switch, Collapse, ToggleButton, ToggleButtonGroup, IconButton,
  RadioGroup, Radio, Menu, TableSortLabel, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { CDR } from '../types';
import IdMultiSelect from '../components/IdMultiSelect';
import { toLocalInput } from '../components/ActivationIntervalInput';
import { TORS, REQUEST_TYPES } from '../cgrConsts';
import JsonTree, { parseJsonString } from '../components/JsonTree';
import { formatDateTime } from '../formatTime';

const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 30 minutes', value: 30 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 2 hours', value: 120 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 2 days', value: 2880 },
  { label: 'Past 1 week', value: 10080 },
  { label: 'Past 1 month', value: 43200 },
  { label: 'Past 3 months', value: 129600 },
  { label: 'Past 6 months', value: 259200 },
  { label: 'Past 1 year', value: 525600 },
  { label: 'Past 2 years', value: 1051200 },
];

const CATEGORY_OPTIONS = ['call', 'sms', 'sms_a2p', 'data'];

// The only OrderBy columns engine/storage_sql.go accepts.
const ORDER_BY_FIELDS = ['OrderID', 'AnswerTime', 'SetupTime', 'Usage', 'Cost'];

// Flags read by newCDRProcessingArgs (engine/cdrs.go); append ":false" to turn one off.
const RATE_FLAGS = ['*attributes', '*chargers', '*store', '*export', '*thresholds', '*stats', '*rals', '*rerate', '*refund', '*reprocess'];

type ListKey = 'CGRIDs' | 'RunIDs' | 'OriginIDs' | 'OriginHosts' | 'Sources' | 'ToRs' | 'RequestTypes'
  | 'Tenants' | 'Categories' | 'Accounts' | 'Subjects' | 'DestinationPrefixes' | 'Costs';

interface ListFilter { values: string[]; exclude: boolean }

const LIST_LABELS: Record<ListKey, string> = {
  CGRIDs: 'CGRIDs', RunIDs: 'Run IDs', OriginIDs: 'Origin IDs', OriginHosts: 'Origin hosts', Sources: 'Sources',
  ToRs: 'ToR', RequestTypes: 'Request types', Tenants: 'Tenants', Categories: 'Categories', Accounts: 'Accounts',
  Subjects: 'Subjects', DestinationPrefixes: 'Destination prefixes', Costs: 'Exact costs',
};

const MAIN_LISTS: ListKey[] = ['Tenants', 'Accounts', 'Subjects', 'DestinationPrefixes', 'Categories'];
const MORE_LISTS: ListKey[] = ['ToRs', 'RequestTypes', 'RunIDs', 'CGRIDs', 'OriginIDs', 'OriginHosts', 'Sources', 'Costs'];

const TIME_FIELDS = ['SetupTime', 'AnswerTime', 'CreatedAt', 'UpdatedAt'] as const;
type TimeField = typeof TIME_FIELDS[number];

interface ExtraFieldRow { key: string; value: string; exclude: boolean }

type Scope = 'page' | 'all';

interface Order { by: string; dir: 'asc' | 'desc' }

const SUMMARY_FIELDS = ['Account', 'Subject', 'ToR', 'Category', 'Destination', 'SetupTime', 'AnswerTime', 'Usage', 'Cost', 'CostSource'];
const TECH_FIELDS = ['CGRID', 'RunID', 'OrderID', 'OriginID'];

function formatNsToHMS(ns: number): string {
  const totalSeconds = Math.floor(ns / 1e9);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatUsage(usage: number, tor: string): string {
  if (tor === '*data') return `${(usage / (1024*1024)).toFixed(2)} MB (${usage} bytes)`;
  if (tor === '*voice') return `${formatNsToHMS(usage)} (${usage} ns)`;
  return String(usage);
}

const isNotFound = (e: unknown) => e instanceof Error && e.message.includes('NOT_FOUND');
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');

/**
 * Filters that match exactly the given rows: (CGRID, RunID) is unique in the cdrs table,
 * so one filter per RunID holding only that run's CGRIDs can never reach a row not listed.
 */
function exactRowFilters(rows: CDR[]): Record<string, unknown>[] {
  const byRun = new Map<string, string[]>();
  for (const r of rows) byRun.set(r.RunID, [...(byRun.get(r.RunID) || []), r.CGRID]);
  return [...byRun.entries()].map(([runId, cgrids]) => ({ RunIDs: [runId], CGRIDs: cgrids }));
}

function MatchSelect({ exclude, onChange, inline }: { exclude: boolean; onChange: (exclude: boolean) => void; inline?: string }) {
  const items = [<MenuItem key="is" value="is">is</MenuItem>, <MenuItem key="not" value="not">is not</MenuItem>];
  const value = exclude ? 'not' : 'is';
  const change = (v: string) => onChange(v === 'not');
  if (!inline) {
    return <TextField select size="small" label="Match" value={value} onChange={e => change(e.target.value)} sx={{ width: 110, flexShrink: 0 }}>{items}</TextField>;
  }
  return (
    <Select variant="standard" disableUnderline size="small" value={value} onChange={e => change(e.target.value)}
      onMouseDown={e => e.stopPropagation()} inputProps={{ 'aria-label': `${inline} match` }}
      // Autocomplete squeezes every .MuiInputBase-input inside it to width 0.
      sx={{ mr: 1, fontSize: 13, fontWeight: 600, color: exclude ? 'warning.main' : 'text.secondary', flexShrink: 0,
        '& .MuiSelect-select.MuiInputBase-input': { width: 'auto', minWidth: '4em', p: '2px 24px 2px 0' } }}>
      {items}
    </Select>
  );
}

const formatCost = (cost: number) => (cost === -1 ? 'Not rated' : String(cost));

function CdrValue({ field, value, cdr }: { field: string; value: unknown; cdr: CDR }) {
  if (field === 'Usage' && typeof value === 'number') return <>{formatUsage(value, cdr.ToR)}</>;
  if (field === 'Cost' && value === -1) return <>Not rated (-1)</>;
  if ((field === 'SetupTime' || field === 'AnswerTime') && typeof value === 'string') {
    return <>{formatDateTime(value)} <Typography component="span" variant="caption" color="text.secondary">{value}</Typography></>;
  }
  if (value !== null && typeof value === 'object') return <JsonTree value={value} open={field !== 'CostDetails'} />;
  if (typeof value === 'string' && parseJsonString(value)) return <JsonTree value={value} />;
  if (value === null || value === '') return <Typography component="span" variant="body2" color="text.disabled">{value === null ? 'null' : '(empty)'}</Typography>;
  return <>{String(value)}</>;
}

function CdrFieldTable({ cdr, fields }: { cdr: CDR; fields: string[] }) {
  const rec = cdr as unknown as Record<string, unknown>;
  return (
    <Table size="small">
      <TableBody>
        {fields.map(f => (
          <TableRow key={f}>
            <TableCell sx={{ width: 160, verticalAlign: 'top' }}><strong>{f}</strong></TableCell>
            <TableCell sx={{ wordBreak: 'break-word' }}><CdrValue field={f} value={rec[f]} cdr={cdr} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CdrDetail({ cdr }: { cdr: CDR }) {
  const keys = Object.keys(cdr);
  const summary = SUMMARY_FIELDS.filter(k => keys.includes(k));
  const tech = TECH_FIELDS.filter(k => keys.includes(k));
  const other = keys.filter(k => !summary.includes(k) && !tech.includes(k));
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">Summary</Typography>
      <CdrFieldTable cdr={cdr} fields={summary} />
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Network and other fields</Typography>
      <CdrFieldTable cdr={cdr} fields={other} />
      <Accordion disableGutters variant="outlined" sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="overline" color="text.secondary">Technical IDs ({tech.join(', ')})</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}><CdrFieldTable cdr={cdr} fields={tech} /></AccordionDetails>
      </Accordion>
    </Box>
  );
}

function TypedCount({ count, value, onChange }: { count: number; value: string; onChange: (v: string) => void }) {
  return (
    <TextField size="small" label={`Type ${count} to confirm`} value={value} onChange={e => onChange(e.target.value)}
      autoComplete="off" error={value !== '' && value !== String(count)} />
  );
}

function ListFilterInput({ k, filter, options, onChange }: {
  k: ListKey; filter: ListFilter; options: string[]; onChange: (f: ListFilter) => void;
}) {
  return (
    <Box sx={{ flex: '1 1 300px', minWidth: 260 }}>
      <IdMultiSelect label={LIST_LABELS[k]} value={filter.values} options={options}
        onChange={values => onChange({ ...filter, values })}
        startAdornment={<MatchSelect inline={LIST_LABELS[k]} exclude={filter.exclude} onChange={exclude => onChange({ ...filter, exclude })} />} />
    </Box>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();

  const [lists, setLists] = useState<Record<ListKey, ListFilter>>(() => {
    const init = {} as Record<ListKey, ListFilter>;
    for (const k of [...MAIN_LISTS, ...MORE_LISTS]) init[k] = { values: [], exclude: false };
    if (defaultTenant) init.Tenants = { values: [defaultTenant], exclude: false };
    return init;
  });
  const [times, setTimes] = useState<Record<TimeField, { start: string; end: string }>>(() => {
    const init = {} as Record<TimeField, { start: string; end: string }>;
    for (const t of TIME_FIELDS) init[t] = { start: '', end: '' };
    return init;
  });
  const [past, setPast] = useState('');
  const [extraFields, setExtraFields] = useState<ExtraFieldRow[]>([]);
  const [minUsage, setMinUsage] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [minCost, setMinCost] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [orderBy, setOrderBy] = useState('SetupTime');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [appliedOrder, setAppliedOrder] = useState<Order | null>(null);
  const [bulkAnchor, setBulkAnchor] = useState<HTMLElement | null>(null);
  const [limit, setLimit] = useState(50);
  const [moreOpen, setMoreOpen] = useState(false);

  const [results, setResults] = useState<CDR[]>([]);
  const [noResults, setNoResults] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [lastFilter, setLastFilter] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [apiQuery, setApiQuery] = useState('');

  const [selectedCDR, setSelectedCDR] = useState<CDR | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [exporterIds, setExporterIds] = useState<string[]>([]);
  const [exporterError, setExporterError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedExporters, setSelectedExporters] = useState<string[]>([]);
  const [exportScope, setExportScope] = useState<Scope>('page');
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isVerbose, setIsVerbose] = useState(true);
  const [deleteAfterExport, setDeleteAfterExport] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [rateMethod, setRateMethod] = useState<'rate' | 'reprocess'>('rate');
  const [rateFlags, setRateFlags] = useState<string[]>([]);
  const [rateScope, setRateScope] = useState<Scope>('page');
  const [rateTyped, setRateTyped] = useState('');
  const [deleteTyped, setDeleteTyped] = useState('');
  const [exportDeleteTyped, setExportDeleteTyped] = useState('');
  const [rateResult, setRateResult] = useState<string | null>(null);
  const [isRating, setIsRating] = useState(false);

  useEffect(() => {
    if (!baseUrl) return;
    api.getConfig(baseUrl, defaultTenant, 'ees').then(cfg => {
      const ees = cfg.ees as { exporters?: { id: string }[] } | undefined;
      setExporterIds((ees?.exporters || []).map(e => e.id));
    }).catch(e => setExporterError(errMsg(e, 'Failed to read the ees config')));
  }, [baseUrl, defaultTenant]);

  const setList = (k: ListKey, f: ListFilter) => setLists(prev => ({ ...prev, [k]: f }));
  const setTime = (t: TimeField, edge: 'start' | 'end', v: string) => setTimes(prev => ({ ...prev, [t]: { ...prev[t], [edge]: v } }));

  const handlePastChange = (value: string) => {
    const minutes = parseInt(value);
    if (!minutes) { setPast(''); return; }
    setPast(value);
    const now = new Date();
    setTimes(prev => ({
      ...prev,
      SetupTime: { start: toLocalInput(new Date(now.getTime() - minutes * 60000).toISOString()), end: toLocalInput(now.toISOString()) },
    }));
  };

  /** utils.RPCCDRsFilter without the paginator. */
  const buildFilter = useCallback((): Record<string, unknown> => {
    const f: Record<string, unknown> = {};
    for (const [k, lf] of Object.entries(lists) as [ListKey, ListFilter][]) {
      if (!lf.values.length) continue;
      const vals = k === 'Costs' ? lf.values.map(Number) : lf.values;
      f[lf.exclude ? `Not${k}` : k] = vals;
    }
    for (const t of TIME_FIELDS) {
      if (times[t].start) f[`${t}Start`] = toIso(times[t].start);
      if (times[t].end) f[`${t}End`] = toIso(times[t].end);
    }
    const inc = extraFields.filter(r => r.key && !r.exclude);
    const exc = extraFields.filter(r => r.key && r.exclude);
    if (inc.length) f.ExtraFields = Object.fromEntries(inc.map(r => [r.key, r.value]));
    if (exc.length) f.NotExtraFields = Object.fromEntries(exc.map(r => [r.key, r.value]));
    if (minUsage) f.MinUsage = minUsage;
    if (maxUsage) f.MaxUsage = maxUsage;
    const extraArgs: Record<string, number> = {};
    if (minCost !== '') extraArgs.MinCost = Number(minCost);
    if (maxCost !== '') extraArgs.MaxCost = Number(maxCost);
    if (Object.keys(extraArgs).length) f.ExtraArgs = extraArgs;
    return f;
  }, [lists, times, extraFields, minUsage, maxUsage, minCost, maxCost]);

  const runQuery = useCallback(async (filter: Record<string, unknown>, off: number, withCount: boolean, order?: Order) => {
    if (!baseUrl) return;
    const o = order ?? appliedOrder ?? { by: orderBy, dir: orderDir };
    setLoading(true);
    setError(null);
    setNoResults(false);
    const startTime = Date.now();
    const params: Record<string, unknown> = { ...filter, Limit: limit, Offset: off };
    if (o.by) params.OrderBy = o.dir === 'desc' ? `${o.by};desc` : o.by;
    setAppliedOrder(o);
    setApiQuery(JSON.stringify({ method: 'CDRsV2.GetCDRs', params: [params], id: 0 }, null, 2));
    try {
      if (withCount) setTotal(await api.getCDRsCount(baseUrl, filter));
      const data = await api.getCDRs(baseUrl, params) as CDR[];
      setResults(data || []);
      setNoResults(!data || data.length === 0);
      setOffset(off);
      setResponseTime(((Date.now() - startTime) / 1000).toFixed(2));
    } catch (e: unknown) {
      setResults([]);
      if (isNotFound(e)) { setNoResults(true); setOffset(off); }
      else setError(errMsg(e, 'Failed to fetch CDRs'));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, limit, orderBy, orderDir, appliedOrder]);

  const search = () => {
    const filter = buildFilter();
    setLastFilter(filter);
    runQuery(filter, 0, true, { by: orderBy, dir: orderDir });
  };

  const sortBy = (by: string) => {
    const dir = appliedOrder?.by === by && appliedOrder.dir === 'desc' ? 'asc' : 'desc';
    setOrderBy(by);
    setOrderDir(dir);
    if (lastFilter) runQuery(lastFilter, 0, false, { by, dir });
  };

  const sortHeader = (by: string, label: string) => (
    <TableSortLabel active={appliedOrder?.by === by} direction={appliedOrder?.by === by ? appliedOrder.dir : 'desc'}
      onClick={() => sortBy(by)} disabled={!lastFilter || loading}>
      {label}
    </TableSortLabel>
  );

  const goToPage = (off: number) => { if (lastFilter) runQuery(lastFilter, off, false); };
  const refresh = () => { if (lastFilter) runQuery(lastFilter, offset, true); };

  const pageFilters = useMemo(() => exactRowFilters(results), [results]);

  const handleExport = useCallback(async () => {
    if (!baseUrl || !selectedExporters.length || !lastFilter) return;
    setIsExporting(true);
    setExportResult(null);
    setDeleteResult(null);
    const scopes = exportScope === 'page' ? pageFilters : [lastFilter];
    try {
      const out: unknown[] = [];
      for (const f of scopes) out.push(await api.exportCDRs(baseUrl, { ...f, ExporterIDs: selectedExporters, Verbose: isVerbose }));
      setExportResult(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
      if (deleteAfterExport && exportScope === 'page') {
        setIsDeleting(true);
        try {
          for (const f of pageFilters) await api.removeCDRs(baseUrl, f);
          setNotice(`Exported and deleted ${results.length} CDRs`);
          setExportOpen(false);
          refresh();
        } catch (e: unknown) {
          setDeleteResult(errMsg(e, 'Delete failed'));
        } finally {
          setIsDeleting(false);
        }
      }
    } catch (e: unknown) {
      setExportResult(errMsg(e, 'Export failed'));
    } finally {
      setIsExporting(false);
    }
  }, [baseUrl, selectedExporters, lastFilter, exportScope, pageFilters, isVerbose, deleteAfterExport, results.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteCDRs = useCallback(async () => {
    if (!baseUrl || !results.length) return;
    setIsDeleting(true);
    setDeleteResult(null);
    try {
      for (const f of pageFilters) await api.removeCDRs(baseUrl, f);
      setNotice(`Deleted ${results.length} CDRs`);
      setDeleteOpen(false);
      refresh();
    } catch (e: unknown) {
      setDeleteResult(errMsg(e, 'Delete failed'));
    } finally {
      setIsDeleting(false);
    }
  }, [baseUrl, results.length, pageFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRate = useCallback(async () => {
    if (!baseUrl || !lastFilter) return;
    setIsRating(true);
    setRateResult(null);
    const call = rateMethod === 'rate' ? api.rateCDRs : api.reprocessCDRs;
    const scopes = rateScope === 'page' ? pageFilters : [lastFilter];
    try {
      for (const f of scopes) await call(baseUrl, { ...f, Flags: rateFlags, APIOpts: {} });
      setRateResult('OK');
      refresh();
    } catch (e: unknown) {
      setRateResult(errMsg(e, 'Failed'));
    } finally {
      setIsRating(false);
      setRateTyped('');
    }
  }, [baseUrl, lastFilter, rateMethod, rateScope, pageFilters, rateFlags]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryTotals = useMemo(() => {
    const acc: Record<string, { cost: number; count: number; unrated: number }> = {};
    for (const r of results) {
      const cat = r.Category || 'unknown';
      if (!acc[cat]) acc[cat] = { cost: 0, count: 0, unrated: 0 };
      if (r.Cost >= 0) acc[cat].cost += r.Cost;
      else if (r.Cost === -1) acc[cat].unrated++;
      acc[cat].count++;
    }
    return acc;
  }, [results]);

  const listOptions = (k: ListKey) => k === 'Tenants' ? tenants : k === 'ToRs' ? TORS : k === 'RequestTypes' ? REQUEST_TYPES : k === 'Categories' ? CATEGORY_OPTIONS : [];
  const pages = total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  const scopeCount = (s: Scope) => (s === 'page' ? results.length : total ?? 0);

  const timeInputs = (t: TimeField, label: string) => (
    <Box key={t} sx={{ display: 'flex', gap: 1 }}>
      <TextField size="small" label={`${label} from`} type="datetime-local" value={times[t].start}
        onChange={e => { setTime(t, 'start', e.target.value); if (t === 'SetupTime') setPast(''); }}
        slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 210 }} />
      <TextField size="small" label={`${label} until`} type="datetime-local" value={times[t].end}
        onChange={e => { setTime(t, 'end', e.target.value); if (t === 'SetupTime') setPast(''); }}
        slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 210 }} />
    </Box>
  );

  const scopeRadio = (value: Scope, onChange: (s: Scope) => void, verb: string) => (
    <RadioGroup value={value} onChange={e => onChange(e.target.value as Scope)}>
      <FormControlLabel value="page" control={<Radio size="small" />} label={`${verb} only the ${results.length} CDRs shown on this page`} />
      <FormControlLabel value="all" control={<Radio size="small" />} disabled={total === null}
        label={`${verb} all ${total ?? '?'} CDRs matching the last search`} />
    </RadioGroup>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>CDRs</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Setup time range</InputLabel>
            <Select value={past} label="Setup time range" onChange={e => handlePastChange(e.target.value)}>
              <MenuItem value="">Custom</MenuItem>
              {pastOptions.map(o => <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          {timeInputs('SetupTime', 'Setup')}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 2 }}>
          {MAIN_LISTS.map(k => <ListFilterInput key={k} k={k} filter={lists[k]} options={listOptions(k)} onChange={f => setList(k, f)} />)}
        </Box>

        <Button size="small" sx={{ mt: 1 }} onClick={() => setMoreOpen(o => !o)} endIcon={moreOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
          More filters
        </Button>
        <Collapse in={moreOpen}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 1 }}>
            {MORE_LISTS.map(k => <ListFilterInput key={k} k={k} filter={lists[k]} options={listOptions(k)} onChange={f => setList(k, f)} />)}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            {timeInputs('AnswerTime', 'Answer')}
            {timeInputs('CreatedAt', 'Created')}
            {timeInputs('UpdatedAt', 'Updated')}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
            <TextField size="small" label="Min usage" value={minUsage} onChange={e => setMinUsage(e.target.value)} helperText="e.g. 30s, 1m; bare number = ns / bytes" sx={{ width: 200 }} />
            <TextField size="small" label="Max usage (exclusive)" value={maxUsage} onChange={e => setMaxUsage(e.target.value)} sx={{ width: 200 }} />
            <TextField size="small" label="Min cost" type="number" value={minCost} onChange={e => setMinCost(e.target.value)} sx={{ width: 140 }} />
            <TextField size="small" label="Max cost (exclusive)" type="number" value={maxCost} onChange={e => setMaxCost(e.target.value)} helperText="-1 = unrated only" sx={{ width: 170 }} />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Extra fields</Typography>
            {extraFields.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                <TextField size="small" label="Field" value={r.key} onChange={e => setExtraFields(p => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
                <MatchSelect exclude={r.exclude} onChange={exclude => setExtraFields(p => p.map((x, j) => j === i ? { ...x, exclude } : x))} />
                <TextField size="small" label="Value" value={r.value} onChange={e => setExtraFields(p => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <IconButton size="small" onClick={() => setExtraFields(p => p.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setExtraFields(p => [...p, { key: '', value: '', exclude: false }])}>Add extra field</Button>
          </Box>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
          <TextField select size="small" label="Order by" value={orderBy} onChange={e => setOrderBy(e.target.value)} sx={{ width: 160 }}>
            <MenuItem value=""><em>Storage order</em></MenuItem>
            {ORDER_BY_FIELDS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
          <ToggleButtonGroup size="small" exclusive value={orderBy ? orderDir : null} onChange={(_, v) => v && setOrderDir(v)} disabled={!orderBy}>
            <ToggleButton value="asc">Asc</ToggleButton>
            <ToggleButton value="desc">Desc</ToggleButton>
          </ToggleButtonGroup>
          <TextField size="small" label="Page size" type="number" value={limit} onChange={e => setLimit(Math.max(1, parseInt(e.target.value) || 1))} sx={{ width: 110 }} />
          <Button variant="contained" onClick={search}>Search</Button>
          <Button variant="outlined" color="secondary" disabled={!lastFilter || noResults} onClick={() => { setExportResult(null); setDeleteResult(null); setExportScope('page'); setDeleteAfterExport(false); setExportDeleteTyped(''); setExportOpen(true); }}>Export</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="text" color="inherit" endIcon={<MoreVertIcon />} disabled={!results.length} onClick={e => setBulkAnchor(e.currentTarget)}>Bulk actions</Button>
          <Menu anchorEl={bulkAnchor} open={!!bulkAnchor} onClose={() => setBulkAnchor(null)}>
            <MenuItem onClick={() => { setBulkAnchor(null); setRateResult(null); setRateTyped(''); setRateScope('page'); setRateOpen(true); }}>
              Re-rate… ({results.length} shown{total !== null ? `, ${total} matching` : ''})
            </MenuItem>
            <MenuItem sx={{ color: 'error.main' }} onClick={() => { setBulkAnchor(null); setDeleteResult(null); setDeleteTyped(''); setDeleteOpen(true); }}>
              Delete the {results.length} shown CDRs…
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      {responseTime && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Response from CGrateS in {responseTime} seconds{total !== null ? ` · ${total} matching CDRs` : ''}
        </Typography>
      )}

      {apiQuery && (
        <Paper sx={{ p: 1, mb: 2, bgcolor: 'action.hover', maxHeight: 200, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary">API Query:</Typography>
          <pre style={{ fontSize: 11, margin: 0 }}>{apiQuery}</pre>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>{sortHeader('SetupTime', 'Setup time')}</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Destination</TableCell>
                  <TableCell>RunID</TableCell>
                  <TableCell>{sortHeader('Cost', 'Cost')}</TableCell>
                  <TableCell>{sortHeader('Usage', 'Usage')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.length > 0 ? results.map((cdr, idx) => (
                  <TableRow key={`${cdr.CGRID}-${cdr.RunID}`} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedCDR(cdr); setDetailOpen(true); }}>
                    <TableCell>{offset + idx + 1}</TableCell>
                    <TableCell title={cdr.SetupTime}>{formatDateTime(cdr.SetupTime)}</TableCell>
                    <TableCell>{cdr.Account}</TableCell>
                    <TableCell>{cdr.Subject}</TableCell>
                    <TableCell>{cdr.Category}</TableCell>
                    <TableCell>{cdr.Destination}</TableCell>
                    <TableCell>{cdr.RunID}</TableCell>
                    <TableCell sx={cdr.Cost === -1 ? { color: 'text.secondary', fontStyle: 'italic' } : undefined}>{formatCost(cdr.Cost)}</TableCell>
                    <TableCell>{formatUsage(cdr.Usage, cdr.ToR)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={9} align="center">{noResults ? 'No CDRs' : 'Run a search to list CDRs'}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Button disabled={!lastFilter || offset === 0} onClick={() => goToPage(Math.max(0, offset - limit))}>Previous</Button>
            <Typography sx={{ py: 1 }}>Page {Math.floor(offset / limit) + 1}{pages !== null ? ` of ${pages}` : ''}</Typography>
            <Button disabled={!lastFilter || (total !== null ? offset + limit >= total : results.length < limit)} onClick={() => goToPage(offset + limit)}>Next</Button>
          </Box>

          {results.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1">Totals by Category (this page)</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Count</TableCell><TableCell>Total Cost</TableCell></TableRow></TableHead>
                <TableBody>
                  {Object.entries(categoryTotals).map(([cat, v]) => (
                    <TableRow key={cat}><TableCell>{cat}</TableCell><TableCell>{v.count}</TableCell><TableCell>{v.cost.toFixed(4)}{v.unrated ? ` (${v.unrated} not rated)` : ''}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>CDR details</DialogTitle>
        <DialogContent>{selectedCDR && <CdrDetail cdr={selectedCDR} />}</DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Export CDRs</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <IdMultiSelect label="Exporter IDs" value={selectedExporters} options={exporterIds} onChange={setSelectedExporters}
              helperText={exporterError ? `Could not list exporters: ${exporterError}` : 'From the ees section of the CGrateS config'} />
            {scopeRadio(exportScope, s => { setExportScope(s); if (s === 'all') setDeleteAfterExport(false); }, 'Export')}
            <FormControlLabel control={<Switch checked={isVerbose} onChange={e => setIsVerbose(e.target.checked)} />} label="Verbose" />
            <FormControlLabel
              control={<Switch checked={deleteAfterExport} disabled={exportScope !== 'page'} onChange={e => setDeleteAfterExport(e.target.checked)} />}
              label={`Delete the ${results.length} shown CDRs after export`} />
            {deleteAfterExport && <Alert severity="warning">After exporting, exactly the {results.length} CDRs on this page are permanently deleted.</Alert>}
            {deleteAfterExport && <TypedCount count={results.length} value={exportDeleteTyped} onChange={setExportDeleteTyped} />}
            {exportResult && (
              <Paper sx={{ p: 1, bgcolor: 'action.hover', maxHeight: 300, overflow: 'auto' }}>
                <Typography variant="caption">Export Result:</Typography>
                <pre style={{ fontSize: 11, margin: 0 }}>{exportResult}</pre>
              </Paper>
            )}
            {deleteResult && <Alert severity="info">{deleteResult}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleExport} disabled={isExporting || isDeleting || !selectedExporters.length || (deleteAfterExport && exportDeleteTyped !== String(results.length))}>
            {isExporting || isDeleting ? <CircularProgress size={20} /> : `Export ${scopeCount(exportScope)} CDRs${deleteAfterExport ? ' and delete them' : ''}`}
          </Button>
          <Button onClick={() => setExportOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rateOpen} onClose={() => setRateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Re-rate CDRs</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <RadioGroup row value={rateMethod} onChange={e => setRateMethod(e.target.value as 'rate' | 'reprocess')}>
              <FormControlLabel value="rate" control={<Radio size="small" />} label="CDRsV1.RateCDRs" />
              <FormControlLabel value="reprocess" control={<Radio size="small" />} label="CDRsV1.ReprocessCDRs" />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary">
              {rateMethod === 'rate'
                ? 'Clears the cost and rates again through RALs; other flags default to the cdrs config.'
                : 'Runs the stored CDRs through the pipeline again; only the flags given here are applied.'}
            </Typography>
            <IdMultiSelect label="Flags" value={rateFlags} options={RATE_FLAGS} onChange={setRateFlags} helperText='Add ":false" to disable one, e.g. *store:false' />
            {scopeRadio(rateScope, setRateScope, 'Re-rate')}
            <Alert severity="warning">This changes {scopeCount(rateScope)} stored CDRs and may debit accounts.</Alert>
            <TypedCount count={scopeCount(rateScope)} value={rateTyped} onChange={setRateTyped} />
            {rateResult && <Alert severity={rateResult === 'OK' ? 'success' : 'error'}>{rateResult}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleRate} disabled={isRating || rateTyped !== String(scopeCount(rateScope)) || !scopeCount(rateScope)}>
            {isRating ? <CircularProgress size={20} /> : `Re-rate ${scopeCount(rateScope)} CDRs`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete CDRs</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
            This permanently deletes exactly the {results.length} CDRs shown on this page (matched by CGRID and RunID). It cannot be undone.
          </Alert>
          <Paper sx={{ p: 1, bgcolor: 'action.hover', mb: 2, maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="caption">RemoveCDRs requests:</Typography>
            <pre style={{ fontSize: 11, margin: 0 }}>{JSON.stringify(pageFilters, null, 2)}</pre>
          </Paper>
          <TypedCount count={results.length} value={deleteTyped} onChange={setDeleteTyped} />
          {deleteResult && <Alert severity="info" sx={{ mt: 2 }}>{deleteResult}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteCDRs} disabled={isDeleting || !results.length || deleteTyped !== String(results.length)}>
            {isDeleting ? <CircularProgress size={20} /> : `Delete ${results.length} CDRs`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
