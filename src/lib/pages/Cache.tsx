import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Checkbox, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, List, ListItemButton, ListItemText,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import { useConfirm } from '../components/ConfirmDialog';

// utils.CachePartitions (extraDBPartition + DataDBPartitions)
const CACHE_PARTITIONS = [
  '*account_action_plans', '*accounts', '*action_plans', '*action_triggers', '*actions', '*apiban', '*attribute_filter_indexes',
  '*attribute_profiles', '*caps_events', '*cdr_ids', '*charger_filter_indexes', '*charger_profiles', '*closed_sessions',
  '*destinations', '*diameter_messages', '*dispatcher_filter_indexes', '*dispatcher_hosts', '*dispatcher_loads',
  '*dispatcher_profiles', '*dispatcher_routes', '*dispatchers', '*event_charges', '*event_ips', '*event_resources', '*filters',
  '*ip_allocations', '*ip_filter_indexes', '*ip_profiles', '*load_ids', '*radius_packets', '*ranking_profiles', '*rankings',
  '*rating_plans', '*rating_profiles', '*replication_hosts', '*resource_filter_indexes', '*resource_profiles', '*resources',
  '*reverse_destinations', '*reverse_filter_indexes', '*route_filter_indexes', '*route_profiles', '*rpc_connections',
  '*rpc_responses', '*sentrypeer', '*shared_groups', '*stat_filter_indexes', '*statqueue_profiles', '*statqueues', '*stir',
  '*threshold_filter_indexes', '*threshold_profiles', '*thresholds', '*timings', '*tmp_rating_profiles', '*trend_profiles',
  '*trends', '*uch', '*versions',
];

