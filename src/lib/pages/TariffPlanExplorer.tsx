import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, TextField, InputAdornment,
  List, ListItemButton, ListItemText, CircularProgress, Alert, Breadcrumbs,
  Link, Card, CardActionArea, CardContent, Table, TableBody, TableCell,
  TableRow, Stack, Tooltip, } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CategoryIcon from '@mui/icons-material/Category';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PublicIcon from '@mui/icons-material/Public';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useQuery } from '@tanstack/react-query';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import { formatDateTime } from '../formatTime';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';

// ---- Entity model ---------------------------------------------------------

type EntityType = 'ratingprofile' | 'tpratingprofile' | 'ratingplan' | 'destinationrate' | 'rate' | 'destination' | 'timing';

interface ExNode { type: EntityType; id: string; }

const TYPE_META: Record<EntityType, { label: string; plural: string; color: string; Icon: typeof AccountTreeIcon }> = {
  ratingprofile: { label: 'Rating Profile (live)', plural: 'Rating Profiles (live)', color: '#ec407a', Icon: CategoryIcon },
  tpratingprofile: { label: 'Rating Profile (stored)', plural: 'Rating Profiles (stored)', color: '#8d6e63', Icon: CategoryIcon },
  ratingplan: { label: 'Rating Plan', plural: 'Rating Plans', color: '#42a5f5', Icon: AccountTreeIcon },
  destinationrate: { label: 'Destination Rate', plural: 'Destination Rates', color: '#ab47bc', Icon: CallSplitIcon },
  rate: { label: 'Rate', plural: 'Rates', color: '#ffa726', Icon: MonetizationOnIcon },
  destination: { label: 'Destination', plural: 'Destinations', color: '#66bb6a', Icon: PublicIcon },
  timing: { label: 'Timing', plural: 'Timings', color: '#26c6da', Icon: ScheduleIcon },
};

const ENTRY_ORDER: EntityType[] = ['ratingprofile', 'tpratingprofile', 'ratingplan', 'destinationrate', 'rate', 'destination', 'timing'];

// Rating-profile IDs come back as "category:subject" (the *out:tenant: prefix is
// stripped by the backend). Tenant is supplied separately — it is part of the key.
function splitProfileId(id: string): { category: string; subject: string } {
  const i = id.indexOf(':');
  return i < 0 ? { category: id, subject: '' } : { category: id.slice(0, i), subject: id.slice(i + 1) };
}

/** Why a list is empty, so zero never reads as "nothing exists anywhere". */
function emptyReason(type: EntityType, tpid: string, tenant: string) {
  if (type === 'ratingprofile') return `No live rating profiles for tenant ${tenant}`;
  return `No ${TYPE_META[type].plural.toLowerCase()} in tariff plan ${tpid}`;
}

// ---- Data hooks -----------------------------------------------------------

function idsQueryFn(baseUrl: string, tpid: string, tenant: string, type: EntityType): Promise<string[] | null> {
  switch (type) {
    case 'ratingprofile': return api.getRatingProfileIDs(baseUrl, tenant);
    case 'tpratingprofile': return api.getTPRatingProfileIds(baseUrl, tpid);
    case 'ratingplan': return api.getTPRatingPlanIds(baseUrl, tpid);
    case 'destinationrate': return api.getTPDestinationRateIds(baseUrl, tpid);
    case 'rate': return api.getTPRateIds(baseUrl, tpid);
    case 'destination': return api.getTPDestinationIDs(baseUrl, tpid);
    case 'timing': return api.getTPTimingIds(baseUrl, tpid);
  }
}

function detailQueryFn(baseUrl: string, tpid: string, tenant: string, node: ExNode): Promise<unknown> {
  switch (node.type) {
    case 'ratingprofile': { const { category, subject } = splitProfileId(node.id); return api.getRatingProfile(baseUrl, tenant, category, subject); }
    case 'tpratingprofile': return api.getTPRatingProfile(baseUrl, tpid, node.id);
    case 'ratingplan': return api.getTPRatingPlan(baseUrl, tpid, node.id);
    case 'destinationrate': return api.getTPDestinationRate(baseUrl, tpid, node.id);
    case 'rate': return api.getTPRate(baseUrl, tpid, node.id);
    case 'destination': return api.getTPDestination(baseUrl, tpid, node.id);
    case 'timing': return api.getTPTiming(baseUrl, tpid, node.id);
  }
}

