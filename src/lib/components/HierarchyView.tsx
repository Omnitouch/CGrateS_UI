import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogTitle, IconButton, InputAdornment, Link, Paper,
  Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import ListIcon from '@mui/icons-material/FormatListBulleted';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import HierarchyTree, { LazyTreeContext, type HNode, type LazyTree } from './HierarchyTree';
import HierarchyDiagram, { type DiagramLane } from './HierarchyDiagram';

const DETAIL_CHIPS = 60;
const RAW_CHARS = 20000;
const INDEX_BUDGET = 20000;
const RESULTS_SHOWN = 40;

function rawText(raw: unknown) {
  const s = JSON.stringify(raw, null, 2);
  return s.length > RAW_CHARS ? `${s.slice(0, RAW_CHARS)}\n… ${s.length - RAW_CHARS} more characters` : s;
}

type Loaded = HNode[] | 'loading' | { error: string };
export type PrefixIndex = Map<string, string[]>;

interface Entry { path: HNode[]; text: string }

/** Every object below the roots, walked once so names and prefixes are searched in one place. */
async function buildIndex(roots: HNode[], load: (n: HNode) => Promise<HNode[]>) {
  const entries: Entry[] = [];
  let truncated = false;
  const walk = async (n: HNode, path: HNode[]): Promise<void> => {
    if (entries.length >= INDEX_BUDGET) { truncated = true; return; }
    const here = [...path, n];
    entries.push({ path: here, text: `${n.value} ${n.subtext ?? ''} ${n.badge ?? ''}`.toLowerCase() });
    const kids = await load(n).catch(() => [] as HNode[]);
    await Promise.all(kids.map(k => walk(k, here)));
  };
  await Promise.all(roots.map(r => walk(r, [])));
  return { entries, truncated };
}

interface RateResult { path: HNode[]; prefix: string; note?: string }

/**
 * How CGrateS picks a rate for a number, per rating profile: the activation in force now, then the
 * destination in that plan with the longest prefix the number starts with (literally, so a leading + counts),
 * heaviest binding on a tie, else the plan's *any destination, else the activation's fallback subjects.
 */
function ratePaths(num: string, roots: HNode[], kidsOf: (n: HNode) => HNode[], prefixes: PrefixIndex): { hits: RateResult[]; fallbacks: RateResult[] } {
  const hits: RateResult[] = [];
  const fallbacks: RateResult[] = [];
  for (const root of roots) {
    if (root.label !== 'Rating Profile') continue;
    const act = kidsOf(root).find(a => a.label === 'Activation' && a.status === 'success');
    if (!act) continue;
    const plan = kidsOf(act).find(k => k.label === 'Rating Plan');
    const dests: HNode[][] = [];
    const collect = (n: HNode, path: HNode[]) => {
      for (const k of kidsOf(n)) {
        if (k.label === 'Destination') dests.push([...path, k]);
        else collect(k, [...path, k]);
      }
    };
    if (plan) collect(plan, [root, act, plan]);
    const weightOf = (p: HNode[]) => p.slice(3).reduce<number | undefined>((w, n) => w ?? n.weight, undefined) ?? 0;
    let best: { p: HNode[]; prefix: string } | null = null;
    for (let len = num.length; len > 0 && !best; len--) {
      const pre = num.slice(0, len);
      const cands = dests.filter(p => (prefixes.get(p[p.length - 1].value) ?? []).includes(pre));
      if (cands.length) {
        const top = cands.reduce((a, b) => (weightOf(b) > weightOf(a) ? b : a));
        best = { p: top, prefix: pre };
        if (cands.length > 1) hits.push({ path: top, prefix: pre, note: `${cands.length} destinations share this prefix; the heaviest binding is shown` });
      }
    }
    if (best) {
      if (!hits.some(h => h.path === best!.p)) hits.push({ path: best.p, prefix: best.prefix });
      continue;
    }
    const any = dests.find(p => p[p.length - 1].value === '*any');
    if (any) { hits.push({ path: any, prefix: '*any' }); continue; }
    const fb = kidsOf(act).filter(k => k.label === 'Fallback subject');
    if (fb.length) fallbacks.push({ path: [root, act, fb[0]], prefix: '', note: `No destination in ${plan?.value ?? 'the plan'} matches; CGrateS would try subject ${fb.map(f => f.value).join(', ')}` });
  }
  return { hits, fallbacks };
}

