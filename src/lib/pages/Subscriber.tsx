import { useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip, Collapse, MenuItem, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Account, AccountActionPlan, Balance, CDR, Session } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { BalanceName, BalanceBucket, CompositeId } from '../components/ParsedId';
import { formatBalanceValue } from '../components/BalanceValue';
import { formatDateTime, formatRelative } from '../formatTime';

const CDR_WINDOWS = [
  { label: 'Last hour', hours: 1 },
  { label: 'Last 6 hours', hours: 6 },
  { label: 'Last 24 hours', hours: 24 },
  { label: 'Last 7 days', hours: 168 },
  { label: 'Last 30 days', hours: 720 },
];
const CDR_LIMIT = 20;

interface ResourceUsage { Tenant: string; ID: string; ExpiryTime: string; Units: number }
interface Resource { Tenant: string; ID: string; Usages: Record<string, ResourceUsage> | null; TTLIdx: string[] | null }
interface ResourceRow { resource: Resource; profile: Record<string, unknown> | null; profileError: string | null }

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function When({ value }: { value: string }) {
  return <Tooltip title={formatDateTime(value)}><span>{formatRelative(value)}</span></Tooltip>;
}

function Value({ raw, type }: { raw: number; type: string }) {
  const pretty = formatBalanceValue(raw, type);
  return (
    <>
      {pretty}
      {pretty !== String(raw) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{raw}</Typography>}
    </>
  );
}

function setText(m: Record<string, boolean> | string | null | undefined) {
  if (!m) return '';
  return typeof m === 'string' ? m : Object.keys(m).filter(k => m[k]).join(', ');
}

function Section({ title, link, query, isEmpty, empty, raw, children, caption }: {
  title: string;
  link?: { to: string; label: string };
  query: { isPending: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };
  isEmpty: boolean;
  empty: string;
  raw: unknown;
  children: ReactNode;
  caption?: ReactNode;
}) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>{title}</Typography>
        {query.isFetching && <CircularProgress size={18} />}
        <Button size="small" onClick={() => query.refetch()}>Refresh</Button>
        {!query.isPending && !query.error && <Button size="small" onClick={() => setShowRaw(v => !v)}>{showRaw ? 'Hide' : 'Raw'} JSON</Button>}
        {link && (
          <Button size="small" variant="outlined" component={RouterLink} to={link.to} endIcon={<OpenInNewIcon fontSize="small" />}>
            {link.label}
          </Button>
        )}
      </Box>
      {caption && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{caption}</Typography>}
      {query.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
      ) : query.error ? (
        <Alert severity="error">{errText(query.error)}</Alert>
      ) : isEmpty ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : children}
      <Collapse in={showRaw} unmountOnExit>
        <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', maxHeight: 400, fontSize: 12 }}>
          {JSON.stringify(raw, null, 2)}
        </Box>
      </Collapse>
    </Paper>
  );
}

