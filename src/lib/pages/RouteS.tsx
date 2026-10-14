import { useState, useCallback, type ReactNode } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel, Autocomplete,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { FilterProfile, RouteEntry, RouteResult } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';

function sortingKeys(routes: RouteEntry[] | undefined): string[] {
  const keys = new Set<string>();
  (routes || []).forEach(r => Object.keys(r.SortingData || {}).forEach(k => keys.add(k)));
  return [...keys].sort();
}

function formatSortingValue(v: unknown): string {
  if (v === undefined || v === null) return '-';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function SortedRoutesTable({ routes, renderAction }: { routes: RouteEntry[]; renderAction?: (rt: RouteEntry) => ReactNode }) {
  const keys = sortingKeys(routes);
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Route ID</TableCell>
          <TableCell>Parameters</TableCell>
          {keys.map(k => <TableCell key={k}>{k}</TableCell>)}
          {renderAction && <TableCell>Actions</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {routes.map((rt, i) => (
          <TableRow key={i}>
            <TableCell><strong>{rt.RouteID}</strong></TableCell>
            <TableCell>{rt.RouteParameters || '-'}</TableCell>
            {keys.map(k => <TableCell key={k}>{formatSortingValue(rt.SortingData?.[k])}</TableCell>)}
            {renderAction && <TableCell>{renderAction(rt)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [eventId, setEventId] = useState('OmniWeb');
  const [usage, setUsage] = useState('1m');
  const [ignoreErrors, setIgnoreErrors] = useState(true);
  const [maxCost, setMaxCost] = useState('');
  const [limit, setLimit] = useState('');
  const [offset, setOffset] = useState('');
  const [profileCount, setProfileCount] = useState('');
  const [context, setContext] = useState('');
  const [searchedDestination, setSearchedDestination] = useState('');
  const [results, setResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [apiQuery, setApiQuery] = useState('');
  const [caching, setCaching] = useState('');

  // Detail modal
  const [detail, setDetail] = useState<RouteResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRoutes = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    const startTime = Date.now();
    const event: Record<string, unknown> = {
      Account: account,
      Tenant: tenant,
      Subject: account,
      SetupTime: new Date().toISOString().slice(0, 19),
      Destination: destination,
    };
    if (usage.trim()) event.Usage = usage.trim();
    const opts: Record<string, unknown> = { '*rouIgnoreErrors': ignoreErrors };
    const mc = maxCost.trim();
    if (mc) opts['*rouMaxCost'] = mc === '*event_cost' ? mc : Number(mc);
    if (limit.trim()) opts['*rouLimit'] = Number(limit);
    if (offset.trim()) opts['*rouOffset'] = Number(offset);
    if (profileCount.trim()) opts['*rouProfileCount'] = Number(profileCount);
    if (context.trim()) opts['*context'] = context.trim();
    const params = { Tenant: tenant, ID: eventId, Event: event, APIOpts: opts };
    setApiQuery(JSON.stringify({ method: 'RouteSv1.GetRoutes', params: [params], id: 1 }, null, 2));
    try {
      const r = await api.getRoutes(baseUrl, params) as RouteResult[];
      const endTime = Date.now();
      setResponseTime(((endTime - startTime) / 1000).toFixed(2));
      setResults(r || []);
      setSearchedDestination(destination);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setResults([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, account, destination, eventId, usage, ignoreErrors, maxCost, limit, offset, profileCount, context]);

  const blockRoute = useCallback(async (routeDestination: string, ratingPlanID: string) => {
    if (!baseUrl) return;
    try {
      const operatorName = ratingPlanID.split('_').pop();
      const filterId = `Filter_Operator_Route_Blacklist_${operatorName}`;

      let existing: FilterProfile | null = null;
      try {
        existing = await api.getFilter(baseUrl, tenant, filterId) as FilterProfile;
      } catch (e) {
        if (!(e instanceof Error && e.message === 'NOT_FOUND')) throw e;
      }
      const rule = { Type: '*notprefix', Element: '~*req.Destination', Values: [routeDestination] };
      await api.setFilter(baseUrl, {
        ...existing,
        Tenant: tenant,
        ID: filterId,
        Rules: [...(existing?.Rules || []), rule],
        APIOpts: cachingOpts(caching),
      });

      alert(`Route for destination ${routeDestination} blocked for operator ${operatorName} (filter ${filterId}).`);
    } catch (e: unknown) {
      alert(`Failed to block route: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [baseUrl, tenant, caching]);

  const numberField = (label: string, value: string, set: (v: string) => void, helperText?: string) => (
    <TextField size="small" type="number" label={label} value={value} onChange={e => set(e.target.value)} helperText={helperText} sx={{ width: 150 }} />
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Route Lookup</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <TextField size="small" label="Usage" value={usage} onChange={e => setUsage(e.target.value)} helperText="Empty: RouteS uses 1m" />
          <TextField size="small" label="Event ID" value={eventId} onChange={e => setEventId(e.target.value)} />
          <Button variant="contained" onClick={fetchRoutes}>Search</Button>
        </Box>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Options (APIOpts)</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <FormControlLabel label="Ignore errors (*rouIgnoreErrors)"
            control={<Checkbox checked={ignoreErrors} onChange={e => setIgnoreErrors(e.target.checked)} />} />
          <Autocomplete<string, false, false, true>
            freeSolo size="small" options={['*event_cost']} value={maxCost} onInputChange={(_e, v) => setMaxCost(v)} sx={{ width: 200 }}
            renderInput={p => <TextField {...p} label="Max cost (*rouMaxCost)" helperText="Number or *event_cost" />}
          />
          {numberField('*rouLimit', limit, setLimit, 'Max routes')}
          {numberField('*rouOffset', offset, setOffset, 'Skip routes')}
          {numberField('*rouProfileCount', profileCount, setProfileCount, 'Max profiles')}
          <Autocomplete<string, false, false, true>
            freeSolo size="small" options={['*routes']} value={context} onInputChange={(_e, v) => setContext(v)} sx={{ width: 180 }}
            renderInput={p => <TextField {...p} label="Context (*context)" helperText="For AttributeS" />}
          />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {responseTime && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Response from CGrateS in {responseTime} seconds
        </Typography>
      )}

      {apiQuery && (
        <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
          <pre style={{ fontSize: 11, margin: 0 }}>{apiQuery}</pre>
        </Paper>
      )}

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Profile ID</TableCell>
                <TableCell>Sorting</TableCell>
                <TableCell>Routes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length > 0 ? results.map((r, i) => (
                <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(r); setDetailOpen(true); }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.ProfileID}</TableCell>
                  <TableCell>{r.Sorting}</TableCell>
                  <TableCell>
                    {r.Routes?.map((rt, ri) => (
                      <Box key={ri} sx={{ mb: 0.5 }}>
                        <strong>{rt.RouteID}</strong>
                        {Object.entries(rt.SortingData || {}).map(([k, v]) => ` | ${k}: ${formatSortingValue(v)}`).join('')}
                      </Box>
                    ))}
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} align="center">No results</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Route Details{detail ? `: ${detail.ProfileID}` : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            "Block" adds a *notprefix rule for destination {searchedDestination || '(empty)'} to the filter
            Filter_Operator_Route_Blacklist_&lt;operator&gt;, creating it if needed. Routes only honour it if they reference that filter.
          </Typography>
          <CachingSelect value={caching} onChange={setCaching} sx={{ mb: 2 }} />
          {detail && (
            <Box sx={{ mt: 1 }}>
              <Typography><strong>Profile ID:</strong> {detail.ProfileID}</Typography>
              <Typography><strong>Sorting:</strong> {detail.Sorting}</Typography>
              <TableContainer sx={{ mt: 2 }}>
                <SortedRoutesTable
                  routes={detail.Routes || []}
                  renderAction={rt => (
                    <Button size="small" color="error" variant="outlined"
                      disabled={!rt.SortingData?.RatingPlanID || !searchedDestination}
                      onClick={() => blockRoute(searchedDestination, String(rt.SortingData.RatingPlanID))}>
                      Block for Destination
                    </Button>
                  )}
                />
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