function findPath(roots: HNode[], id: string, kidsOf: (n: HNode) => HNode[] | undefined): HNode[] | null {
  for (const r of roots) {
    if (r.id === id) return [r];
    const p = findPath(kidsOf(r) ?? [], id, kidsOf);
    if (p) return [r, ...p];
  }
  return null;
}

interface HierarchyViewProps {
  lanes: DiagramLane[];
  query: string;
  onQueryChange: (q: string) => void;
  /** Destination ID → prefixes, loaded the first time anything is searched. */
  prefixIndex: () => Promise<PrefixIndex>;
  /** "live rating profile" or similar, for the no-match message. */
  scope: string;
  notice?: ReactNode;
}

/** Diagram of every root in lanes, with one search for names, prefixes and phone numbers, an optional outline and a details panel. */
export default function HierarchyView({ lanes, query, onQueryChange, prefixIndex, scope, notice }: HierarchyViewProps) {
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [extra, setExtra] = useState<Record<string, Partial<HNode>>>({});
  const pending = useRef(new Map<string, Promise<HNode[]>>());
  const requested = useRef(new Set<string>());
  const [sel, setSel] = useState<string[]>([]);
  const [outline, setOutline] = useState(false);
  const [details, setDetails] = useState(true);
  const [editing, setEditing] = useState(false);
  const [index, setIndex] = useState<{ entries: Entry[]; truncated: boolean } | 'loading' | null>(null);
  const [prefixes, setPrefixes] = useState<PrefixIndex | 'loading' | { error: string } | null>(null);

  const roots = useMemo(() => lanes.flatMap(l => l.roots), [lanes]);
  const withExtra = useCallback((n: HNode) => (extra[n.id] ? { ...n, ...extra[n.id] } : n), [extra]);

  const load = useCallback((n: HNode): Promise<HNode[]> => {
    if (n.children) return Promise.resolve(n.children);
    if (!n.loadChildren) return Promise.resolve([]);
    let p = pending.current.get(n.id);
    if (!p) {
      p = n.loadChildren();
      pending.current.set(n.id, p);
      setLoaded(s => ({ ...s, [n.id]: 'loading' }));
      p.then(kids => setLoaded(s => ({ ...s, [n.id]: kids })),
        e => { pending.current.delete(n.id); setLoaded(s => ({ ...s, [n.id]: { error: e instanceof Error ? e.message : String(e) } })); });
    }
    return p;
  }, []);

  const childrenOf = useCallback((n: HNode) => {
    const kids = n.children ?? (Array.isArray(loaded[n.id]) ? loaded[n.id] as HNode[] : undefined);
    return kids?.map(withExtra);
  }, [loaded, withExtra]);

  const loadDetails = useCallback((n: HNode) => {
    if (!n.loadDetails || requested.current.has(n.id)) return;
    requested.current.add(n.id);
    n.loadDetails()
      .then(d => setExtra(s => ({ ...s, [n.id]: d })))
      .catch(e => setExtra(s => ({ ...s, [n.id]: { status: 'error', details: [['Error', e instanceof Error ? e.message : String(e)]] } })));
  }, []);

  // --- search ---
  const q = query.trim();
  const ql = q.toLowerCase();
  const digits = /^\+?\d+$/.test(q);

  useEffect(() => {
    if (!q || index !== null) return;
    setIndex('loading');
    buildIndex(roots, load).then(setIndex);
  }, [q, index, roots, load]);
  useEffect(() => { setIndex(null); }, [roots]);
  useEffect(() => {
    if (!q || prefixes !== null) return;
    setPrefixes('loading');
    prefixIndex().then(setPrefixes).catch(e => setPrefixes({ error: e instanceof Error ? e.message : String(e) }));
  }, [q, prefixes, prefixIndex]);

  const ready = index && index !== 'loading' && prefixes instanceof Map ? { entries: index.entries, prefixes } : null;
  const matches = useMemo(() => {
    if (!q || !ready) return null;
    return ready.entries.filter(e => e.text.includes(ql)
      || (digits && e.path[e.path.length - 1].label === 'Destination'
        && (ready.prefixes.get(e.path[e.path.length - 1].value) ?? []).some(p => p.startsWith(q))));
  }, [q, ql, digits, ready]);
  const rating = useMemo(() => {
    if (!digits || !ready) return null;
    return ratePaths(q, roots, n => childrenOf(n) ?? [], ready.prefixes);
  }, [digits, ready, q, roots, childrenOf]);

  // Destinations with the prefix that nothing drawn here uses, so "no match" isn't mistaken for "not defined".
  const unused = useMemo(() => {
    if (!digits || !ready) return [];
    const reached = new Set(ready.entries.filter(e => e.path[e.path.length - 1].label === 'Destination').map(e => e.path[e.path.length - 1].value));
    return [...ready.prefixes.entries()].filter(([id, px]) => !reached.has(id) && px.some(p => p.startsWith(q) || q.startsWith(p))).map(([id]) => id).sort();
  }, [digits, ready, q]);

  const highlight = useMemo(() => {
    const s = new Set<string>();
    rating?.hits.forEach(h => h.path.forEach(n => s.add(n.id)));
    matches?.forEach(m => s.add(m.path[m.path.length - 1].id));
    return s;
  }, [rating, matches]);

  const lastAuto = useRef('');
  useEffect(() => {
    if (!rating || lastAuto.current === q) return;
    lastAuto.current = q;
    const first = rating.hits[0] ?? rating.fallbacks[0];
    if (first) setSel(first.path.map(n => n.id));
  }, [rating, q]);

  const shownLanes = useMemo(() => {
    if (!q) return lanes;
    const keep = new Set<string>();
    if (matches) matches.forEach(m => keep.add(m.path[0].id));
    else roots.forEach(r => { if (r.value.toLowerCase().includes(ql)) keep.add(r.id); });
    rating?.hits.forEach(h => keep.add(h.path[0].id));
    rating?.fallbacks.forEach(h => keep.add(h.path[0].id));
    return lanes.map(l => ({ ...l, roots: l.roots.filter(r => keep.has(r.id)) })).filter(l => l.roots.length);
  }, [q, ql, lanes, roots, matches, rating]);

  // --- selection ---
  useEffect(() => {
    if (!sel.length && roots.length) setSel([roots[0].id]);
  }, [sel.length, roots]);

  const path = useMemo(() => {
    const out: HNode[] = [];
    let level: HNode[] = roots.map(withExtra);
    for (const id of sel) {
      const n = level.find(x => x.id === id);
      if (!n) break;
      out.push(n);
      level = childrenOf(n) ?? [];
    }
    return out;
  }, [sel, roots, childrenOf, withExtra]);
  const selected = path[path.length - 1];

  // Single-child links below the selection are opened too, so a profile shows its plan and destinations straight away.
  const chain = useMemo(() => {
    const out: HNode[] = [];
    let cur = selected;
    while (cur && out.length < 6) {
      const kids = childrenOf(cur);
      if (!kids || kids.length !== 1) break;
      out.push(kids[0]);
      cur = kids[0];
    }
    return out;
  }, [selected, childrenOf]);

  const expandedNodes = useMemo(() => [...path, ...chain], [path, chain]);
  const expanded = useMemo(() => new Set(expandedNodes.map(n => n.id)), [expandedNodes]);
  useEffect(() => { expandedNodes.forEach(n => { load(n); }); }, [expandedNodes, load]);
  useEffect(() => { if (selected) loadDetails(selected); }, [selected, loadDetails]);

  const pick = useCallback((p: HNode[]) => setSel(p.map(n => n.id)), []);

  const refresh = (n: HNode) => {
    requested.current.delete(n.id);
    pending.current.delete(n.id);
    setExtra(s => { const { [n.id]: _gone, ...rest } = s; return rest; });
    setLoaded(s => { const { [n.id]: _gone, ...rest } = s; return rest; });
  };

  const tree: LazyTree = useMemo(() => ({
    match: null, forceOpen: null, childrenOf,
    loading: (id: string) => loaded[id] === 'loading',
    error: (id: string) => { const l = loaded[id]; return l && typeof l === 'object' && 'error' in l ? l.error : undefined; },
    expand: (n: HNode) => { load(n); },
  }), [childrenOf, loaded, load]);

  // The diagram takes whatever height is left in the window.
  const panel = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  const measure = useCallback(() => {
    if (panel.current) setHeight(Math.max(480, Math.round(window.innerHeight - panel.current.getBoundingClientRect().top - window.scrollY - 24)));
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const searching = !!q && (!ready || index === 'loading');
  const prefixError = prefixes && typeof prefixes === 'object' && 'error' in prefixes ? prefixes.error : null;

  return (
    <LazyTreeContext.Provider value={tree}>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small" value={query} onChange={e => onQueryChange(e.target.value)} sx={{ flex: '1 1 360px', maxWidth: 640 }}
            placeholder="Search names or prefixes, or enter a full number to see what rates it"
            slotProps={{ input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: query ? <InputAdornment position="end"><IconButton size="small" onClick={() => onQueryChange('')}><CloseIcon fontSize="small" /></IconButton></InputAdornment> : undefined,
            } }}
          />
          {searching && <Typography variant="body2" color="text.secondary"><CircularProgress size={14} sx={{ mr: 1, verticalAlign: 'middle' }} />Indexing names and prefixes…</Typography>}
          {matches && <Typography variant="body2" color="text.secondary">{matches.length ? `${matches.length} name/prefix match${matches.length === 1 ? '' : 'es'}` : 'No name or prefix matches'}</Typography>}
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<ListIcon />} variant={outline ? 'contained' : 'outlined'} onClick={() => setOutline(o => !o)}>Outline</Button>
          <Button size="small" startIcon={<InfoIcon />} variant={details ? 'contained' : 'outlined'} onClick={() => setDetails(d => !d)}>Details</Button>
        </Box>
        {prefixError && <Alert severity="warning" sx={{ mt: 1 }}>Prefixes unavailable, so only names are searched: {prefixError}</Alert>}
        {index && index !== 'loading' && index.truncated && <Alert severity="info" sx={{ mt: 1 }}>Only the first {INDEX_BUDGET} objects were indexed; search may miss some.</Alert>}
        {digits && rating && (
          <Box sx={{ mt: 1.25 }}>
            {rating.hits.length === 0 && rating.fallbacks.length === 0 && (
              <Alert severity="warning">No {scope}/destination matches {q}.</Alert>
            )}
            {[...rating.hits, ...rating.fallbacks].map(h => (
              <ResultRow key={h.path.map(n => n.id).join('>')} path={h.path} active={selected?.id === h.path[h.path.length - 1].id} onPick={pick}
                lead={h.prefix ? `${q} rates via ${h.prefix === '*any' ? '*any (no prefix matched)' : `prefix ${h.prefix}`}` : `${q}: fallback`} note={h.note} />
            ))}
            {unused.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Also defined, but not used by any rating plan drawn here: {unused.slice(0, 10).join(', ')}{unused.length > 10 ? ` and ${unused.length - 10} more` : ''}.
              </Typography>
            )}
            {(rating.hits.length + rating.fallbacks.length) > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                One line per rating profile, using the activation in force now (timings are not checked). Which profile is used depends on the event's Category and Subject, which a number alone doesn't say; a profile with subject *any covers subjects without their own.
              </Typography>
            )}
          </Box>
        )}
        {matches && matches.length > 0 && (
          <Box sx={{ mt: 1, maxHeight: 180, overflow: 'auto' }}>
            {matches.slice(0, RESULTS_SHOWN).map(m => (
              <ResultRow key={m.path.map(n => n.id).join('>')} path={m.path} active={selected?.id === m.path[m.path.length - 1].id} onPick={pick} />
            ))}
            {matches.length > RESULTS_SHOWN && <Typography variant="caption" color="text.secondary">{matches.length - RESULTS_SHOWN} more; narrow the search to see them.</Typography>}
          </Box>
        )}
      </Paper>
      {notice}
      <Box ref={panel} sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch', height }}>
        {outline && (
          <Paper variant="outlined" sx={{ width: 300, flexShrink: 0, overflow: 'auto' }}>
            <HierarchyTree nodes={shownLanes.flatMap(l => l.roots)} selectedId={selected?.id}
              onSelect={n => { const p = findPath(roots, n.id, childrenOf); if (p) pick(p); }} />
          </Paper>
        )}
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          {shownLanes.length === 0
            ? <Typography color="text.secondary" sx={{ p: 2 }}>{searching ? 'Searching…' : q ? `Nothing matches “${q}”.` : 'Nothing to show.'}</Typography>
            : <HierarchyDiagram lanes={shownLanes} childrenOf={childrenOf} canExpand={n => !!(n.children?.length || n.loadChildren)} loading={tree.loading}
                expanded={expanded} pathIds={expanded} selectedId={selected?.id} highlight={q ? highlight : new Set()} onSelect={pick} height={height - 2} />}
        </Paper>
        {details && selected && (
          <Paper variant="outlined" sx={{ width: 380, flexShrink: 0, overflow: 'auto', p: 2 }}>
            <Breadcrumbs maxItems={8} sx={{ mb: 1, fontSize: 12 }}>
              {path.map((n, i) => (i === path.length - 1
                ? <Typography key={n.id} sx={{ fontSize: 12, color: n.color, fontWeight: 600 }}>{n.value}</Typography>
                : <Link key={n.id} component="button" underline="hover" color="inherit" sx={{ fontSize: 12 }} onClick={() => pick(path.slice(0, i + 1))}>{n.value}</Link>))}
            </Breadcrumbs>
            <NodeDetails node={selected} kids={childrenOf(selected)} loading={tree.loading(selected.id)} error={tree.error(selected.id)}
              onSelect={k => pick([...path, k])} onEdit={() => setEditing(true)} />
          </Paper>
        )}
      </Box>
      {selected?.editor && (
        <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="md" fullWidth>
          <DialogTitle>{selected.editLabel ?? 'Edit'}: {selected.value}</DialogTitle>
          {editing && selected.editor(saved => { setEditing(false); if (saved) refresh(selected); })}
        </Dialog>
      )}
    </LazyTreeContext.Provider>
  );
}

