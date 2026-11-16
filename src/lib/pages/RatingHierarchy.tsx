import { useCallback, useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, CircularProgress, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import HierarchyView from '../components/HierarchyView';
import { livePrefixIndex, liveRatingPlanNode, liveRatingProfileTree, tpPrefixIndex, tpTree, unitHintForCategory, type TPRootType } from '../ratingHierarchy';

type Source = 'live' | 'tp';
type LiveRootType = 'ratingprofile' | 'ratingplan';

const TP_ROOTS: { value: TPRootType; label: string }[] = [
  { value: 'ratingprofile', label: 'Rating profile' },
  { value: 'ratingplan', label: 'Rating plan' },
  { value: 'destinationrate', label: 'Destination rate' },
];
const LIVE_ROOTS: { value: LiveRootType; label: string }[] = [
  { value: 'ratingprofile', label: 'Rating profile' },
  { value: 'ratingplan', label: 'Rating plan' },
];

const ID_OPTIONS = 200;

/** search narrows on the server, so a TP with thousands of IDs never sends them all. */
function rootIdsFn(baseUrl: string, source: Source, tpid: string, tenant: string, type: string, search?: string): Promise<string[] | null> {
  if (source === 'live') {
    return type === 'ratingplan' ? api.getRatingPlanIDs(baseUrl, search) : api.getRatingProfileIDs(baseUrl, tenant, search);
  }
  if (type === 'ratingplan') return api.getTPRatingPlanIds(baseUrl, tpid, search);
  if (type === 'destinationrate') return api.getTPDestinationRateIds(baseUrl, tpid, search);
  return api.getTPRatingProfileIds(baseUrl, tpid, search);
}

/** Live rating profile IDs are "category:subject"; the subject may itself contain ":". */
function splitCategorySubject(id: string) {
  const i = id.indexOf(':');
  return { category: id.slice(0, i), subject: id.slice(i + 1) };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [params, setParams] = useSearchParams();
  const source: Source = params.get('source') === 'tp' ? 'tp' : 'live';
  const tpid = params.get('tpid') || '';
  const tenant = params.get('tenant') || defaultTenant;
  const type = params.get('type') || 'ratingprofile';
  const rootId = params.get('id') || '';

  const update = (patch: Record<string, string>) => setParams(prev => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });
  const setTpid = (v: string) => update({ tpid: v, id: '' });
  const setTenant = (v: string) => update({ tenant: v, id: '' });
  const setType = (v: string) => update({ type: v, id: '' });
  const setRootId = (v: string) => update({ id: v });

  const prefixIndex = useCallback(
    () => (source === 'tp' ? tpPrefixIndex(baseUrl!, tpid) : livePrefixIndex(baseUrl!)),
    [baseUrl, source, tpid],
  );

  const tpids = useQuery({ queryKey: ['rh-tpids', baseUrl], queryFn: () => api.getTPIds(baseUrl!), enabled: !!baseUrl && source === 'tp' });

  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const idsEnabled = !!baseUrl && (source === 'live' ? !!tenant : !!tpid);
  const ids = useQuery({
    queryKey: ['rh-ids', baseUrl, source, tpid, tenant, type, q],
    placeholderData: prev => prev,
    queryFn: () => rootIdsFn(baseUrl!, source, tpid, tenant, type, q || undefined).catch(e => {
      if (e instanceof Error && e.message.includes('NOT_FOUND')) return [];
      throw e;
    }),
    enabled: idsEnabled,
  });

  const tree = useQuery({
    queryKey: ['rh-tree', baseUrl, source, tpid, tenant, type, rootId],
    queryFn: () => {
      if (source === 'tp') return tpTree(baseUrl!, tpid, type as TPRootType, rootId);
      if (type === 'ratingplan') return liveRatingPlanNode(baseUrl!, rootId, 'live', unitHintForCategory(rootId));
      const { category, subject } = splitCategorySubject(rootId);
      return liveRatingProfileTree(baseUrl!, tenant, category, subject);
    },
    enabled: idsEnabled && !!rootId,
  });

  const changeSource = (s: Source | null) => {
    if (!s) return;
    update({ source: s, id: '', type: s === 'live' && type === 'destinationrate' ? 'ratingprofile' : type });
  };

  const roots = source === 'tp' ? TP_ROOTS : LIVE_ROOTS;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Rating Hierarchy</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_e, v) => changeSource(v)}>
            <ToggleButton value="live">Live (DataDB)</ToggleButton>
            <ToggleButton value="tp">Tariff plan (StorDB)</ToggleButton>
          </ToggleButtonGroup>
          {source === 'tp' ? (
            <SearchableSelect label="TPID" value={tpid} options={tpids.data || []} onChange={setTpid} disableClearable sx={{ minWidth: 240 }} />
          ) : (
            <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 240 }} />
          )}
          <TextField select size="small" label="Start from" value={type} onChange={e => setType(e.target.value)} sx={{ minWidth: 180 }}>
            {roots.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <SearchableSelect label="ID" value={rootId} options={ids.data || []} onChange={setRootId} disabled={!idsEnabled}
            onInputChange={setSearch} maxOptions={ID_OPTIONS} placeholder="Type to search" sx={{ minWidth: 300 }} />
          {(ids.isFetching || tree.isFetching) && <CircularProgress size={20} />}
        </Stack>
        {source === 'live' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            What is charging now: profiles, rating plans and destinations as loaded into DataDB.
          </Typography>
        )}
      </Paper>

      {ids.error && <Alert severity="error" sx={{ mb: 2 }}>{(ids.error as Error).message}</Alert>}
      {idsEnabled && ids.data && ids.data.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>Nothing of this type {source === 'tp' ? `in tariff plan ${tpid}` : `for tenant ${tenant}`}.</Alert>
      )}
      {tree.error && <Alert severity="error" sx={{ mb: 2 }}>{(tree.error as Error).message}</Alert>}
      {tree.data && <HierarchyView root={tree.data} prefixIndex={prefixIndex} />}
    </Box>
  );
}