// utils.AttrReloadCacheWithAPIOpts fields and the partition each one targets (AttrReloadCacheWithAPIOpts.Map).
const ARGS_CACHE: { field: string; partition: string }[] = [
  { field: 'DestinationIDs', partition: '*destinations' },
  { field: 'ReverseDestinationIDs', partition: '*reverse_destinations' },
  { field: 'RatingPlanIDs', partition: '*rating_plans' },
  { field: 'RatingProfileIDs', partition: '*rating_profiles' },
  { field: 'ActionIDs', partition: '*actions' },
  { field: 'ActionPlanIDs', partition: '*action_plans' },
  { field: 'AccountActionPlanIDs', partition: '*account_action_plans' },
  { field: 'ActionTriggerIDs', partition: '*action_triggers' },
  { field: 'SharedGroupIDs', partition: '*shared_groups' },
  { field: 'ResourceProfileIDs', partition: '*resource_profiles' },
  { field: 'ResourceIDs', partition: '*resources' },
  { field: 'IPProfileIDs', partition: '*ip_profiles' },
  { field: 'IPIDs', partition: '*ip_allocations' },
  { field: 'StatsQueueIDs', partition: '*statqueues' },
  { field: 'StatsQueueProfileIDs', partition: '*statqueue_profiles' },
  { field: 'ThresholdIDs', partition: '*thresholds' },
  { field: 'ThresholdProfileIDs', partition: '*threshold_profiles' },
  { field: 'RankingIDs', partition: '*rankings' },
  { field: 'RankingProfileIDs', partition: '*ranking_profiles' },
  { field: 'TrendIDs', partition: '*trends' },
  { field: 'TrendProfileIDs', partition: '*trend_profiles' },
  { field: 'FilterIDs', partition: '*filters' },
  { field: 'RouteProfileIDs', partition: '*route_profiles' },
  { field: 'AttributeProfileIDs', partition: '*attribute_profiles' },
  { field: 'ChargerProfileIDs', partition: '*charger_profiles' },
  { field: 'DispatcherProfileIDs', partition: '*dispatcher_profiles' },
  { field: 'DispatcherHostIDs', partition: '*dispatcher_hosts' },
  { field: 'Dispatchers', partition: '*dispatchers' },
  { field: 'TimingIDs', partition: '*timings' },
  { field: 'AttributeFilterIndexIDs', partition: '*attribute_filter_indexes' },
  { field: 'ResourceFilterIndexIDs', partition: '*resource_filter_indexes' },
  { field: 'IPFilterIndexIDs', partition: '*ip_filter_indexes' },
  { field: 'StatFilterIndexIDs', partition: '*stat_filter_indexes' },
  { field: 'ThresholdFilterIndexIDs', partition: '*threshold_filter_indexes' },
  { field: 'RouteFilterIndexIDs', partition: '*route_filter_indexes' },
  { field: 'ChargerFilterIndexIDs', partition: '*charger_filter_indexes' },
  { field: 'DispatcherFilterIndexIDs', partition: '*dispatcher_filter_indexes' },
  { field: 'FilterIndexIDs', partition: '*reverse_filter_indexes' },
];

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const [stats, setStats] = useState<Record<string, api.CacheStats> | null>(null);
  const [precache, setPrecache] = useState<Record<string, string>>({});
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [partition, setPartition] = useState('*attribute_profiles');
  const [prefix, setPrefix] = useState('');
  const [itemIds, setItemIds] = useState<string[] | null>(null);
  const [itemId, setItemId] = useState('');
  const [itemResult, setItemResult] = useState<{ label: string; ok: boolean; text: string } | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const [argIds, setArgIds] = useState<Record<string, string[]>>({});

  const loadStats = useCallback(async () => {
    if (!baseUrl) return;
    setStatsLoading(true); setStatsError(null);
    try {
      const [s, p] = await Promise.all([api.getCacheStats(baseUrl, tenant), api.precacheStatus(baseUrl, tenant)]);
      setStats(s); setPrecache(p);
    } catch (e: unknown) {
      setStatsError(errText(e));
    } finally {
      setStatsLoading(false);
    }
  }, [baseUrl, tenant]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const listIds = async () => {
    if (!baseUrl) return;
    setBrowsing(true); setItemResult(null);
    try { setItemIds(await api.getCacheItemIDs(baseUrl, tenant, partition, prefix)); }
    catch (e: unknown) { setItemIds([]); setItemResult({ label: 'GetItemIDs', ok: false, text: errText(e) }); }
    finally { setBrowsing(false); }
  };

  const itemCall = async (label: string, fn: () => Promise<unknown>) => {
    setBrowsing(true);
    try {
      const r = await fn();
      setItemResult({ label, ok: true, text: typeof r === 'string' ? r : JSON.stringify(r, null, 2) });
    } catch (e: unknown) {
      setItemResult({ label, ok: false, text: errText(e) });
    } finally {
      setBrowsing(false);
    }
  };

  const browse = (p: string) => { setPartition(p); setItemIds(null); setItemId(''); setItemResult(null); };

  const confirmClear = (ids: string[]) => ask({
    title: 'Clear cache',
    confirmLabel: 'Clear',
    body: (
      <Typography variant="body2">
        CacheSv1.Clear empties {ids.length ? ids.join(', ') : 'every cache partition'}. Items are reloaded from DataDB on next use;
        expect extra DB load and slower requests until the cache warms up.
      </Typography>
    ),
    run: async () => { const r = await api.clearCache(baseUrl!, tenant, ids); loadStats(); return r; },
  });

  const argsCacheField = ARGS_CACHE.find(a => a.partition === partition)?.field;

  const confirmArgs = (kind: 'ReloadCache' | 'LoadCache' | 'RemoveItems', args: Record<string, string[]>) => {
    const fn = { ReloadCache: api.reloadCache, LoadCache: api.loadCache, RemoveItems: api.removeCacheItems }[kind];
    const what = {
      ReloadCache: 'Re-reads these items from DataDB into the cache (*any: every item already cached in that partition).',
      LoadCache: 'Loads these items from DataDB into the cache (*any: every item in DataDB for that partition).',
      RemoveItems: 'Removes these items from the cache; they are fetched again from DataDB on next use.',
    }[kind];
    ask({
      title: kind,
      confirmLabel: kind,
      danger: kind === 'RemoveItems',
      body: (
        <Typography variant="body2" component="div">
          {what}
          <pre style={{ fontSize: 12 }}>{JSON.stringify(args, null, 2)}</pre>
        </Typography>
      ),
      run: async () => { const r = await fn(baseUrl!, tenant, args); loadStats(); return r; },
    });
  };

  const nonEmptyArgs = Object.fromEntries(Object.entries(argIds).filter(([, v]) => v.length));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Cache</Typography>
        <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
      </Box>
      {outcomeAlert}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Partitions</Typography>
          <Button onClick={loadStats} disabled={statsLoading}>Refresh</Button>
          <Button color="error" variant="outlined" disabled={selected.size === 0} onClick={() => confirmClear([...selected])}>
            Clear selected ({selected.size})
          </Button>
          <Button color="error" variant="outlined" onClick={() => confirmClear([])}>Clear all…</Button>
        </Box>
        {statsError && <Alert severity="error" sx={{ mb: 1 }}>{statsError}</Alert>}
        {statsLoading && !stats ? <CircularProgress size={24} /> : stats && (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Partition</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Groups</TableCell>
                  <TableCell>Precache</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(stats).sort(([a], [b]) => a.localeCompare(b)).map(([id, st]) => (
                  <TableRow key={id} hover selected={id === partition} sx={{ cursor: 'pointer' }} onClick={() => browse(id)}>
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(id)} onChange={e => setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(id); else next.delete(id);
                        return next;
                      })} />
                    </TableCell>
                    <TableCell><code>{id}</code></TableCell>
                    <TableCell align="right">{st.Items}</TableCell>
                    <TableCell align="right">{st.Groups}</TableCell>
                    <TableCell>{precache[id] && <Chip size="small" label={precache[id]} color={precache[id] === '*ready' ? 'success' : 'warning'} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Browse partition</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          <SearchableSelect label="Partition" value={partition} options={CACHE_PARTITIONS} onChange={browse} disableClearable sx={{ minWidth: 280 }} />
          <TextField size="small" label="ID prefix" value={prefix} onChange={e => setPrefix(e.target.value)} />
          <Button variant="contained" onClick={listIds} disabled={browsing}>Get item IDs</Button>
        </Box>
        {itemIds && (
          <Paper variant="outlined" sx={{ maxHeight: 260, overflow: 'auto', mb: 2 }}>
            <Typography variant="caption" sx={{ px: 2 }}>{itemIds.length} item(s)</Typography>
            <List dense disablePadding>
              {itemIds.map(id => (
                <ListItemButton key={id} selected={id === itemId} onClick={() => { setItemId(id); setItemResult(null); }}>
                  <ListItemText primary={id} primaryTypographyProps={{ fontFamily: 'monospace', fontSize: 12 }} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" label="Item ID" value={itemId} onChange={e => setItemId(e.target.value)} sx={{ minWidth: 360, flex: 1 }} />
          <Button disabled={!itemId || browsing} onClick={() => itemCall('HasItem', () => api.hasCacheItem(baseUrl!, tenant, partition, itemId))}>HasItem</Button>
          <Button disabled={!itemId || browsing} onClick={() => itemCall('GetItem', () => api.getCacheItem(baseUrl!, tenant, partition, itemId))}>GetItem</Button>
          <Button disabled={!itemId || browsing} onClick={() => itemCall('GetItemExpiryTime', () => api.getCacheItemExpiryTime(baseUrl!, tenant, partition, itemId))}>Expiry time</Button>
          <Button color="error" disabled={!itemId || !argsCacheField}
            title={argsCacheField ? undefined : 'RemoveItems has no field for this partition'}
            onClick={() => confirmArgs('RemoveItems', { [argsCacheField!]: [itemId] })}>Remove…</Button>
        </Box>
        {itemResult && (
          <Alert severity={itemResult.ok ? 'info' : 'error'} sx={{ mt: 2 }}>
            <strong>{itemResult.label}:</strong>
            <pre style={{ fontSize: 12, margin: 0, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{itemResult.text}</pre>
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">Reload / load / remove by type</Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 2 }}>
          Enter item IDs as Get item IDs lists them (profiles are usually tenant:ID), or *any for the whole type. Types left empty are not touched.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
          {ARGS_CACHE.map(a => (
            <IdMultiSelect key={a.field} label={a.field} value={argIds[a.field] || []} options={['*any']}
              onChange={v => setArgIds(prev => ({ ...prev, [a.field]: v }))} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" disabled={!Object.keys(nonEmptyArgs).length} onClick={() => confirmArgs('ReloadCache', nonEmptyArgs)}>ReloadCache…</Button>
          <Button variant="outlined" disabled={!Object.keys(nonEmptyArgs).length} onClick={() => confirmArgs('LoadCache', nonEmptyArgs)}>LoadCache…</Button>
          <Button variant="outlined" color="error" disabled={!Object.keys(nonEmptyArgs).length} onClick={() => confirmArgs('RemoveItems', nonEmptyArgs)}>RemoveItems…</Button>
          <Button onClick={() => setArgIds({})}>Reset</Button>
        </Box>
      </Paper>
      {confirmDialog}
    </Box>
  );
}