function ResultRow({ path, lead, note, active, onPick }: { path: HNode[]; lead?: string; note?: string; active: boolean; onPick: (p: HNode[]) => void }) {
  return (
    <Box onClick={() => onPick(path)} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer', bgcolor: active ? 'action.selected' : undefined, '&:hover': { bgcolor: 'action.hover' } }}>
      {lead && <Chip size="small" color="primary" label={lead} />}
      {path.map((n, i) => (
        <Typography key={n.id} component="span" sx={{ fontSize: 13 }}>
          {i > 0 && <Box component="span" sx={{ color: 'text.disabled', mr: 1 }}>›</Box>}
          <Box component="span" sx={{ color: n.color, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', mr: 0.5 }}>{n.label}</Box>
          {n.value}
        </Typography>
      ))}
      {note && <Typography variant="caption" color="text.secondary">({note})</Typography>}
    </Box>
  );
}

function NodeDetails({ node, kids, loading, error, onSelect, onEdit }: { node: HNode; kids?: HNode[]; loading: boolean; error?: string; onSelect: (n: HNode) => void; onEdit: () => void }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: node.color }}>{node.label}</Typography>
          <Typography variant="h6" sx={{ wordBreak: 'break-all', mb: 1, fontSize: 17 }}>{node.value}</Typography>
        </Box>
        {node.editor && (
          <Tooltip title={node.editLabel ?? 'Edit'}><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton></Tooltip>
        )}
      </Box>
      {node.status === 'error' && <Alert severity="error" sx={{ mb: 1 }}>Failed to load part of this object</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {node.details && node.details.length > 0 && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableBody>
            {node.details.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell sx={{ fontWeight: 'bold', width: 110, verticalAlign: 'top', px: 0.5 }}>{k}</TableCell>
                <TableCell sx={{ wordBreak: 'break-word', px: 0.5 }}>{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {loading && <CircularProgress size={20} sx={{ mb: 2 }} />}
      {kids && kids.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Contains {kids.length}{kids.length > DETAIL_CHIPS ? ` (first ${DETAIL_CHIPS} shown; search for the rest)` : ''}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {kids.slice(0, DETAIL_CHIPS).map(c => (
              <Paper key={c.id} variant="outlined" onClick={() => onSelect(c)}
                sx={{ px: 1, py: 0.5, cursor: 'pointer', borderLeft: `3px solid ${c.color}`, '&:hover': { boxShadow: 2 } }}>
                <Typography variant="caption" sx={{ color: c.color, fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', display: 'block' }}>{c.label}</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{c.value}</Typography>
              </Paper>
            ))}
          </Box>
        </>
      )}
      {node.raw !== undefined && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Raw</Typography>
          <Box component="pre" sx={{ m: 0, p: 1, fontSize: '0.75rem', bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', maxHeight: 400 }}>
            {rawText(node.raw)}
          </Box>
        </>
      )}
    </Box>
  );
}