// cgrates returns NOT_FOUND (an error) rather than an empty list when a category
// has no entries — treat that as "empty" so the column shows nothing, not an error.
async function safeIds(fn: () => Promise<string[] | null>): Promise<string[]> {
  try { return (await fn()) || []; }
  catch (e) { if (String((e as Error)?.message || e).includes('NOT_FOUND')) return []; throw e; }
}

function useEntityIds(baseUrl: string | null, tpid: string, tenant: string, type: EntityType, enabled: boolean) {
  // Rating profiles are tenant-scoped and independent of the TP; everything else is TP-scoped.
  const tpScoped = type !== 'ratingprofile';
  return useQuery({
    queryKey: ['tpx-ids', baseUrl, tpScoped ? tpid : `tenant:${tenant}`, type],
    queryFn: () => safeIds(() => idsQueryFn(baseUrl!, tpid, tenant, type)),
    enabled: !!baseUrl && enabled && (tpScoped ? !!tpid : true),
    staleTime: 60_000,
  });
}

function useEntityDetail(baseUrl: string | null, tpid: string, tenant: string, node: ExNode | null) {
  return useQuery({
    queryKey: ['tpx-detail', baseUrl, tpid, tenant, node?.type, node?.id],
    queryFn: () => detailQueryFn(baseUrl!, tpid, tenant, node!),
    enabled: !!baseUrl && !!node && (node!.type === 'ratingprofile' || !!tpid),
    staleTime: 60_000,
  });
}

// ---- Small building blocks ------------------------------------------------

