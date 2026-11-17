import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import HierarchyView from '../components/HierarchyView';
import type { DiagramLane } from '../components/HierarchyDiagram';
import type { HNode } from '../components/HierarchyTree';
import {
  livePrefixIndex, liveLoaders, liveRatingPlanNode, liveRatingProfileTree, splitCategorySubject,
  tpLoaders, tpPrefixIndex, tpRatingPlanNode, tpRatingProfileTree,
} from '../ratingHierarchy';

type Source = 'live' | 'tp';

/** Each root fetches its profile, so a tenant with per-subscriber profiles is capped rather than fetched whole. */
const ROOT_CAP = 50;
const UNUSED_LANE = '__unused';

async function ids(baseUrl: string, method: string, params: Record<string, unknown>, search: string, limit?: number): Promise<string[]> {
  try {
    return (await api.jsonRpc<string[] | null>(baseUrl, method, [{ ...params, ...(search ? { Search: search } : {}), ...(limit ? { Limit: limit } : {}) }])) || [];
  } catch (e) {
    if (e instanceof Error && e.message.includes('NOT_FOUND')) return [];
    throw e;
  }
}

interface Roots { lanes: DiagramLane[]; capped: boolean; failed: string[] }

/** Rating profiles grouped by their Category as stored (free text), then rating plans no profile uses. */
async function loadRoots(baseUrl: string, source: Source, tenant: string, tpid: string, search: string): Promise<Roots> {
  const failed: string[] = [];
  const keep = <T,>(p: Promise<T>, id: string) => p.catch(e => { failed.push(`${id}: ${e instanceof Error ? e.message : e}`); return null; });
  let profiles: (HNode | null)[];
  let categoryOf: (n: HNode) => string;
  let planIds: string[];
  let planNode: (id: string) => HNode;
  let capped: boolean;
  if (source === 'live') {
    const L = liveLoaders(baseUrl);
    const rp = await ids(baseUrl, 'ApierV1.GetRatingProfileIDs', { Tenant: tenant }, search, ROOT_CAP + 1);
    capped = rp.length > ROOT_CAP;
    profiles = await Promise.all(rp.slice(0, ROOT_CAP).sort().map(id => keep(liveRatingProfileTree(L, tenant, id), id)));
    categoryOf = n => splitCategorySubject(n.value).category;
    planIds = capped ? [] : await ids(baseUrl, 'APIerSv1.GetRatingPlanIDs', {}, '');
    planNode = id => liveRatingPlanNode(L, id, 'unused');
  } else {
    const L = tpLoaders(baseUrl, tpid);
    const rp = await ids(baseUrl, 'APIerSv1.GetTPRatingProfileIds', { TPid: tpid }, search, ROOT_CAP + 1);
    capped = rp.length > ROOT_CAP;
    profiles = await Promise.all(rp.slice(0, ROOT_CAP).sort().map(id => keep(tpRatingProfileTree(L, id), id)));
    categoryOf = n => String((n.raw as { Category?: string }).Category ?? '');
    planIds = capped ? [] : await ids(baseUrl, 'APIerSv1.GetTPRatingPlanIds', { TPid: tpid }, '');
    planNode = id => tpRatingPlanNode(L, id, `tp:${id}`);
  }
  const byCat = new Map<string, HNode[]>();
  const used = new Set<string>();
  for (const p of profiles) {
    if (!p) continue;
    const c = categoryOf(p);
    byCat.set(c, [...(byCat.get(c) ?? []), p]);
    for (const a of p.children ?? []) for (const k of a.children ?? []) if (k.label === 'Rating Plan') used.add(k.value);
  }
  const lanes: DiagramLane[] = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, roots]) => ({
    key: `cat:${c}`, label: c ? `Category ${c}` : 'No category', caption: `${roots.length} rating profile${roots.length === 1 ? '' : 's'}`, roots,
  }));
  const unused = planIds.filter(id => !used.has(id)).sort();
  if (unused.length) {
    lanes.push({
      key: UNUSED_LANE, label: 'Rating plans no rating profile uses',
      caption: unused.length > ROOT_CAP ? `first ${ROOT_CAP} of ${unused.length} drawn` : `${unused.length}`,
      roots: unused.slice(0, ROOT_CAP).map(planNode),
    });
  }
  return { lanes, capped, failed };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [params, setParams] = useSearchParams();
  const source: Source = params.get('source') === 'tp' ? 'tp' : 'live';
  const tpid = params.get('tpid') || '';
  const tenant = params.get('tenant') || defaultTenant;
  const urlQuery = params.get('q') || '';
  const [query, setQuery] = useState(urlQuery);
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);

  const update = (patch: Record<string, string>) => setParams(prev => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });
  const changeQuery = (v: string) => { setQuery(v); update({ q: v }); };

  const tpids = useQuery({ queryKey: ['rh-tpids', baseUrl], queryFn: () => api.getTPIds(baseUrl!), enabled: !!baseUrl && source === 'tp' });

  const enabled = !!baseUrl && (source === 'live' ? !!tenant : !!tpid);
  const first = useQuery({
    queryKey: ['rh-roots', baseUrl, source, tenant, tpid, ''],
    queryFn: () => loadRoots(baseUrl!, source, tenant, tpid, ''),
    enabled,
  });
  // Only a capped list is re-fetched with the search, so the server narrows what didn't fit.
  const deferred = useDeferredValue(query.trim());
  const narrowed = useQuery({
    queryKey: ['rh-roots', baseUrl, source, tenant, tpid, deferred],
    queryFn: () => loadRoots(baseUrl!, source, tenant, tpid, deferred),
    enabled: enabled && !!first.data?.capped && !!deferred && !/^\+?\d+$/.test(deferred),
    placeholderData: prev => prev,
  });
  const roots = narrowed.data && first.data?.capped && deferred ? narrowed.data : first.data;

  const prefixIndex = useCallback(
    () => (source === 'tp' ? tpPrefixIndex(baseUrl!, tpid) : livePrefixIndex(baseUrl!)),
    [baseUrl, source, tpid],
  );
  const lanes = useMemo(() => roots?.lanes ?? [], [roots]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Rating map</Typography>
      <Paper sx={{ p: 1.5, mb: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_e, v) => v && update({ source: v })}>
            <ToggleButton value="live">Live (DataDB)</ToggleButton>
            <ToggleButton value="tp">Stored tariff plan (StorDB)</ToggleButton>
          </ToggleButtonGroup>
          {source === 'tp'
            ? <SearchableSelect label="Tariff plan" value={tpid} options={tpids.data || []} onChange={v => update({ tpid: v })} disableClearable sx={{ minWidth: 280 }} />
            : <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={v => update({ tenant: v })} disableClearable sx={{ minWidth: 280 }} />}
          {(first.isFetching || narrowed.isFetching) && <CircularProgress size={20} />}
          <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 300px' }}>
            {source === 'live'
              ? 'What is charging now: rating profiles, rating plans and destinations as loaded into DataDB, grouped by the profiles’ Category.'
              : 'A stored tariff plan in StorDB; nothing here is live until the plan is loaded.'}
          </Typography>
        </Stack>
      </Paper>

      {source === 'tp' && !tpid && <Alert severity="info">Pick a stored tariff plan.</Alert>}
      {first.error && <Alert severity="error" sx={{ mb: 2 }}>{(first.error as Error).message}</Alert>}
      {roots && roots.failed.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>Some rating profiles failed to load: {roots.failed.join('; ')}</Alert>
      )}
      {roots && lanes.length === 0 && (
        <Alert severity="info">{source === 'tp' ? `Tariff plan ${tpid} has no rating profiles or rating plans.` : `Tenant ${tenant} has no live rating profiles or rating plans.`}</Alert>
      )}
      {roots && lanes.length > 0 && (
        <HierarchyView
          key={`${source}|${tenant}|${tpid}`}
          lanes={lanes}
          query={query}
          onQueryChange={changeQuery}
          prefixIndex={prefixIndex}
          scope={source === 'tp' ? `rating profile in tariff plan ${tpid}` : 'live rating profile'}
          notice={roots.capped && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {source === 'tp' ? `Tariff plan ${tpid}` : `Tenant ${tenant}`} has more than {ROOT_CAP} rating profiles, so only {ROOT_CAP} are drawn
              {deferred ? ` (matching “${deferred}” on the server)` : ''}. Type part of a Category or Subject in the search to narrow them. Number search only covers the profiles drawn.
            </Alert>
          )}
        />
      )}
    </Box>
  );
}

/** Old address of this page. */
export function LegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '../rating-map', search }} relative="path" replace />;
}