function newId() {
  return [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [params, setParams] = useSearchParams();
  const account = params.get('account') ?? '';
  const tenant = params.get('tenant') || defaultTenant;
  const [input, setInput] = useState(account);
  const [tenantInput, setTenantInput] = useState(tenant);
  useEffect(() => { setInput(account); setTenantInput(tenant); }, [account, tenant]);
  const [cdrHours, setCdrHours] = useState(24);
  const enabled = !!baseUrl && !!tenant && !!account;

  const open = () => {
    const id = input.trim();
    if (!id) return;
    const next: Record<string, string> = { account: id };
    if (tenantInput !== defaultTenant) next.tenant = tenantInput;
    setParams(next);
  };

  const accountQ = useQuery({
    queryKey: ['ocs', 'subscriber', 'account', baseUrl, tenant, account],
    queryFn: async () => ((await api.getAccounts(baseUrl!, tenant, 0, 1, [account])) as Account[] | null)?.[0] ?? null,
    enabled,
  });

  const sessionsQ = useQuery({
    queryKey: ['ocs', 'subscriber', 'sessions', baseUrl, tenant, account],
    queryFn: async () => {
      try {
        return ((await api.getActiveSessions(baseUrl!, tenant, [`*string:~*req.Account:${account}`])) as Session[] | null) ?? [];
      } catch (e) {
        if (api.isNotFound(e)) return [];
        throw e;
      }
    },
    enabled,
  });

  const cdrsQ = useQuery({
    queryKey: ['ocs', 'subscriber', 'cdrs', baseUrl, tenant, account, cdrHours],
    queryFn: async () => {
      const filter = {
        Tenants: [tenant],
        Accounts: [account],
        SetupTimeStart: new Date(Date.now() - cdrHours * 3600e3).toISOString(),
      };
      try {
        const [cdrs, count] = await Promise.all([
          api.getCDRs(baseUrl!, { ...filter, OrderBy: 'SetupTime;desc', Limit: CDR_LIMIT }) as Promise<CDR[] | null>,
          api.getCDRsCount(baseUrl!, filter),
        ]);
        return { cdrs: cdrs ?? [], count };
      } catch (e) {
        if (api.isNotFound(e)) return { cdrs: [] as CDR[], count: 0 };
        throw e;
      }
    },
    enabled,
  });

  const plansQ = useQuery({
    queryKey: ['ocs', 'subscriber', 'plans', baseUrl, tenant, account],
    queryFn: async () => {
      try {
        return ((await api.getAccountActionPlan(baseUrl!, tenant, account)) as AccountActionPlan[] | null) ?? [];
      } catch (e) {
        if (api.isNotFound(e)) return [];
        throw e;
      }
    },
    enabled,
  });

  const resourcesQ = useQuery({
    queryKey: ['ocs', 'subscriber', 'resources', baseUrl, tenant, account],
    queryFn: async (): Promise<ResourceRow[]> => {
      // A fresh UsageID per lookup: ResourceS caches the matched IDs under it.
      const id = `subscriber-view-${newId()}`;
      let resources: Resource[];
      try {
        resources = ((await api.resourceSEvent(baseUrl!, 'ResourceSv1.GetResourcesForEvent', {
          Tenant: tenant, ID: id, Event: { Account: account }, APIOpts: { '*rsUsageID': id },
        })) as Resource[] | null) ?? [];
      } catch (e) {
        if (api.isNotFound(e)) return [];
        throw e;
      }
      return Promise.all(resources.map(async resource => {
        try {
          return { resource, profile: (await api.getResourceProfile(baseUrl!, resource.Tenant, resource.ID)) as Record<string, unknown>, profileError: null };
        } catch (e) {
          return { resource, profile: null, profileError: errText(e) };
        }
      }));
    },
    enabled,
    retry: false,
  });

  const acc = accountQ.data;
  const accountNotFound = accountQ.isSuccess && !acc;
  const balanceEntries = acc?.BalanceMap ? Object.entries(acc.BalanceMap) : [];
  const triggers = acc?.ActionTriggers ?? [];
  const enc = encodeURIComponent(account);
  const resourceError = resourcesQ.error && /can't find service/i.test(errText(resourcesQ.error))
    ? new Error(`ResourceS is not enabled on this engine (${errText(resourcesQ.error)})`)
    : resourcesQ.error;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Subscriber</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={e => { e.preventDefault(); open(); }}
          sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <SearchableSelect label="Tenant" value={tenantInput} options={tenants} onChange={setTenantInput} disableClearable sx={{ minWidth: 200 }} />
          <TextField size="small" label="Account ID" value={input} onChange={e => setInput(e.target.value)}
            sx={{ minWidth: 320 }} helperText="Exact account ID (CGrateS has no partial account search)" />
          <Button type="submit" variant="contained" disabled={!input.trim()}>Open</Button>
        </Box>
      </Paper>

      {!account ? (
        <Typography color="text.secondary">
          Enter an account ID to see its balances, active sessions, recent CDRs, limits, action plans and triggers on one page.
        </Typography>
      ) : accountNotFound ? (
        <Alert severity="warning">No account <strong>{account}</strong> in tenant {tenant}.</Alert>
      ) : (
        <>
          <Section
            title="Account & balances"
            link={{ to: `../accounts?q=${enc}`, label: 'Manage in Accounts' }}
            query={accountQ} isEmpty={!balanceEntries.length} empty="This account has no balances." raw={acc}
            caption={acc && (
              <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{acc.ID}</span>
                <Chip size="small" label={acc.Disabled ? 'Disabled' : 'Enabled'} color={acc.Disabled ? 'error' : 'success'} />
                <Chip size="small" variant="outlined" label={acc.AllowNegative ? 'Allow negative' : 'No negative'} />
                <span>Updated <When value={acc.UpdateTime} /></span>
              </Box>
            )}
          >
            {balanceEntries.map(([type, balances]) => (
              <Box key={type} sx={{ mb: 2 }}>
                <Typography variant="subtitle1">{type}</Typography>
                <TableContainer>
                  <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '30%' }}>Balance</TableCell>
                        <TableCell sx={{ width: '22%' }}>Value</TableCell>
                        <TableCell sx={{ width: '12%' }}>Expires</TableCell>
                        <TableCell sx={{ width: '8%' }}>Weight</TableCell>
                        <TableCell sx={{ width: '18%' }}>Destinations</TableCell>
                        <TableCell sx={{ width: '10%' }}>Flags</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(balances as Balance[]).map((b, i) => (
                        <TableRow key={b.Uuid || i}>
                          <TableCell>{b.ID ? <BalanceName id={b.ID} /> : <Typography variant="body2" color="text.secondary">(no ID)</Typography>}</TableCell>
                          <TableCell>
                            <Value raw={b.Value} type={type} />
                            <BalanceBucket id={b.ID} balanceType={type} value={b.Value} />
                          </TableCell>
                          <TableCell><When value={b.ExpirationDate} /></TableCell>
                          <TableCell>{b.Weight}</TableCell>
                          <TableCell sx={{ wordBreak: 'break-word' }}>{setText(b.DestinationIDs)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {b.Blocker && <Chip size="small" label="Blocker" />}
                              {b.Disabled && <Chip size="small" color="error" label="Disabled" />}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </Section>

          <Section
            title={`Active sessions${sessionsQ.data ? ` (${sessionsQ.data.length})` : ''}`}
            link={{ to: `../sessions?account=${enc}`, label: 'Open in Sessions' }}
            query={sessionsQ} isEmpty={!sessionsQ.data?.length} empty="No active sessions for this account." raw={sessionsQ.data}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Started</TableCell>
                    <TableCell>ToR</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell>Usage</TableCell>
                    <TableCell>Run</TableCell>
                    <TableCell>Origin host</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessionsQ.data?.map(s => (
                    <TableRow key={`${s.CGRID}-${s.RunID}`}>
                      <TableCell><When value={s.SetupTime} /></TableCell>
                      <TableCell>{s.ToR}</TableCell>
                      <TableCell>{s.Category}</TableCell>
                      <TableCell>{s.Subject}</TableCell>
                      <TableCell>{s.Destination}</TableCell>
                      <TableCell><Value raw={s.Usage} type={s.ToR} /></TableCell>
                      <TableCell>{s.RunID}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-all' }}>{s.OriginHost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section
            title="Recent CDRs"
            link={{ to: `../cdrs?account=${enc}`, label: 'Open in CDRs' }}
            query={cdrsQ} isEmpty={!cdrsQ.data?.cdrs.length} empty="No CDRs for this account in the selected window." raw={cdrsQ.data?.cdrs}
            caption={(
              <Box component="span" sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField select size="small" value={cdrHours} onChange={e => setCdrHours(Number(e.target.value))} sx={{ minWidth: 160 }}>
                  {CDR_WINDOWS.map(w => <MenuItem key={w.hours} value={w.hours}>{w.label}</MenuItem>)}
                </TextField>
                {cdrsQ.data && (
                  <span>
                    {cdrsQ.data.count > cdrsQ.data.cdrs.length
                      ? `Newest ${cdrsQ.data.cdrs.length} of ${cdrsQ.data.count}, by setup time`
                      : `${cdrsQ.data.count} CDR${cdrsQ.data.count === 1 ? '' : 's'}, newest first`}
                  </span>
                )}
              </Box>
            )}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Setup</TableCell>
                    <TableCell>ToR</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell>Usage</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>Run</TableCell>
                    <TableCell>Request type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cdrsQ.data?.cdrs.map(c => (
                    <TableRow key={`${c.CGRID}-${c.RunID}`}>
                      <TableCell><When value={c.SetupTime} /></TableCell>
                      <TableCell>{c.ToR}</TableCell>
                      <TableCell>{c.Category}</TableCell>
                      <TableCell>{c.Subject}</TableCell>
                      <TableCell>{c.Destination}</TableCell>
                      <TableCell><Value raw={c.Usage} type={c.ToR} /></TableCell>
                      <TableCell>{c.Cost}</TableCell>
                      <TableCell>{c.RunID}</TableCell>
                      <TableCell>{c.RequestType}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section
            title="Limits (resources)"
            link={{ to: '../resources', label: 'Open Resources' }}
            query={{ ...resourcesQ, error: resourceError }}
            isEmpty={!resourcesQ.data?.length} empty="No resource profile matches this account." raw={resourcesQ.data}
            caption="Resource profiles whose filters match an event carrying only this Account (ResourceSv1.GetResourcesForEvent). Profiles that also filter on other fields will not show here."
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell>In use</TableCell>
                    <TableCell>Limit</TableCell>
                    <TableCell>Active usages</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resourcesQ.data?.map(({ resource, profile, profileError }) => {
                    const usages = Object.values(resource.Usages ?? {});
                    return (
                      <TableRow key={`${resource.Tenant}:${resource.ID}`}>
                        <TableCell>{resource.ID}</TableCell>
                        <TableCell>{usages.reduce((n, u) => n + u.Units, 0)}</TableCell>
                        <TableCell>
                          {profile ? String(profile.Limit) : <Typography variant="caption" color="error">{profileError}</Typography>}
                        </TableCell>
                        <TableCell>{usages.length}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section
            title="Action plans"
            link={{ to: '../action-plans', label: 'Open Action Plans' }}
            query={plansQ} isEmpty={!plansQ.data?.length} empty="No action plans assigned to this account." raw={plansQ.data}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Action plan</TableCell>
                    <TableCell>Actions</TableCell>
                    <TableCell>Next run</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plansQ.data?.map((p, i) => (
                    <TableRow key={p.Uuid || i}>
                      <TableCell><CompositeId id={p.ActionPlanId} compact /></TableCell>
                      <TableCell><CompositeId id={p.ActionsId} compact /></TableCell>
                      <TableCell><When value={p.NextExecTime} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section
            title="Action triggers"
            link={{ to: `../accounts?q=${enc}`, label: 'Manage in Accounts' }}
            query={accountQ} isEmpty={!triggers.length} empty="No action triggers on this account." raw={triggers}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Threshold</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell>Actions</TableCell>
                    <TableCell>Recurrent</TableCell>
                    <TableCell>Last executed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {triggers.map((t, i) => (
                    <TableRow key={t.UniqueID || i}>
                      <TableCell>
                        {t.ID}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t.UniqueID}</Typography>
                      </TableCell>
                      <TableCell>
                        {t.ThresholdType}{' '}
                        {t.ThresholdType !== '*balance_expired'
                          && formatBalanceValue(t.ThresholdValue, t.ThresholdType.includes('event') ? undefined : t.Balance?.Type)}
                      </TableCell>
                      <TableCell>{[t.Balance?.Type, t.Balance?.ID].filter(Boolean).join(' ')}</TableCell>
                      <TableCell><CompositeId id={t.ActionsID} compact /></TableCell>
                      <TableCell>{t.Recurrent ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <When value={t.LastExecutionTime} />
                        {t.Executed && <Chip size="small" label="Executed" sx={{ ml: 1 }} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        </>
      )}
    </Box>
  );
}
