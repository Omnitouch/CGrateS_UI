import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Chip, TextField, InputAdornment, Tabs, Tab,
  List, ListItemButton, ListItemText, CircularProgress, Alert, Breadcrumbs,
  Link, Card, CardActionArea, CardContent, Table, TableBody, TableCell,
  TableHead, TableRow, Stack, Tooltip, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PublicIcon from '@mui/icons-material/Public';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useQuery } from '@tanstack/react-query';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';

// ---- Entity model ---------------------------------------------------------

type EntityType = 'ratingplan' | 'destinationrate' | 'rate' | 'destination' | 'timing';

interface ExNode { type: EntityType; id: string; }

const TYPE_META: Record<EntityType, { label: string; plural: string; color: string; Icon: typeof AccountTreeIcon }> = {
  ratingplan: { label: 'Rating Plan', plural: 'Rating Plans', color: '#42a5f5', Icon: AccountTreeIcon },
  destinationrate: { label: 'Destination Rate', plural: 'Destination Rates', color: '#ab47bc', Icon: CallSplitIcon },
  rate: { label: 'Rate', plural: 'Rates', color: '#ffa726', Icon: MonetizationOnIcon },
  destination: { label: 'Destination', plural: 'Destinations', color: '#66bb6a', Icon: PublicIcon },
  timing: { label: 'Timing', plural: 'Timings', color: '#26c6da', Icon: ScheduleIcon },
};

const ENTRY_ORDER: EntityType[] = ['ratingplan', 'destinationrate', 'rate', 'destination', 'timing'];

// ---- Data hooks -----------------------------------------------------------

function idsQueryFn(baseUrl: string, tpid: string, type: EntityType): Promise<string[] | null> {
  switch (type) {
    case 'ratingplan': return api.getTPRatingPlanIds(baseUrl, tpid);
    case 'destinationrate': return api.getTPDestinationRateIds(baseUrl, tpid);
    case 'rate': return api.getTPRateIds(baseUrl, tpid);
    case 'destination': return api.getTPDestinationIDs(baseUrl, tpid);
    case 'timing': return api.getTPTimingIds(baseUrl, tpid);
  }
}

function detailQueryFn(baseUrl: string, tpid: string, node: ExNode): Promise<unknown> {
  switch (node.type) {
    case 'ratingplan': return api.getTPRatingPlan(baseUrl, tpid, node.id);
    case 'destinationrate': return api.getTPDestinationRate(baseUrl, tpid, node.id);
    case 'rate': return api.getTPRate(baseUrl, tpid, node.id);
    case 'destination': return api.getTPDestination(baseUrl, tpid, node.id);
    case 'timing': return api.getTiming(baseUrl, tpid, node.id);
  }
}

function useEntityIds(baseUrl: string | null, tpid: string, type: EntityType, enabled: boolean) {
  return useQuery({
    queryKey: ['tpx-ids', baseUrl, tpid, type],
    queryFn: async () => (await idsQueryFn(baseUrl!, tpid, type)) || [],
    enabled: !!baseUrl && !!tpid && enabled,
    staleTime: 60_000,
  });
}

