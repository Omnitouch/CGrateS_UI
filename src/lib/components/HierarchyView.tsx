import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, CircularProgress, Dialog, DialogTitle, Link, InputAdornment, Paper, Tab, Table, TableBody, TableCell, TableRow, Tabs, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import HierarchyTree, { LazyTreeContext, type HNode, type LazyTree } from './HierarchyTree';
import HierarchyDiagram from './HierarchyDiagram';

const DETAIL_CHIPS = 60;
const RAW_CHARS = 20000;

function rawText(raw: unknown) {
  const s = JSON.stringify(raw, null, 2);
  return s.length > RAW_CHARS ? `${s.slice(0, RAW_CHARS)}\n… ${s.length - RAW_CHARS} more characters` : s;
}

type Loaded = HNode[] | 'loading' | { error: string };

/** Ancestors from the root down to id, searching only what has been loaded. */
function findPath(root: HNode, id: string, childrenOf: (n: HNode) => HNode[] | undefined): HNode[] | null {
  if (root.id === id) return [root];
  for (const c of childrenOf(root) ?? []) {
    const p = findPath(c, id, childrenOf);
    if (p) return [root, ...p];
  }
  return null;
}

/** Columns in the diagram, counting the parent kept above the selection. */
const DIAGRAM_COLUMNS = 4;
const DIAGRAM_BUDGET = 90;
/** Children shown for the selected node, and for each node below it. */
const DIAGRAM_CHILDREN_SELECTED = 50;
const DIAGRAM_CHILDREN_BELOW = 8;

/** The path to the selected node, then a few levels below it, capped per node and overall so the diagram stays readable at any size. */
function focusTree(path: HNode[], childrenOf: (n: HNode) => HNode[] | undefined): HNode {
  let budget = DIAGRAM_BUDGET;
  const levels = DIAGRAM_COLUMNS - (path.length > 1 ? 2 : 1);
  const below = (n: HNode, level: number): HNode => {
    const kids = level < levels ? childrenOf(n) ?? [] : [];
    const cap = level === 0 ? DIAGRAM_CHILDREN_SELECTED : DIAGRAM_CHILDREN_BELOW;
    const take = kids.slice(0, Math.min(cap, Math.max(budget, 0)));
    budget -= take.length;
    const shown = take.map(k => below(k, level + 1));
    if (kids.length > take.length) {
      shown.push({ id: `${n.id}/__more`, label: 'More', value: `+${kids.length - take.length} more`, subtext: 'Select to focus here, or filter the tree', color: '#757575' });
    }
    return { ...n, children: shown.length ? shown : undefined };
  };
  const sel = below(path[path.length - 1], 0);
  // Only the parent is kept above the selection; the breadcrumb shows the rest of the way up.
  const parent = path[path.length - 2];
  return parent ? { ...parent, children: [sel] } : sel;
}

const MATCH_BUDGET = 150;

/** While searching: every match and the path to it, capped so the diagram stays light. */
function matchTree(root: HNode, childrenOf: (n: HNode) => HNode[] | undefined, match: Set<string>): HNode {
  let budget = MATCH_BUDGET;
  const visit = (n: HNode): HNode => {
    const kids = (childrenOf(n) ?? []).filter(k => match.has(k.id));
    const take = kids.slice(0, Math.max(budget, 0));
    budget -= take.length;
    const shown = take.map(visit);
    if (kids.length > take.length) {
      shown.push({ id: `${n.id}/__more`, label: 'More', value: `+${kids.length - take.length} more`, subtext: 'Narrow the search to see them', color: '#757575' });
    }
    return { ...n, children: shown.length ? shown : undefined };
  };
  return visit(root);
}

/** Every loaded node that matches, plus the ancestors that lead to it. */
function filterTree(root: HNode, childrenOf: (n: HNode) => HNode[] | undefined, isMatch: (n: HNode) => boolean) {
  const match = new Set<string>();
  const forceOpen = new Set<string>();
  let matches = 0;
  const visit = (n: HNode): boolean => {
    let below = false;
    for (const c of childrenOf(n) ?? []) if (visit(c)) below = true;
    if (below) forceOpen.add(n.id);
    const self = isMatch(n);
    if (self) matches++;
    if (below || self) { match.add(n.id); return true; }
    return false;
  };
  visit(root);
  return { match, forceOpen, matches };
}

/** The longest prefix wins in CGrateS, so name the destination in this hierarchy that the number would rate against. */
function numberMatchText(hits: Map<string, string>, shown: Set<string>, root: HNode, childrenOf: (n: HNode) => HNode[] | undefined) {
  let best: [string, string] | null = null;
  const visit = (n: HNode) => {
    const px = hits.get(n.value);
    if (px && shown.has(n.id) && (!best || px.replace('+', '').length > best[1].replace('+', '').length)) best = [n.value, px];
    (childrenOf(n) ?? []).forEach(visit);
  };
  visit(root);
  const b = best as [string, string] | null;
  return b ? `longest prefix ${b[1]} → ${b[0]}` : 'no destination here matches the number';
}