function RefChip({ type, id, onClick, disabled }: { type: EntityType; id: string; onClick?: () => void; disabled?: boolean }) {
  const meta = TYPE_META[type];
  return (
    <Chip
      size="small"
      icon={<meta.Icon sx={{ fontSize: 16, color: `${meta.color} !important` }} />}
      label={id}
      onClick={disabled ? undefined : onClick}
      clickable={!disabled}
      variant="outlined"
      sx={{
        borderColor: meta.color,
        color: meta.color,
        fontWeight: 500,
        maxWidth: '100%',
        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    />
  );
}

function ColumnShell({ node, children }: { node: ExNode; children: React.ReactNode }) {
  const meta = TYPE_META[node.type];
  return (
    <Paper
      variant="outlined"
      sx={{ flex: '1 0 320px', minWidth: 320, height: '100%', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${meta.color}` }}
    >
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <meta.Icon sx={{ color: meta.color }} fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: meta.color, display: 'block', lineHeight: 1 }}>
              {meta.label}{node.type === 'ratingprofile' ? ' · DataDB' : ' · stored, StorDB'}
            </Typography>
            <Tooltip title={node.id}><Typography variant="subtitle2" noWrap>{node.id}</Typography></Tooltip>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>{children}</Box>
    </Paper>
  );
}

// ---- Detail renderers -----------------------------------------------------

interface RatingPlanBinding { DestinationRatesId: string; TimingId: string; Weight: number; }
interface DestRateRow { DestinationId: string; RateId: string; RoundingMethod: string; RoundingDecimals: number; MaxCost: number; MaxCostStrategy: string; }
interface RateSlot { ConnectFee: number; Rate: number; RateUnit: string; RateIncrement: string; GroupIntervalStart: string; }
interface RatingPlanActivation { ActivationTime: string; RatingPlanId: string; FallbackKeys?: string[] | null; FallbackSubjects?: string; }

/** Last segment of "*out:tenant:category:subject" fallback keys. */
const fallbackLabel = (key: string) => key.split(':').slice(3).join(':') || key;

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0, '& + &': { mt: 0.5 } }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 112, flexShrink: 0 }}>{k}</Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Box>
  );
}

function ActivationsTable({ acts, onOpen }: { acts: RatingPlanActivation[]; onOpen: (child: ExNode) => void }) {
  if (acts.length === 0) return <Typography variant="body2" color="text.secondary">No activations</Typography>;
  return (
    <Stack spacing={0.75}>
      {acts.map((a, i) => {
        const fbs = a.FallbackKeys ? a.FallbackKeys.map(k => ({ label: fallbackLabel(k), title: k }))
          : (a.FallbackSubjects || '').split(';').filter(Boolean).map(x => ({ label: x, title: x }));
        return (
          <Paper key={i} variant="outlined" sx={{ p: 1 }}>
            <KV k="Active from"><Tooltip title={a.ActivationTime}><Typography variant="body2">{formatDateTime(a.ActivationTime)}</Typography></Tooltip></KV>
            <KV k="Rating plan"><RefChip type="ratingplan" id={a.RatingPlanId} onClick={() => onOpen({ type: 'ratingplan', id: a.RatingPlanId })} /></KV>
            <KV k="Fallback">{fbs.length ? fbs.map(f => <Tooltip key={f.title} title={f.title}><Chip size="small" label={f.label} sx={{ mr: 0.5 }} /></Tooltip>) : <Typography variant="body2">None</Typography>}</KV>
          </Paper>
        );
      })}
    </Stack>
  );
}

function DetailBody({ node, detail, onOpen }: { node: ExNode; detail: unknown; onOpen: (child: ExNode) => void }) {
  const d = detail as Record<string, unknown> | null;
  if (!d) return <Typography variant="body2" color="text.secondary">No data</Typography>;

  if (node.type === 'ratingprofile') {
    const acts = (d.RatingPlanActivations as RatingPlanActivation[]) || [];
    // The engine can store repeated identical activations; collapse them for display.
    const seen = new Set<string>();
    const uniq = acts.filter(a => { const k = `${a.ActivationTime}|${a.RatingPlanId}`; if (seen.has(k)) return false; seen.add(k); return true; });
    // Full id is "*out:tenant:category:subject"; fall back to the node id for category/subject.
    const idParts = String(d.Id || '').split(':');
    const tenant = idParts.length >= 4 ? idParts[1] : '';
    const { category, subject } = splitProfileId(node.id);
    return (
      <Box>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }} useFlexGap>
          <Chip size="small" icon={<CategoryIcon sx={{ fontSize: 16, color: `${TYPE_META.ratingprofile.color} !important` }} />}
            label={`Category: ${category}`} sx={{ bgcolor: TYPE_META.ratingprofile.color, color: '#000', fontWeight: 600 }} />
          <Chip size="small" variant="outlined" label={`Subject: ${subject || '*any'}`} />
        </Stack>
        {tenant && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Tenant: <b>{tenant}</b></Typography>}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Rating Plan Activations</Typography>
        <ActivationsTable acts={uniq} onOpen={onOpen} />
      </Box>
    );
  }

  if (node.type === 'tpratingprofile') {
    return (
      <Box>
        <Table size="small" sx={{ mb: 1.5 }}><TableBody>
          {(['LoadId', 'Tenant', 'Category', 'Subject'] as const).map(k => (
            <TableRow key={k}><TableCell sx={{ fontWeight: 600 }}>{k}</TableCell><TableCell>{String(d[k] ?? '')}</TableCell></TableRow>
          ))}
        </TableBody></Table>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Rating Plan Activations</Typography>
        <ActivationsTable acts={(d.RatingPlanActivations as RatingPlanActivation[]) || []} onOpen={onOpen} />
      </Box>
    );
  }

  if (node.type === 'ratingplan') {
    const bindings = (d.RatingPlanBindings as RatingPlanBinding[]) || [];
    return (
      <Stack spacing={0.75}>
        {bindings.map((b, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1 }}>
            <KV k="Destination rate"><RefChip type="destinationrate" id={b.DestinationRatesId} onClick={() => onOpen({ type: 'destinationrate', id: b.DestinationRatesId })} /></KV>
            <KV k="Timing">{b.TimingId && b.TimingId !== '*any'
              ? <RefChip type="timing" id={b.TimingId} onClick={() => onOpen({ type: 'timing', id: b.TimingId })} />
              : <Chip size="small" label={b.TimingId || '*any'} variant="outlined" />}</KV>
            <KV k="Weight"><Typography variant="body2">{b.Weight}</Typography></KV>
          </Paper>
        ))}
        {bindings.length === 0 && <Typography variant="body2" color="text.secondary">No bindings</Typography>}
      </Stack>
    );
  }

  if (node.type === 'destinationrate') {
    const rows = (d.DestinationRates as DestRateRow[]) || [];
    return <DestRateTable rows={rows} onOpen={onOpen} />;
  }

  if (node.type === 'rate') {
    const slots = (d.RateSlots as RateSlot[]) || [];
    return (
      <Box>
        {slots.map((s, i) => (
          <Card key={i} variant="outlined" sx={{ mb: 1.5, borderLeft: `3px solid ${TYPE_META.rate.color}` }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h5" sx={{ color: TYPE_META.rate.color }}>
                {s.Rate}<Typography component="span" variant="body2" color="text.secondary"> per {s.RateUnit}</Typography>
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
                <Metric label="Connect fee" value={String(s.ConnectFee)} />
                <Metric label="Increment" value={s.RateIncrement} />
                <Metric label="From" value={s.GroupIntervalStart} />
              </Stack>
            </CardContent>
          </Card>
        ))}
        {slots.length === 0 && <Typography variant="body2" color="text.secondary">No rate slots</Typography>}
      </Box>
    );
  }

  if (node.type === 'destination') {
    const prefixes = (d.Prefixes as string[]) || [];
    return (
      <Box>
        <Typography variant="caption" color="text.secondary">{prefixes.length} prefixes</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {prefixes.map(p => <Chip key={p} size="small" label={p} sx={{ fontFamily: 'monospace' }} />)}
        </Box>
      </Box>
    );
  }

  // timing (StorDB form: ";"-joined lists, Time "start;end")
  const [start, end] = String(d.Time || '').split(';');
  const rows: [string, string][] = [
    ['Years', String(d.Years)], ['Months', String(d.Months)], ['MonthDays', String(d.MonthDays)],
    ['WeekDays', String(d.WeekDays)], ['Start time', start || '-'], ['End time', end || '-'],
  ];
  return (
    <Table size="small"><TableBody>
      {rows.map(([k, v]) => (
        <TableRow key={k}><TableCell sx={{ fontWeight: 600 }}>{k}</TableCell><TableCell>{v}</TableCell></TableRow>
      ))}
    </TableBody></Table>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function DestRateTable({ rows, onOpen }: { rows: DestRateRow[]; onOpen: (child: ExNode) => void }) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? rows.filter(r => r.DestinationId.toLowerCase().includes(q) || r.RateId.toLowerCase().includes(q)) : rows;
  }, [rows, filter]);
  return (
    <Box>
      <TextField size="small" fullWidth placeholder="Filter destinations / rates" value={filter} onChange={e => setFilter(e.target.value)}
        sx={{ mb: 1 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{shown.length} of {rows.length} mappings</Typography>
      <Stack spacing={0.75}>
        {shown.map((r, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 0.75 }}>
            <RefChip type="destination" id={r.DestinationId} onClick={() => onOpen({ type: 'destination', id: r.DestinationId })} />
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, pl: 0.5 }}>
              <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              <RefChip type="rate" id={r.RateId} onClick={() => onOpen({ type: 'rate', id: r.RateId })} />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

// ---- Columns --------------------------------------------------------------

function EntryColumn({ baseUrl, tpid, tenant, active, entryType, onOpen }: {
  baseUrl: string | null; tpid: string; tenant: string; active: ExNode | null;
  entryType: EntityType; onOpen: (n: ExNode) => void;
}) {
  const [filter, setFilter] = useState('');
  useEffect(() => { setFilter(''); }, [entryType]);
  const { data: ids, isLoading, error } = useEntityIds(baseUrl, tpid, tenant, entryType, true);
  const shown = useMemo(() => {
    const list = ids || [];
    const q = filter.trim().toLowerCase();
    return q ? list.filter(id => id.toLowerCase().includes(q)) : list;
  }, [ids, filter]);

  return (
    <Paper variant="outlined" sx={{ flex: '1 0 320px', minWidth: 320, maxWidth: 440, height: '100%', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${TYPE_META[entryType].color}` }}>
      <Box sx={{ p: 1.5, pb: 1 }}>
        <Typography variant="caption" sx={{ color: TYPE_META[entryType].color, fontWeight: 600 }}>{TYPE_META[entryType].plural}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {entryType === 'ratingprofile'
            ? <>live DataDB, tenant {tenant} · <code>category:subject</code></>
            : entryType === 'tpratingprofile'
              ? <>stored tariff plan {tpid}, every tenant · <code>loadid:tenant:category:subject</code></>
              : <>stored tariff plan {tpid}</>}
        </Typography>
        <TextField size="small" fullWidth placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)}
          sx={{ mt: 0.5 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={22} /></Box>
          : error ? <Alert severity="error" sx={{ m: 1 }}>{(error as Error).message}</Alert>
          : shown.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{filter.trim() ? `Nothing matches “${filter.trim()}”` : emptyReason(entryType, tpid, tenant)}</Typography>
          : (
            <List dense disablePadding>
              {shown.map(id => (
                <ListItemButton key={id} selected={active?.type === entryType && active.id === id} onClick={() => onOpen({ type: entryType, id })}>
                  <ListItemText primary={id} primaryTypographyProps={{ noWrap: true, variant: 'body2' }} />
                  <ChevronRightIcon fontSize="small" color="action" />
                </ListItemButton>
              ))}
            </List>
          )}
      </Box>
    </Paper>
  );
}

function DetailColumn({ baseUrl, tpid, tenant, node, selectedChild, onOpen }: {
  baseUrl: string | null; tpid: string; tenant: string; node: ExNode; selectedChild: ExNode | null; onOpen: (child: ExNode) => void;
}) {
  const { data, isLoading, error } = useEntityDetail(baseUrl, tpid, tenant, node);
  return (
    <ColumnShell node={node}>
      {isLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        : error ? <Alert severity="error">{(error as Error).message}</Alert>
        : <DetailBody node={node} detail={data} onOpen={onOpen} />}
      {selectedChild && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          ▸ exploring {TYPE_META[selectedChild.type].label} <b>{selectedChild.id}</b>
        </Typography>
      )}
    </ColumnShell>
  );
}

