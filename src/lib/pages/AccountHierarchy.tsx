import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import HierarchyView from '../components/HierarchyView';
import { accountTree } from '../accountHierarchy';

const ID_LIMIT = 200;

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [params, setParams] = useSearchParams();
  const tenant = params.get('tenant') || defaultTenant;
  const account = params.get('account') || '';
  const update = (patch: Record<string, string>) => setParams(prev => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });

  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const ids = useQuery({
    queryKey: ['ah-ids', baseUrl, tenant, q],
    queryFn: () => api.getAccountIDs(baseUrl!, tenant, q || undefined, ID_LIMIT).catch(e => {
      if (e instanceof Error && e.message.includes('NOT_FOUND')) return [];
      throw e;
    }),
    placeholderData: prev => prev,
    enabled: !!baseUrl && !!tenant,
  });
  const tree = useQuery({
    queryKey: ['ah-tree', baseUrl, tenant, account],
    queryFn: () => accountTree(baseUrl!, tenant, account),
    enabled: !!baseUrl && !!tenant && !!account,
  });

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Account Hierarchy</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={v => update({ tenant: v, account: '' })} disableClearable sx={{ minWidth: 240 }} />
          <SearchableSelect label="Account" value={account} options={[...(ids.data || [])].sort()} onChange={v => update({ account: v })}
            onInputChange={setSearch} maxOptions={ID_LIMIT} placeholder="Type to search" sx={{ minWidth: 320 }} />
          {(ids.isFetching || tree.isFetching) && <CircularProgress size={20} />}
        </Stack>
        {ids.data && ids.data.length >= ID_LIMIT && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Showing the first {ID_LIMIT} accounts; type part of an ID to search the rest.
          </Typography>
        )}
      </Paper>
      {ids.error && <Alert severity="error" sx={{ mb: 2 }}>{(ids.error as Error).message}</Alert>}
      {tree.error && <Alert severity="error" sx={{ mb: 2 }}>{(tree.error as Error).message}</Alert>}
      {tree.data && <HierarchyView root={tree.data} />}
    </Box>
  );
}