const isNumber = (s: string) => /^\+?\d{2,}$/.test(s);

interface HierarchyViewProps {
  root: HNode;
  /** Node values (e.g. destination IDs) a dialled number matches, with the prefix each matched on. */
  numberLookup?: (num: string) => Promise<Map<string, string>>;
}

/** Tree on the left, Overview diagram and Details tabs on the right, as on OmniWeb's subscriber page. */
export default function HierarchyView({ root, numberLookup }: HierarchyViewProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const [numberHits, setNumberHits] = useState<{ q: string; ids: Map<string, string> } | null>(null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [extra, setExtra] = useState<Record<string, Partial<HNode>>>({});
  const requested = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState(root.id);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    requested.current = new Set();
    setLoaded({});
    setExtra({});
    setSelectedId(root.id);
    setTab(0);
  }, [root]);

  const withExtra = useCallback((n: HNode) => (extra[n.id] ? { ...n, ...extra[n.id] } : n), [extra]);

  const childrenOf = useCallback((n: HNode) => {
    if (n.children) return n.children;
    const l = loaded[n.id];
    return Array.isArray(l) ? l : undefined;
  }, [loaded]);

  const expand = useCallback((n: HNode) => {
    if (n.children || !n.loadChildren || requested.current.has(`c:${n.id}`)) return;
    requested.current.add(`c:${n.id}`);
    setLoaded(s => ({ ...s, [n.id]: 'loading' }));
    n.loadChildren()
      .then(kids => setLoaded(s => ({ ...s, [n.id]: kids })))
      .catch(e => setLoaded(s => ({ ...s, [n.id]: { error: e instanceof Error ? e.message : String(e) } })));
  }, []);

  const loadDetails = useCallback((n: HNode) => {
    if (!n.loadDetails || requested.current.has(`d:${n.id}`)) return;
    requested.current.add(`d:${n.id}`);
    n.loadDetails()
      .then(d => setExtra(s => ({ ...s, [n.id]: d })))
      .catch(e => setExtra(s => ({ ...s, [n.id]: { status: 'error', details: [['Error', e instanceof Error ? e.message : String(e)]] } })));
  }, []);

  useEffect(() => {
    if (!numberLookup || !isNumber(deferred)) { setNumberHits(null); return; }
    let live = true;
    const t = setTimeout(() => {
      numberLookup(deferred).then(ids => { if (live) setNumberHits({ q: deferred, ids }); }).catch(() => { if (live) setNumberHits(null); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [deferred, numberLookup]);

  const filtered = useMemo(() => {
    if (!deferred) return null;
    const hits = numberHits?.q === deferred ? numberHits.ids : null;
    const kids = (n: HNode) => childrenOf(n)?.map(withExtra);
    return filterTree(withExtra(root), kids, n =>
      `${n.value} ${n.subtext ?? ''} ${n.badge ?? ''}`.toLowerCase().includes(deferred) || !!hits?.has(n.value));
  }, [deferred, numberHits, root, childrenOf, withExtra]);

  const refresh = useCallback((n: HNode) => {
    requested.current.delete(`d:${n.id}`);
    requested.current.delete(`c:${n.id}`);
    setExtra(s => { const { [n.id]: _gone, ...rest } = s; return rest; });
    setLoaded(s => { const { [n.id]: _gone, ...rest } = s; return rest; });
  }, []);

  // Searching loads whatever hasn't been opened yet, so matches aren't limited to expanded branches.
  const pendingLoads = Object.values(loaded).filter(l => l === 'loading').length;
  useEffect(() => {
    if (!deferred) return;
    const walk = (n: HNode) => {
      const kids = childrenOf(n);
      if (kids) kids.forEach(walk);
      else if (n.loadChildren) expand(n);
    };
    walk(root);
  }, [deferred, loaded, root, childrenOf, expand]);

  const tree: LazyTree = useMemo(() => ({
    match: filtered?.match ?? null,
    forceOpen: filtered?.forceOpen ?? null,
    childrenOf: (n: HNode) => childrenOf(n)?.map(withExtra),
    loading: (id: string) => loaded[id] === 'loading',
    error: (id: string) => {
      const l = loaded[id];
      return l && typeof l === 'object' && 'error' in l ? l.error : undefined;
    },
    expand,
  }), [childrenOf, withExtra, loaded, expand, filtered]);

  const rootNode = withExtra(root);
  const path = findPath(rootNode, selectedId, tree.childrenOf) ?? [rootNode];
  const selected = path[path.length - 1];

  useEffect(() => { expand(selected); loadDetails(selected); }, [selected, expand, loadDetails]);
  const [editing, setEditing] = useState(false);

  const pick = (n: HNode, toDetails: boolean) => {
    if (n.id.endsWith('/__more')) {
      setSelectedId(n.id.slice(0, -'/__more'.length));
      return;
    }
    setSelectedId(n.id);
    if (toDetails) setTab(1);
  };

  const diagramRoot = useMemo(() => (filtered ? matchTree(rootNode, tree.childrenOf, filtered.match) : focusTree(path, tree.childrenOf)), [filtered, rootNode, path, tree]);

  return (
    <LazyTreeContext.Provider value={tree}>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" value={query} onChange={e => setQuery(e.target.value)} sx={{ flex: '1 1 320px', maxWidth: 520 }}
          placeholder={numberLookup ? 'Search destinations, rates, plans… or type a number to find its rate' : 'Search destinations, rates, plans…'}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {filtered && (
          <Typography variant="body2" color="text.secondary">
            {filtered.match.size ? `${filtered.matches} match${filtered.matches === 1 ? '' : 'es'}` : 'No matches'}
            {pendingLoads > 0 && ` · loading ${pendingLoads} more…`}
            {numberLookup && isNumber(deferred) && (numberHits?.q === deferred ? ` · ${numberMatchText(numberHits.ids, filtered.match, rootNode, tree.childrenOf)}` : ' · looking up number…')}
          </Typography>
        )}
      </Paper>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <Paper variant="outlined" sx={{ width: { xs: '100%', md: 320 }, minWidth: { md: 320 }, maxHeight: '75vh', overflow: 'auto', flexShrink: 0 }}>
          <HierarchyTree nodes={filtered && !filtered.match.has(rootNode.id) ? [] : [rootNode]} selectedId={selectedId} onSelect={n => pick(n, tab === 1)} />
        </Paper>
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
            <Tab label="Overview" sx={{ minHeight: 40, textTransform: 'none' }} />
            <Tab label={`Details: ${selected.label}`} sx={{ minHeight: 40, textTransform: 'none' }} />
          </Tabs>
          <Box sx={{ p: 2 }}>
            {tab === 0 && (
              <>
                {!filtered && <Breadcrumbs maxItems={6} sx={{ mb: 1.5, fontSize: '0.8rem' }}>
                  {path.map((n, i) => (i === path.length - 1
                    ? <Typography key={n.id} sx={{ fontSize: '0.8rem', color: n.color, fontWeight: 600 }}>{n.value}</Typography>
                    : <Link key={n.id} component="button" underline="hover" color="inherit" sx={{ fontSize: '0.8rem' }} onClick={() => pick(n, false)}>{n.value}</Link>))}
                </Breadcrumbs>}
                {filtered && filtered.match.size === 0
                  ? <Typography color="text.secondary">Nothing matches “{query.trim()}”.</Typography>
                  : <HierarchyDiagram root={diagramRoot} selectedId={selectedId} onSelect={id => {
                  const n = findPath(diagramRoot, id, x => x.children)?.pop();
                  if (n) pick(n, id === selectedId);
                }} />}
              </>
            )}
            {tab === 1 && <NodeDetails node={selected} kids={tree.childrenOf(selected)?.filter(k => !filtered || filtered.match.has(k.id))} loading={tree.loading(selected.id)} onSelect={n => pick(n, true)} onEdit={() => setEditing(true)} />}
          </Box>
        </Paper>
      </Box>
      {selected.editor && (
        <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="md" fullWidth>
          <DialogTitle>{selected.editLabel ?? 'Edit'}: {selected.value}</DialogTitle>
          {editing && selected.editor(saved => { setEditing(false); if (saved) refresh(selected); })}
        </Dialog>
      )}
    </LazyTreeContext.Provider>
  );
}

function NodeDetails({ node, kids, loading, onSelect, onEdit }: { node: HNode; kids?: HNode[]; loading: boolean; onSelect: (n: HNode) => void; onEdit: () => void }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: node.color }}>{node.label}</Typography>
          <Typography variant="h6" sx={{ wordBreak: 'break-all', mb: 1 }}>{node.value}</Typography>
        </Box>
        {node.editor && <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>{node.editLabel ?? 'Edit'}</Button>}
      </Box>
      {node.status === 'error' && <Alert severity="error" sx={{ mb: 1 }}>Failed to load part of this object</Alert>}
      {node.details && node.details.length > 0 && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableBody>
            {node.details.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell sx={{ fontWeight: 'bold', width: 200, verticalAlign: 'top' }}>{k}</TableCell>
                <TableCell sx={{ wordBreak: 'break-word' }}>{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {loading && <CircularProgress size={20} sx={{ mb: 2 }} />}
      {kids && kids.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Contains {kids.length}{kids.length > DETAIL_CHIPS ? ` (first ${DETAIL_CHIPS} shown; use the tree filter for the rest)` : ''}
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
