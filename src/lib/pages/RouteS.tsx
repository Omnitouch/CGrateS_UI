import { useState, useCallback, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel, Autocomplete,
  Collapse, Link, Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { FilterProfile, RouteEntry, RouteResult, RouteProfile } from '../types';
import { CachingAdvanced, cachingOpts } from '../components/CachingSelect';
import TenantPicker from '../components/TenantPicker';
import KeyValueEditor, { rowsToObject, type KeyValueRow } from '../components/KeyValueEditor';
import { FilterIdsText } from '../components/FilterText';
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

type Outcome =
  | { kind: 'routes'; results: RouteResult[] }
  | { kind: 'noRoutes'; matched: number }
  | { kind: 'noMatch'; configured: number | null };

function Hint({ children }: { children: ReactNode }) {
  return <Typography variant="caption" color="text.secondary" component="span">{children}</Typography>;
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [eventId, setEventId] = useState('');
  const [usage, setUsage] = useState('');
  const [ignoreErrors, setIgnoreErrors] = useState(true);
  const [maxCost, setMaxCost] = useState('');
  const [limit, setLimit] = useState('');
  const [offset, setOffset] = useState('');
  const [profileCount, setProfileCount] = useState('');
  const [context, setContext] = useState('');
  const [extraFields, setExtraFields] = useState<KeyValueRow[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searched, setSearched] = useState<{ destination: string; tenant: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [matchedProfiles, setMatchedProfiles] = useState<RouteProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [apiQuery, setApiQuery] = useState('');
  const [showQuery, setShowQuery] = useState(false);
  const [caching, setCaching] = useState('');

  const [detail, setDetail] = useState<RouteResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRoutes = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null); setOutcome(null); setMatchedProfiles([]);
    const startTime = Date.now();
    const event: Record<string, unknown> = { ...rowsToObject(extraFields), SetupTime: new Date().toISOString().slice(0, 19), Destination: destination.trim() };
    if (account.trim()) { event.Account = account.trim(); event.Subject = account.trim(); }
    if (usage.trim()) event.Usage = usage.trim();
    const opts: Record<string, unknown> = { '*rouIgnoreErrors': ignoreErrors };
    const mc = maxCost.trim();
    if (mc) opts['*rouMaxCost'] = mc === '*event_cost' ? mc : Number(mc);
    if (limit.trim()) opts['*rouLimit'] = Number(limit);
    if (offset.trim()) opts['*rouOffset'] = Number(offset);
    if (profileCount.trim()) opts['*rouProfileCount'] = Number(profileCount);
    if (context.trim()) opts['*context'] = context.trim();
    const params = { Tenant: tenant, ID: eventId.trim() || `cgrates-ui-${Date.now()}`, Event: event, APIOpts: opts };
    setApiQuery(JSON.stringify({ method: 'RouteSv1.GetRoutes', params: [params], id: 1 }, null, 2));
    const orEmpty = <T,>(p: Promise<T>) => p.catch(e => { if (api.isNotFound(e)) return null; throw e; });
    try {
      // GetRouteProfilesForEvent runs alongside so a NOT_FOUND can say whether any profile matched.
      const [routes, profiles] = await Promise.all([
        orEmpty(api.getRoutes(baseUrl, params) as Promise<RouteResult[]>),
        orEmpty(api.getRouteProfilesForEvent(baseUrl, { ...params, APIOpts: {} }) as Promise<RouteProfile[]>),
      ]);
      setMatchedProfiles(profiles || []);
      if (routes?.length) setOutcome({ kind: 'routes', results: routes });
      else if (profiles?.length) setOutcome({ kind: 'noRoutes', matched: profiles.length });
      else {
        const ids = await orEmpty(api.getRouteProfileIDs(baseUrl, tenant)).catch(() => undefined);
        setOutcome({ kind: 'noMatch', configured: ids === undefined ? null : (ids || []).length });
      }
      setResponseTime(((Date.now() - startTime) / 1000).toFixed(2));
      setSearched({ destination: destination.trim(), tenant });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, account, destination, eventId, usage, ignoreErrors, maxCost, limit, offset, profileCount, context, extraFields]);

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

  const numberField = (label: string, key: string, value: string, set: (v: string) => void, help: string) => (
    <TextField size="small" type="number" label={label} value={value} onChange={e => set(e.target.value)} sx={{ width: 220 }}
      helperText={<>{help} <code>{key}</code></>} />
  );

  const searchedDestination = searched?.destination || '';
  const results = outcome?.kind === 'routes' ? outcome.results : [];
  const advancedCount = [eventId, maxCost, limit, offset, profileCount, context].filter(v => v.trim()).length
    + extraFields.filter(r => r.key.trim()).length + (ignoreErrors ? 0 : 1);

  return (
    <Box>
      <Typography variant="h5">Route Lookup</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Test routing: which route profiles match an event, and the routes RouteS returns for it, in order. Nothing is stored.
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={e => { e.preventDefault(); fetchRoutes(); }}
          sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TenantPicker value={tenant} onChange={setTenant} />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} autoFocus
            helperText="Number being called" />
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} helperText="Optional; also sent as Subject" />
          <TextField size="small" label="Usage" value={usage} onChange={e => setUsage(e.target.value)} helperText="Optional; RouteS assumes 1m" sx={{ width: 160 }} />
          <Button type="submit" variant="contained" disabled={loading || !destination.trim()} sx={{ mt: 0.25 }}>Find routes</Button>
        </Box>
        <Button size="small" sx={{ mt: 1 }} onClick={() => setAdvancedOpen(o => !o)} endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
          Advanced{advancedCount ? ` (${advancedCount} set)` : ''}
        </Button>
        <Collapse in={advancedOpen}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mt: 1.5 }}>
            <TextField size="small" label="Event ID" value={eventId} onChange={e => setEventId(e.target.value)}
              helperText="Optional; generated automatically" sx={{ width: 220 }} />
            <Autocomplete<string, false, false, true>
              freeSolo size="small" options={['*event_cost']} value={maxCost} onInputChange={(_e, v) => setMaxCost(v)} sx={{ width: 220 }}
              renderInput={p => <TextField {...p} label="Maximum cost"
                helperText={<>Drop dearer routes; a number, or *event_cost for this event's own cost <code>*rouMaxCost</code></>} />}
            />
            {numberField('Maximum routes', '*rouLimit', limit, setLimit, 'Across all profiles')}
            {numberField('Skip first N routes', '*rouOffset', offset, setOffset, 'For paging')}
            {numberField('Maximum profiles', '*rouProfileCount', profileCount, setProfileCount, 'Highest weight first')}
            <Autocomplete<string, false, false, true>
              freeSolo size="small" options={['*routes']} value={context} onInputChange={(_e, v) => setContext(v)} sx={{ width: 220 }}
              renderInput={p => <TextField {...p} label="AttributeS context"
                helperText={<>Used if RouteS calls AttributeS first; default *routes <code>*context</code></>} />}
            />
            <FormControlLabel sx={{ width: 320, alignItems: 'flex-start', m: 0 }}
              control={<Checkbox size="small" checked={ignoreErrors} onChange={e => setIgnoreErrors(e.target.checked)} sx={{ pt: 0 }} />}
              label={<Box><Typography variant="body2">Skip routes that fail</Typography>
                <Hint>Ignore a route whose cost, stats or resource lookup errors instead of failing the request <code>*rouIgnoreErrors</code></Hint></Box>} />
          </Box>
          <Box sx={{ mt: 2, maxWidth: 700 }}>
            <KeyValueEditor label="Extra event fields" rows={extraFields} onChange={setExtraFields} keyPlaceholder="Field, e.g. Category" />
          </Box>
        </Collapse>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}

      {!loading && outcome && searched && (
        <>
          {outcome.kind === 'noMatch' && (outcome.configured === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Routing isn't configured on this OCS: tenant {searched.tenant} has no route profiles.{' '}
              <Link component={RouterLink} to="../route-profiles" relative="path">Go to Route Profiles</Link>
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No route profiles match {searched.destination || '(empty destination)'} for tenant {searched.tenant}
              {outcome.configured !== null && ` (${outcome.configured} route ${outcome.configured === 1 ? 'profile' : 'profiles'} configured)`}.{' '}
              <Link component={RouterLink} to="../route-profiles" relative="path">View route profiles</Link>
            </Alert>
          ))}
          {outcome.kind === 'noRoutes' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {outcome.matched} route {outcome.matched === 1 ? 'profile matches' : 'profiles match'} {searched.destination}, but none returned a route:
              each route's own filters, the maximum cost or the limits excluded them.
            </Alert>
          )}

          {matchedProfiles.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Matching route profiles ({matchedProfiles.length})</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Profile</TableCell><TableCell>Sorting</TableCell><TableCell>Applies when</TableCell><TableCell align="right">Weight</TableCell><TableCell align="right">Routes</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {matchedProfiles.map(p => (
                    <TableRow key={p.ID}>
                      <TableCell>{p.ID}</TableCell>
                      <TableCell>{p.Sorting}</TableCell>
                      <TableCell><FilterIdsText ids={p.FilterIDs} /></TableCell>
                      <TableCell align="right">{p.Weight}</TableCell>
                      <TableCell align="right">{p.Routes?.length ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {results.length > 0 && (
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Profile ID</TableCell>
                    <TableCell>Sorting</TableCell>
                    <TableCell>Routes, best first</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((r, i) => (
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
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {responseTime && <Typography variant="body2" color="text.secondary">Answered in {responseTime} s</Typography>}
            <Button size="small" onClick={() => setShowQuery(v => !v)}>{showQuery ? 'Hide' : 'Show'} API request</Button>
            {outcome.kind !== 'routes' && <Chip size="small" variant="outlined" label="RouteSv1.GetRoutes: NOT_FOUND" />}
          </Box>
          <Collapse in={showQuery}>
            <Paper sx={{ p: 1, mt: 1, bgcolor: 'action.hover', maxHeight: 300, overflow: 'auto' }}>
              <pre style={{ fontSize: 11, margin: 0 }}>{apiQuery}</pre>
            </Paper>
          </Collapse>
        </>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Route Details{detail ? `: ${detail.ProfileID}` : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            "Block" adds a *notprefix rule for destination {searchedDestination || '(empty)'} to the filter
            Filter_Operator_Route_Blacklist_&lt;operator&gt;, creating it if needed. Routes only honour it if they reference that filter.
          </Typography>
          <Box sx={{ mb: 2 }}><CachingAdvanced value={caching} onChange={setCaching} action="blocking" /></Box>
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