// ---- Page -----------------------------------------------------------------

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [tpid, setTpid] = useState('');
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [entryType, setEntryType] = useState<EntityType>('ratingprofile');
  const [path, setPath] = useState<ExNode[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tpids, isLoading: tpidsLoading, error: tpidsError } = useQuery({
    queryKey: ['tpx-tpids', baseUrl],
    queryFn: () => api.getTPIds(baseUrl!),
    enabled: !!baseUrl,
  });

  useEffect(() => { setPath([]); }, [tpid, tenant]);

  // Scroll to reveal the newest column as the user drills deeper.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [path.length]);

  const openFromEntry = (n: ExNode) => setPath([n]);
  const openFromDepth = (depth: number, child: ExNode) => setPath(p => [...p.slice(0, depth + 1), child]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      <Typography variant="h5" gutterBottom>Tariff Plan Explorer</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SearchableSelect label="Stored tariff plan" value={tpid} options={tpids || []} onChange={setTpid} disableClearable sx={{ minWidth: 280 }} />
          <SearchableSelect label="Tenant (live rating profiles)" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 280 }} />
          {tpidsLoading && <CircularProgress size={20} />}
          {tpidsError && <Alert severity="error">{(tpidsError as Error).message}</Alert>}
          {!tpidsLoading && !tpidsError && (
            <Typography variant="body2" color="text.secondary">
              {(tpids || []).length} tariff plan{(tpids || []).length === 1 ? '' : 's'} stored in StorDB. Rating uses what was last loaded into DataDB (live).
            </Typography>
          )}
        </Stack>
      </Paper>

      <SummaryCards baseUrl={baseUrl} tpid={tpid} tenant={tenant} entryType={entryType} onPick={t => { setEntryType(t); setPath([]); }} />

      {!tpid && entryType !== 'ratingprofile' ? (
        <Alert severity="info">Pick a stored tariff plan to explore its rating plans, destination rates, rates, destinations and timings, or start from <b>Rating Profiles (live)</b> to trace tenant → category → rating plan → rate. Rating plans and below are always read from the selected stored tariff plan.</Alert>
      ) : (
        <>
          <Breadcrumbs sx={{ mb: 1 }}>
            <Link component="button" underline="hover" color="inherit" onClick={() => setPath([])}>{TYPE_META[entryType].plural}</Link>
            {path.map((n, i) => (
              <Link key={i} component="button" underline="hover" onClick={() => setPath(path.slice(0, i + 1))}
                sx={{ color: TYPE_META[n.type].color }}>{n.id}</Link>
            ))}
          </Breadcrumbs>

          <Box ref={scrollRef} sx={{ display: 'flex', gap: 1.5, flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
            <EntryColumn baseUrl={baseUrl} tpid={tpid} tenant={tenant} active={path[0] || null} entryType={entryType} onOpen={openFromEntry} />
            {path.map((node, depth) => (
              <DetailColumn key={`${depth}-${node.type}-${node.id}`} baseUrl={baseUrl} tpid={tpid} tenant={tenant} node={node}
                selectedChild={path[depth + 1] || null} onOpen={child => openFromDepth(depth, child)} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function SummaryCards({ baseUrl, tpid, tenant, entryType, onPick }: {
  baseUrl: string | null; tpid: string; tenant: string; entryType: EntityType; onPick: (t: EntityType) => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
      {ENTRY_ORDER.map(t => <SummaryCard key={t} baseUrl={baseUrl} tpid={tpid} tenant={tenant} type={t} active={entryType === t} onPick={() => onPick(t)} />)}
    </Box>
  );
}

function SummaryCard({ baseUrl, tpid, tenant, type, active, onPick }: {
  baseUrl: string | null; tpid: string; tenant: string; type: EntityType; active: boolean; onPick: () => void;
}) {
  const meta = TYPE_META[type];
  const { data, isLoading, error } = useEntityIds(baseUrl, tpid, tenant, type, true);
  const needsPlan = type !== 'ratingprofile' && !tpid;
  const n = (data || []).length;
  const note = needsPlan ? 'Pick a tariff plan' : error ? 'Failed to load' : !isLoading && n === 0
    ? (type === 'ratingprofile' ? 'None for this tenant' : 'None in this plan') : null;
  return (
    <Card variant="outlined" sx={{
      minWidth: 170, flex: '1 1 0', borderBottom: `3px solid ${meta.color}`,
      bgcolor: active ? 'action.selected' : undefined, outline: active ? `2px solid ${meta.color}` : 'none',
    }}>
      <Tooltip title={error ? (error as Error).message : n === 0 && !needsPlan && !isLoading ? emptyReason(type, tpid, tenant) : ''}>
        <CardActionArea onClick={onPick} aria-pressed={active} sx={{ p: 1.5, height: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <meta.Icon sx={{ color: meta.color }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" lineHeight={1} color={needsPlan || n === 0 ? 'text.secondary' : undefined}>
                {needsPlan ? '–' : isLoading ? '…' : error ? '!' : n}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: active ? 700 : 500 }}>{meta.plural}</Typography>
              {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{note}</Typography>}
            </Box>
          </Stack>
        </CardActionArea>
      </Tooltip>
    </Card>
  );
}