function useEntityDetail(baseUrl: string | null, tpid: string, node: ExNode | null) {
  return useQuery({
    queryKey: ['tpx-detail', baseUrl, tpid, node?.type, node?.id],
    queryFn: () => detailQueryFn(baseUrl!, tpid, node!),
    enabled: !!baseUrl && !!tpid && !!node,
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
      sx={{ width: 340, minWidth: 340, height: '100%', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${meta.color}` }}
    >
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <meta.Icon sx={{ color: meta.color }} fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: meta.color, display: 'block', lineHeight: 1 }}>{meta.label}</Typography>
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

function DetailBody({ node, detail, onOpen }: { node: ExNode; detail: unknown; onOpen: (child: ExNode) => void }) {
  const d = detail as Record<string, unknown> | null;
  if (!d) return <Typography variant="body2" color="text.secondary">No data</Typography>;

  if (node.type === 'ratingplan') {
    const bindings = (d.RatingPlanBindings as RatingPlanBinding[]) || [];
    return (
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Destination Rate</TableCell><TableCell>Timing</TableCell><TableCell align="right">Weight</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {bindings.map((b, i) => {
            const bareTiming = b.TimingId && b.TimingId !== '*any';
            return (
              <TableRow key={i}>
                <TableCell><RefChip type="destinationrate" id={b.DestinationRatesId} onClick={() => onOpen({ type: 'destinationrate', id: b.DestinationRatesId })} /></TableCell>
                <TableCell>{bareTiming
                  ? <RefChip type="timing" id={b.TimingId} onClick={() => onOpen({ type: 'timing', id: b.TimingId })} />
                  : <Chip size="small" label={b.TimingId || '*any'} variant="outlined" />}</TableCell>
                <TableCell align="right">{b.Weight}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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

  // timing
  return (
    <Table size="small"><TableBody>
      {['Years', 'Months', 'MonthDays', 'WeekDays', 'Time'].map(k => (
        <TableRow key={k}><TableCell sx={{ fontWeight: 600 }}>{k}</TableCell><TableCell>{String((d[k] as unknown) ?? '*any')}</TableCell></TableRow>
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

function EntryColumn({ baseUrl, tpid, active, entryType, setEntryType, onOpen }: {
  baseUrl: string | null; tpid: string; active: ExNode | null;
  entryType: EntityType; setEntryType: (t: EntityType) => void; onOpen: (n: ExNode) => void;
}) {
  const [filter, setFilter] = useState('');
  const { data: ids, isLoading, error } = useEntityIds(baseUrl, tpid, entryType, true);
  const shown = useMemo(() => {
    const list = ids || [];
    const q = filter.trim().toLowerCase();
    return q ? list.filter(id => id.toLowerCase().includes(q)) : list;
  }, [ids, filter]);

  return (
    <Paper variant="outlined" sx={{ width: 300, minWidth: 300, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs value={entryType} onChange={(_, v) => { setEntryType(v); setFilter(''); }} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 40, '& .MuiTab-root': { minHeight: 40, minWidth: 0, px: 1.5 } }}>
        {ENTRY_ORDER.map(t => <Tab key={t} value={t} icon={<>{(() => { const I = TYPE_META[t].Icon; return <I fontSize="small" sx={{ color: TYPE_META[t].color }} />; })()}</>} />)}
      </Tabs>
      <Box sx={{ p: 1.5, pb: 1 }}>
        <Typography variant="caption" sx={{ color: TYPE_META[entryType].color, fontWeight: 600 }}>{TYPE_META[entryType].plural}</Typography>
        <TextField size="small" fullWidth placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)}
          sx={{ mt: 0.5 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={22} /></Box>
          : error ? <Alert severity="error" sx={{ m: 1 }}>{(error as Error).message}</Alert>
          : shown.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>None found</Typography>
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

function DetailColumn({ baseUrl, tpid, node, selectedChild, onOpen }: {
  baseUrl: string | null; tpid: string; node: ExNode; selectedChild: ExNode | null; onOpen: (child: ExNode) => void;
}) {
  const { data, isLoading, error } = useEntityDetail(baseUrl, tpid, node);
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
  const [entryType, setEntryType] = useState<EntityType>('ratingplan');
  const [path, setPath] = useState<ExNode[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tpids, isLoading: tpidsLoading, error: tpidsError } = useQuery({
    queryKey: ['tpx-tpids', baseUrl],
    queryFn: () => api.getTPIds(baseUrl!),
    enabled: !!baseUrl,
  });

  // Reset drill path when the tariff plan changes.
  useEffect(() => { setPath([]); }, [tpid]);

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
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Loaded Tariff Plan</InputLabel>
            <Select value={tpid} label="Loaded Tariff Plan" onChange={e => setTpid(e.target.value)}>
              {(tpids || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          {tpidsLoading && <CircularProgress size={20} />}
          {tpidsError && <Alert severity="error">{(tpidsError as Error).message}</Alert>}
          {!tpidsLoading && !tpidsError && <Typography variant="body2" color="text.secondary">{(tpids || []).length} tariff plan(s) loaded</Typography>}
        </Stack>
      </Paper>

      {!tpid ? (
        <Alert severity="info">Select a loaded tariff plan to start exploring its rating plans, destination rates, rates, destinations and timings.</Alert>
      ) : (
        <>
          {tpid && <SummaryCards baseUrl={baseUrl} tpid={tpid} entryType={entryType} onPick={t => { setEntryType(t); }} />}

          <Breadcrumbs sx={{ mb: 1 }}>
            <Link component="button" underline="hover" color="inherit" onClick={() => setPath([])}>{tpid}</Link>
            {path.map((n, i) => (
              <Link key={i} component="button" underline="hover" onClick={() => setPath(path.slice(0, i + 1))}
                sx={{ color: TYPE_META[n.type].color }}>{n.id}</Link>
            ))}
          </Breadcrumbs>

          <Box ref={scrollRef} sx={{ display: 'flex', gap: 1.5, flex: 1, overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
            <EntryColumn baseUrl={baseUrl} tpid={tpid} active={path[0] || null} entryType={entryType} setEntryType={setEntryType} onOpen={openFromEntry} />
            {path.map((node, depth) => (
              <DetailColumn key={`${depth}-${node.type}-${node.id}`} baseUrl={baseUrl} tpid={tpid} node={node}
                selectedChild={path[depth + 1] || null} onOpen={child => openFromDepth(depth, child)} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function SummaryCards({ baseUrl, tpid, entryType, onPick }: {
  baseUrl: string | null; tpid: string; entryType: EntityType; onPick: (t: EntityType) => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
      {ENTRY_ORDER.map(t => <SummaryCard key={t} baseUrl={baseUrl} tpid={tpid} type={t} active={entryType === t} onPick={() => onPick(t)} />)}
    </Box>
  );
}

function SummaryCard({ baseUrl, tpid, type, active, onPick }: {
  baseUrl: string | null; tpid: string; type: EntityType; active: boolean; onPick: () => void;
}) {
  const meta = TYPE_META[type];
  const { data, isLoading } = useEntityIds(baseUrl, tpid, type, true);
  return (
    <Card variant="outlined" sx={{ minWidth: 150, flex: '1 1 0', borderBottom: `3px solid ${meta.color}`, bgcolor: active ? 'action.selected' : undefined }}>
      <CardActionArea onClick={onPick} sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <meta.Icon sx={{ color: meta.color }} />
          <Box>
            <Typography variant="h6" lineHeight={1}>{isLoading ? '…' : (data || []).length}</Typography>
            <Typography variant="caption" color="text.secondary">{meta.plural}</Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
