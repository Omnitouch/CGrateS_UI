import type { ActionPlan, ActionTriggerEntry, CGREventArgs, JsonRpcResponse } from './types';

let rpcId = 0;

/** Send a JSON-RPC request to CGrateS */
export async function jsonRpc<T = unknown>(
  baseUrl: string,
  method: string,
  params: unknown[] = [{}],
): Promise<T> {
  const body = {
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params,
  };

  const res = await fetch(`${baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data: JsonRpcResponse<T> = await res.json();

  if (data.error) {
    // CGrateS sends the error as a plain string (e.g. "NOT_FOUND").
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
  }

  return data.result as T;
}

/** CGrateS answers an empty lookup with the NOT_FOUND error rather than an empty result. */
export function isNotFound(e: unknown) {
  return e instanceof Error && e.message === 'NOT_FOUND';
}

// --- Accounts ---

export function getAccounts(baseUrl: string, tenant: string, offset = 0, limit = 50, accountIds?: string[]) {
  return jsonRpc(baseUrl, 'APIerSv2.GetAccounts', [{
    Tenant: tenant,
    AccountIDs: accountIds || null,
    Offset: offset,
    Limit: limit,
    Filter: null,
  }]);
}

export function setAccount(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv2.SetAccount', [params]);
}

export function removeAccount(baseUrl: string, tenant: string, account: string) {
  return jsonRpc(baseUrl, 'ApierV1.RemoveAccount', [{ Tenant: tenant, Account: account, ReloadScheduler: true }]);
}

export function executeAction(baseUrl: string, tenant: string, account: string, actionsId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.ExecuteAction', [{ Tenant: tenant, Account: account, ActionsId: actionsId }]);
}

export function removeBalances(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveBalances', [params]);
}

export function addBalance(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.AddBalance', [params]);
}

export function debitBalance(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.DebitBalance', [params]);
}

export function setBalance(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetBalance', [params]);
}

export function transferBalance(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.TransferBalance', [params]);
}

// --- CDRs ---

export function getCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'CDRsV2.GetCDRs', [params]);
}

export function getCDRsCount(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<number>(baseUrl, 'CDRsV1.GetCDRsCount', [params]);
}

export function exportCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.ExportCDRs', [params]);
}

export function removeCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveCDRs', [params]);
}

/** CDRsV1.RateCDRs / ReprocessCDRs take engine.ArgRateCDRs: Flags + RPCCDRsFilter fields + Tenant + APIOpts. */
export function rateCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'CDRsV1.RateCDRs', [params]);
}

export function reprocessCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'CDRsV1.ReprocessCDRs', [params]);
}

// --- Destinations (TP) ---

export function getTPIds(baseUrl: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetTPIds', []);
}

/** TP id lists take PaginatorWithSearch; Search is a SQL LIKE on the id. An empty TP replies null. */
function tpIdsParams(tpid: string, search?: string) {
  return search ? { TPid: tpid, Search: search } : { TPid: tpid };
}

export function getTPDestinationIDs(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'ApierV1.GetTPDestinationIDs', [tpIdsParams(tpid, search)]);
}

/** DataDB has no destination listing API, so offer the IDs defined across all tariff plans. */
export async function getAllTPDestinationIds(baseUrl: string): Promise<string[]> {
  const tpids = await getTPIds(baseUrl).catch(() => [] as string[]) || [];
  const lists = await Promise.all(tpids.map(tpid => getTPDestinationIDs(baseUrl, tpid).catch(() => [] as string[])));
  return [...new Set(lists.flatMap(l => l || []))].sort();
}

export function getTPDestination(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPDestination', [{ TPid: tpid, ID: id }]);
}

export function setTPDestination(baseUrl: string, tpid: string, id: string, prefixes: string[]) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetTPDestination', [{ TPid: tpid, ID: id, Prefixes: prefixes }]);
}

export function removeTPDestination(baseUrl: string, tpid: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPDestination', [{ TPid: tpid, ID: id }]);
}

// --- Destinations (live DataDB) ---

export interface LiveDestination { Id: string; Prefixes: string[] }

/** DataDB destinations; no IDs lists every one. */
export function getDestinations(baseUrl: string, ids: string[] = []) {
  return jsonRpc<LiveDestination[]>(baseUrl, 'APIerSv2.GetDestinations', [{ DestinationIDs: ids }]);
}

export function getDestination(baseUrl: string, id: string) {
  return jsonRpc<LiveDestination>(baseUrl, 'APIerSv1.GetDestination', [id]);
}

export function setDestination(baseUrl: string, id: string, prefixes: string[], overwrite: boolean) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetDestination', [{ Id: id, Prefixes: prefixes, Overwrite: overwrite }]);
}

export function removeDestination(baseUrl: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveDestination', [{ DestinationIDs: [id] }]);
}

/** Destination IDs holding this exact prefix. */
export function getReverseDestination(baseUrl: string, prefix: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetReverseDestination', [prefix]);
}

// --- Destination Rates (TP) ---

export function getTPDestinationRateIds(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'ApierV1.GetTPDestinationRateIds', [tpIdsParams(tpid, search)]);
}

export function getTPDestinationRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPDestinationRate', [{ TPid: tpid, ID: id }]);
}

export function setTPDestinationRate(baseUrl: string, params: { TPid: string; ID: string; DestinationRates: unknown[] }) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetTPDestinationRate', [params]);
}

export function removeTPDestinationRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPDestinationRate', [{ TPid: tpid, ID: id }]);
}

// --- Rating Plans (TP) ---

export function getTPRatingPlanIds(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'ApierV1.GetTPRatingPlanIds', [tpIdsParams(tpid, search)]);
}

export function getTPRatingPlan(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPRatingPlan', [{ TPid: tpid, ID: id }]);
}

export function setTPRatingPlan(baseUrl: string, params: { TPid: string; ID: string; RatingPlanBindings: unknown[] }) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetTPRatingPlan', [params]);
}

export function removeTPRatingPlan(baseUrl: string, tpid: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPRatingPlan', [{ TPid: tpid, ID: id }]);
}

// --- Rating Plans (live DataDB) ---

/** Rating plans loaded into DataDB; NOT_FOUND when there are none. */
export function getRatingPlanIDs(baseUrl: string, search?: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetRatingPlanIDs', [search ? { Search: search } : {}]);
}

export function getRatingPlan(baseUrl: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetRatingPlan', [id]);
}

// --- Rating Profiles ---

/** DataDB rating profile IDs as "category:subject"; NOT_FOUND when the tenant has none. */
export function getRatingProfileIDs(baseUrl: string, tenant: string, search?: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetRatingProfileIDs', [search ? { Tenant: tenant, Search: search } : { Tenant: tenant }]);
}

export function getRatingProfile(baseUrl: string, tenant: string, category: string, subject: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetRatingProfile', [{ Tenant: tenant, Category: category, Subject: subject }]);
}

export function setRatingProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetRatingProfile', [params]);
}

export function removeRatingProfile(baseUrl: string, tenant: string, category: string, subject: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveRatingProfile', [{ Tenant: tenant, Category: category, Subject: subject, APIOpts: apiOpts }]);
}

// --- Rating Profiles (TP) ---

/** IDs are "loadid:tenant:category:subject". */
export function getTPRatingProfileIds(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'APIerSv1.GetTPRatingProfileIds', [tpIdsParams(tpid, search)]);
}

export function getTPRatingProfile(baseUrl: string, tpid: string, ratingProfileId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetTPRatingProfile', [{ TPid: tpid, RatingProfileID: ratingProfileId }]);
}

export function setTPRatingProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetTPRatingProfile', [params]);
}

export function removeTPRatingProfile(baseUrl: string, tpid: string, ratingProfileId: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPRatingProfile', [{ TPid: tpid, RatingProfileID: ratingProfileId }]);
}

// --- Timings (TP) ---

export function getTPTimingIds(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'ApierV1.GetTPTimingIds', [tpIdsParams(tpid, search)]);
}

/** StorDB timing: Years/Months/MonthDays/WeekDays ";"-joined, Time "start;end". */
export function getTPTiming(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetTPTiming', [{ TPid: tpid, ID: id }]);
}

export function setTPTiming(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetTPTiming', [params]);
}

export function removeTPTiming(baseUrl: string, tpid: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPTiming', [{ TPid: tpid, ID: id }]);
}

/** Live DataDB timing (no TPid): arrays plus StartTime/EndTime. */
export function getTiming(baseUrl: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetTiming', [{ ID: id }]);
}

/** Checks the timing loaded in DataDB, not the StorDB tariff plan copy. */
export function timingIsActiveAt(baseUrl: string, timingId: string, time: string) {
  return jsonRpc<boolean>(baseUrl, 'APIerSv1.TimingIsActiveAt', [{ TimingID: timingId, Time: time }]);
}

// --- Actions ---

export function getActions(baseUrl: string, tenant: string) {
  return jsonRpc<Record<string, unknown[]>>(baseUrl, 'APIerSv2.GetActions', [{ Tenant: tenant }]);
}

export function setActions(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv2.SetActions', [params]);
}

export function removeActions(baseUrl: string, actionIds: string[], tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActions', [{ ActionIDs: actionIds, Tenant: tenant }]);
}

// --- Action Plans ---

export function getActionPlanIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetActionPlanIDs', [{ Tenant: tenant }]);
}

export function getActionPlan(baseUrl: string, id: string) {
  return jsonRpc<ActionPlan[]>(baseUrl, 'APIerSv1.GetActionPlan', [{ ID: id }]);
}

export function setActionPlan(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetActionPlan', [params]);
}

/** Like SetActionPlan, but stores AccountIDs on the plan; it does not queue *asap tasks. */
export function setActionPlanAccounts(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetActionPlanAccounts', [params]);
}

/** Rebuilds the account -> action plan index from every plan's AccountIDs. */
export function computeAccountActionPlans(baseUrl: string, tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.ComputeAccountActionPlans', [{ Tenant: tenant }]);
}

export function removeAccountFromActionPlan(baseUrl: string, tenant: string, account: string, actionPlanId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActionTiming', [{
    ActionPlanId: actionPlanId, Tenant: tenant, Account: account, ReloadScheduler: true,
  }]);
}

export function removeActionPlan(baseUrl: string, id: string, tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActionPlan', [{ Id: id, Tenant: tenant }]);
}

export function getAccountActionPlan(baseUrl: string, tenant: string, account: string) {
  return jsonRpc(baseUrl, 'ApierV2.GetAccountActionPlan', [{ Account: account, Tenant: tenant }]);
}

// --- Action Triggers ---

export function getActionTriggers(baseUrl: string) {
  return jsonRpc<ActionTriggerEntry[]>(baseUrl, 'APIerSv1.GetActionTriggers', [{}]);
}

export function setActionTrigger(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetActionTrigger', [params]);
}

/** Without uniqueId the whole group is removed. */
export function removeActionTrigger(baseUrl: string, groupId: string, uniqueId = '') {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActionTrigger', [{ GroupID: groupId, UniqueID: uniqueId }]);
}

// --- Upcoming (Scheduled) Action Plans ---

export function getScheduledActions(baseUrl: string, offset = 0, limit = 50) {
  return jsonRpc(baseUrl, 'ApierV1.GetScheduledActions', [{ Offset: offset, Limit: limit }]);
}

// --- Chargers ---

export function getChargerProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetChargerProfileIDs', [{ Tenant: tenant, Limit: null, Offset: null }]);
}

export function getChargerProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetChargerProfile', [{ Tenant: tenant, ID: id }]);
}

export function setChargerProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetChargerProfile', [params]);
}

export function removeChargerProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveChargerProfile', [{ Tenant: tenant, ID: id, APIOpts: apiOpts }]);
}

export function chargerSEvent(baseUrl: string, method: 'ChargerSv1.GetChargersForEvent' | 'ChargerSv1.ProcessEvent', args: CGREventArgs) {
  return jsonRpc(baseUrl, method, [args]);
}

// --- Attributes ---

export function getAttributeProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetAttributeProfileIDs', [{ Tenant: tenant }]);
}

export function getAttributeProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetAttributeProfile', [{ Tenant: tenant, Id: id }]);
}

export function setAttributeProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetAttributeProfile', [params]);
}

export function removeAttributeProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveAttributeProfile', [{ Tenant: tenant, ID: id, APIOpts: apiOpts }]);
}

export function getAttributeProfileCount(baseUrl: string, tenant: string) {
  return jsonRpc<number>(baseUrl, 'APIerSv1.GetAttributeProfileCount', [{ Tenant: tenant }]);
}

export function attributeSEvent(baseUrl: string, method: 'AttributeSv1.ProcessEvent' | 'AttributeSv1.GetAttributeForEvent', args: CGREventArgs) {
  return jsonRpc(baseUrl, method, [args]);
}

// --- Filters ---

export function getFilterIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetFilterIDs', [{ Tenant: tenant }]);
}

export function getFilter(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetFilter', [{ Tenant: tenant, Id: id }]);
}

export function setFilter(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'ApierV1.SetFilter', [params]);
}

export function removeFilter(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveFilter', [{ ID: id, Tenant: tenant, APIOpts: apiOpts }]);
}

/** ItemType is *attributes/*chargers/*resources/*stats/*thresholds/*routes/*dispatchers; *attributes and *dispatchers need Context. */
export function getFilterIndexes(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetFilterIndexes', [params]);
}

/** Rebuilds the indexes of every profile of the flagged subsystems (AttributeS, ChargerS, ... booleans). */
export function computeFilterIndexes(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.ComputeFilterIndexes', [params]);
}

/** Rebuilds indexes only for the listed profile IDs (AttributeIDs, ChargerIDs, ...). */
export function computeFilterIndexIDs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.ComputeFilterIndexIDs', [params]);
}

export function removeFilterIndexes(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveFilterIndexes', [params]);
}

// --- Resources ---

export function getResourceProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetResourceProfileIDs', [{ Tenant: tenant, Limit: null, Offset: null }]);
}

export function getResourceProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetResourceProfile', [{ Tenant: tenant, ID: id }]);
}

export function getResource(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'ResourceSv1.GetResource', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function setResourceProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'ApierV1.SetResourceProfile', [params]);
}

export function removeResourceProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveResourceProfile', [{ ID: id, Tenant: tenant, APIOpts: apiOpts }]);
}

export function getResourceWithConfig(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'ResourceSv1.GetResourceWithConfig', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function resourceSEvent(
  baseUrl: string,
  method: 'ResourceSv1.GetResourcesForEvent' | 'ResourceSv1.AuthorizeResources' | 'ResourceSv1.AllocateResources' | 'ResourceSv1.ReleaseResources',
  args: CGREventArgs,
) {
  return jsonRpc(baseUrl, method, [args]);
}

// --- Stats ---

export function getStatQueueProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetStatQueueProfileIDs', [{ Tenant: tenant, Limit: null, Offset: null }]);
}

export function getStatQueueProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetStatQueueProfile', [{ Tenant: tenant, ID: id }]);
}

export function setStatQueueProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetStatQueueProfile', [params]);
}

export function removeStatQueueProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveStatQueueProfile', [{ Tenant: tenant, ID: id, APIOpts: apiOpts }]);
}

export function getQueueStringMetrics(baseUrl: string, tenant: string, id: string) {
  return jsonRpc<Record<string, string>>(baseUrl, 'StatSv1.GetQueueStringMetrics', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function resetStatQueue(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'StatSv1.ResetStatQueue', [{ Tenant: tenant, ID: id }]);
}

export function getQueueFloatMetrics(baseUrl: string, tenant: string, id: string) {
  return jsonRpc<Record<string, number>>(baseUrl, 'StatSv1.GetQueueFloatMetrics', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function getStatQueue(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'StatSv1.GetStatQueue', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function statSEvent(baseUrl: string, method: 'StatSv1.ProcessEvent' | 'StatSv1.GetStatQueuesForEvent', args: CGREventArgs) {
  return jsonRpc<string[]>(baseUrl, method, [args]);
}

// --- Thresholds ---

export function getThresholdProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetThresholdProfileIDs', [{ Tenant: tenant }]);
}

export function getThresholdProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetThresholdProfile', [{ Tenant: tenant, ID: id }]);
}

export function setThresholdProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetThresholdProfile', [params]);
}

export function removeThresholdProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveThresholdProfile', [{ Tenant: tenant, ID: id, APIOpts: apiOpts }]);
}

/** Runtime state (Hits, Snooze) of a threshold. */
export function getThreshold(baseUrl: string, tenant: string, id: string) {
  return jsonRpc<{ Tenant: string; ID: string; Hits: number; Snooze: string }>(
    baseUrl, 'ThresholdSv1.GetThreshold', [{ Tenant: tenant, ID: id, APIOpts: {} }],
  );
}

export function resetThreshold(baseUrl: string, tenant: string, id: string) {
  return jsonRpc<string>(baseUrl, 'ThresholdSv1.ResetThreshold', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

/** Exporter IDs from the ees config section, for threshold EeIDs. */
export async function getEEsExporterIDs(baseUrl: string) {
  const cfg = await jsonRpc<{ ees: { exporters: { id: string }[] } }>(baseUrl, 'ConfigSv1.GetConfig', [{ Section: 'ees' }]);
  return cfg.ees.exporters.map(e => e.id);
}

export function thresholdSEvent(baseUrl: string, method: 'ThresholdSv1.GetThresholdsForEvent' | 'ThresholdSv1.ProcessEvent', args: CGREventArgs) {
  return jsonRpc(baseUrl, method, [args]);
}

// --- Routes ---

export function getRoutes(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'RouteSv1.GetRoutes', [params]);
}

export function getRouteProfileIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetRouteProfileIDs', [{ Tenant: tenant, Limit: null, Offset: null }]);
}

export function getRouteProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetRouteProfile', [{ Tenant: tenant, ID: id }]);
}

export function setRouteProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetRouteProfile', [params]);
}

export function removeRouteProfile(baseUrl: string, tenant: string, id: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveRouteProfile', [{ Tenant: tenant, ID: id, APIOpts: apiOpts }]);
}

export function getRouteProfilesForEvent(baseUrl: string, args: CGREventArgs) {
  return jsonRpc(baseUrl, 'RouteSv1.GetRouteProfilesForEvent', [args]);
}

export function getAccountIDs(baseUrl: string, tenant: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetAccountIDs', [{ Tenant: tenant }]);
}

// --- Sessions ---

/** utils.SessionFilter; Filters are filter IDs or inline filters, Limit null means no limit. */
function sessionFilter(tenant: string, filters: string[], limit: number | null) {
  return { Tenant: tenant, Filters: filters, Limit: limit, APIOpts: {} };
}

export function getActiveSessions(baseUrl: string, tenant: string, filters: string[] = [], limit: number | null = null) {
  return jsonRpc(baseUrl, 'SessionSv1.GetActiveSessions', [sessionFilter(tenant, filters, limit)]);
}

export function terminateSession(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'SessionSv1.TerminateSession', [params]);
}

/** SessionSv1.ProcessCDR takes a plain CGREvent and always rates it (*rals). */
export function processCDR(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'SessionSv1.ProcessCDR', [params]);
}

/** Any SessionSv1 method taking a single argument object (event tester). */
export function sessionCall(baseUrl: string, method: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, `SessionSv1.${method}`, [params]);
}

export function getPassiveSessions(baseUrl: string, tenant: string, filters: string[] = [], limit: number | null = null) {
  return jsonRpc(baseUrl, 'SessionSv1.GetPassiveSessions', [sessionFilter(tenant, filters, limit)]);
}

export function getActiveSessionsCount(baseUrl: string, tenant: string, filters: string[] = []) {
  return jsonRpc<number>(baseUrl, 'SessionSv1.GetActiveSessionsCount', [sessionFilter(tenant, filters, null)]);
}

export function getPassiveSessionsCount(baseUrl: string, tenant: string, filters: string[] = []) {
  return jsonRpc<number>(baseUrl, 'SessionSv1.GetPassiveSessionsCount', [sessionFilter(tenant, filters, null)]);
}

export function forceDisconnect(baseUrl: string, tenant: string, filters: string[]) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.ForceDisconnect', [{ ...sessionFilter(tenant, filters, null), Event: {} }]);
}

/** Empty ids means every passive (activate) or active (deactivate) session. */
export function activateSessions(baseUrl: string, tenant: string, ids: string[]) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.ActivateSessions', [{ IDs: ids, Tenant: tenant, APIOpts: {} }]);
}

export function deactivateSessions(baseUrl: string, tenant: string, ids: string[]) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.DeactivateSessions', [{ IDs: ids, Tenant: tenant, APIOpts: {} }]);
}

export function syncSessions(baseUrl: string, tenant: string) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.SyncSessions', [{ Tenant: tenant, APIOpts: {} }]);
}

/** Replies with the number of sessions stored. */
export function backupActiveSessions(baseUrl: string) {
  return jsonRpc<number>(baseUrl, 'SessionSv1.BackupActiveSessions', ['']);
}

export function disconnectPeer(baseUrl: string, params: { OriginHost: string; OriginRealm: string; RemoteAddr: string; DisconnectCause: number }) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.DisconnectPeer', [params]);
}

export function stirAuthenticate(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.STIRAuthenticate', [params]);
}

export function stirIdentity(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'SessionSv1.STIRIdentity', [params]);
}

// --- Config ---

export function getConfigAsJSON(baseUrl: string) {
  return jsonRpc<string>(baseUrl, 'ConfigSv1.GetConfigAsJSON', [{}]);
}

/** Section "*all" (or empty) returns every section. */
export function getConfig(baseUrl: string, tenant: string, section: string) {
  return jsonRpc<Record<string, unknown>>(baseUrl, 'ConfigSv1.GetConfig', [{ Tenant: tenant, Section: section, APIOpts: {} }]);
}

export function setConfig(baseUrl: string, tenant: string, config: Record<string, unknown>, dryRun: boolean) {
  return jsonRpc<string>(baseUrl, 'ConfigSv1.SetConfig', [{ Tenant: tenant, Config: config, DryRun: dryRun, APIOpts: {} }]);
}

export function setConfigFromJSON(baseUrl: string, tenant: string, config: string, dryRun: boolean) {
  return jsonRpc<string>(baseUrl, 'ConfigSv1.SetConfigFromJSON', [{ Tenant: tenant, Config: config, DryRun: dryRun, APIOpts: {} }]);
}

/** Re-reads the config from Path on the server; empty Section reloads every section. */
export function reloadConfig(baseUrl: string, tenant: string, path: string, section: string, dryRun: boolean) {
  return jsonRpc<string>(baseUrl, 'ConfigSv1.ReloadConfig', [{ Tenant: tenant, Path: path, Section: section, DryRun: dryRun, APIOpts: {} }]);
}

// --- Cache ---

export interface CacheStats {
  Items: number;
  Groups: number;
}

/** Empty cacheIds means every partition. */
export function getCacheStats(baseUrl: string, tenant: string, cacheIds: string[] = []) {
  return jsonRpc<Record<string, CacheStats>>(baseUrl, 'CacheSv1.GetCacheStats', [{ Tenant: tenant, CacheIDs: cacheIds, APIOpts: {} }]);
}

export function precacheStatus(baseUrl: string, tenant: string, cacheIds: string[] = []) {
  return jsonRpc<Record<string, string>>(baseUrl, 'CacheSv1.PrecacheStatus', [{ Tenant: tenant, CacheIDs: cacheIds, APIOpts: {} }]);
}

export function getCacheItemIDs(baseUrl: string, tenant: string, cacheId: string, prefix: string) {
  return jsonRpc<string[]>(baseUrl, 'CacheSv1.GetItemIDs', [{ Tenant: tenant, CacheID: cacheId, ItemIDPrefix: prefix, APIOpts: {} }]);
}

function cacheItemArgs(tenant: string, cacheId: string, itemId: string) {
  return { Tenant: tenant, CacheID: cacheId, ItemID: itemId, APIOpts: {} };
}

export function hasCacheItem(baseUrl: string, tenant: string, cacheId: string, itemId: string) {
  return jsonRpc<boolean>(baseUrl, 'CacheSv1.HasItem', [cacheItemArgs(tenant, cacheId, itemId)]);
}

export function getCacheItem(baseUrl: string, tenant: string, cacheId: string, itemId: string) {
  return jsonRpc(baseUrl, 'CacheSv1.GetItem', [cacheItemArgs(tenant, cacheId, itemId)]);
}

export function getCacheItemExpiryTime(baseUrl: string, tenant: string, cacheId: string, itemId: string) {
  return jsonRpc<string>(baseUrl, 'CacheSv1.GetItemExpiryTime', [cacheItemArgs(tenant, cacheId, itemId)]);
}

/** args are utils.AttrReloadCacheWithAPIOpts ID lists, e.g. { AttributeProfileIDs: ['cgrates.org:ATTR_1'] }. */
export function removeCacheItems(baseUrl: string, tenant: string, args: Record<string, string[]>) {
  return jsonRpc<string>(baseUrl, 'CacheSv1.RemoveItems', [{ Tenant: tenant, APIOpts: {}, ...args }]);
}

export function reloadCache(baseUrl: string, tenant: string, args: Record<string, string[]>) {
  return jsonRpc<string>(baseUrl, 'CacheSv1.ReloadCache', [{ Tenant: tenant, APIOpts: {}, ...args }]);
}

export function loadCache(baseUrl: string, tenant: string, args: Record<string, string[]>) {
  return jsonRpc<string>(baseUrl, 'CacheSv1.LoadCache', [{ Tenant: tenant, APIOpts: {}, ...args }]);
}

/** Empty cacheIds clears every partition. */
export function clearCache(baseUrl: string, tenant: string, cacheIds: string[]) {
  return jsonRpc<string>(baseUrl, 'CacheSv1.Clear', [{ Tenant: tenant, CacheIDs: cacheIds, APIOpts: {} }]);
}

// --- Core ---

export function coreStatus(baseUrl: string, tenant: string, debug: boolean, timezone: string) {
  return jsonRpc<Record<string, unknown>>(baseUrl, 'CoreSv1.Status', [{ Tenant: tenant, Debug: debug, Timezone: timezone, APIOpts: {} }]);
}

/** Durations are nanoseconds (Go time.Duration). */
export function coreSleep(baseUrl: string, tenant: string, durationNs: number) {
  return jsonRpc<string>(baseUrl, 'CoreSv1.Sleep', [{ Tenant: tenant, Duration: durationNs, APIOpts: {} }]);
}

export function startCPUProfiling(baseUrl: string, tenant: string, dirPath: string) {
  return jsonRpc<string>(baseUrl, 'CoreSv1.StartCPUProfiling', [{ Tenant: tenant, DirPath: dirPath, APIOpts: {} }]);
}

export function stopCPUProfiling(baseUrl: string, tenant: string) {
  return jsonRpc<string>(baseUrl, 'CoreSv1.StopCPUProfiling', [{ Tenant: tenant, APIOpts: {} }]);
}

export function startMemoryProfiling(baseUrl: string, params: { Tenant: string; DirPath: string; Interval: number; MaxFiles: number; UseTimestamp: boolean }) {
  return jsonRpc<string>(baseUrl, 'CoreSv1.StartMemoryProfiling', [params]);
}

export function stopMemoryProfiling(baseUrl: string, tenant: string) {
  return jsonRpc<string>(baseUrl, 'CoreSv1.StopMemoryProfiling', [{ Tenant: tenant, APIOpts: {} }]);
}

/** ServiceManagerV1 only manages *scheduler; replies RUNNING/STOPPED or OK. */
export function serviceManager(baseUrl: string, action: 'ServiceStatus' | 'StartService' | 'StopService', tenant: string, serviceId: string) {
  return jsonRpc<string>(baseUrl, `ServiceManagerV1.${action}`, [{ Tenant: tenant, ServiceID: serviceId, APIOpts: {} }]);
}

/** Replies with the lock reference ID. */
export function remoteLock(baseUrl: string, tenant: string, referenceId: string, lockIds: string[], timeoutNs: number) {
  return jsonRpc<string>(baseUrl, 'GuardianSv1.RemoteLock', [{
    Tenant: tenant, ReferenceID: referenceId, LockIDs: lockIds, Timeout: timeoutNs, APIOpts: {},
  }]);
}

/** Replies with the IDs that were unlocked. */
export function remoteUnlock(baseUrl: string, tenant: string, refId: string) {
  return jsonRpc<string[]>(baseUrl, 'GuardianSv1.RemoteUnlock', [{ Tenant: tenant, RefID: refId, APIOpts: {} }]);
}

// --- GetCost ---

export function getCost(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.GetCost', [params]);
}

/** Usage is a number (bytes) and options go in Opts, not APIOpts (AttrGetDataCost). */
export function getDataCost(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.GetDataCost', [params]);
}

/** Replies in nanoseconds for *voice, units otherwise; -1 means unlimited. */
export function getMaxUsage(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<number>(baseUrl, 'APIerSv1.GetMaxUsage', [params]);
}

// --- Analyzer ---

export function analyzerStringQuery(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'AnalyzerSv1.StringQuery', [params]);
}

// --- Event Reader ---

/** ID identifies the request (RPC caching), ReaderID names the configured reader. */
export function runReader(baseUrl: string, tenant: string, readerId: string, apiOpts: Record<string, unknown> = {}) {
  return jsonRpc<string>(baseUrl, 'ErSv1.RunReader', [{
    Tenant: tenant, ID: crypto.randomUUID(), ReaderID: readerId, APIOpts: apiOpts,
  }]);
}

// --- Event Exporter ---

/** EeIDs limits which exporters receive the event; empty sends it to every exporter whose filters match. */
export function eeProcessEvent(baseUrl: string, params: { EeIDs: string[]; Tenant: string; ID: string; Event: Record<string, unknown>; APIOpts: Record<string, unknown> }) {
  return jsonRpc(baseUrl, 'EeSv1.ProcessEvent', [params]);
}

export function resetExporterMetrics(baseUrl: string, tenant: string, exporterId: string) {
  return jsonRpc<string>(baseUrl, 'EeSv1.ResetExporterMetrics', [{
    Tenant: tenant, ID: crypto.randomUUID(), ExporterID: exporterId, APIOpts: {},
  }]);
}

/** Re-post failed export requests found on disk. Empty SourcePath defaults to the EEs FailedPosts.Dir. */
export function replayFailedPosts(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.ReplayFailedPosts', [params]);
}

// --- Tariff Plans ---

export function removeTP(baseUrl: string, tpid: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemTP', [{ TPid: tpid }]);
}

/** AttrLoadTpFromStorDb: TPid, DryRun, Validate, Caching (top-level, not APIOpts), APIOpts. */
export function loadTariffPlanFromStorDb(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.LoadTariffPlanFromStorDb', [params]);
}

/** AttrLoadTpFromFolder: FolderPath, DryRun, Validate, Caching, APIOpts. */
export function loadTariffPlanFromFolder(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.LoadTariffPlanFromFolder', [params]);
}

/** CSV folder on the CGrateS host into StorDB under TPid (AttrImportTPFromFolder). */
export function importTariffPlanFromFolder(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.ImportTariffPlanFromFolder', [params]);
}

export interface ExportedTPStats { ExportPath: string; ExportedFiles: string[]; Compressed: boolean }

/** AttrDirExportTP: TPid, ExportPath, FileFormat, FieldSeparator, Compress; omitted ones use the server config. */
export function exportTPToFolder(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<ExportedTPStats>(baseUrl, 'APIerSv1.ExportTPToFolder', [params]);
}

/** Base64 of a zip holding the TP CSVs. */
export function exportTPToZipString(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.ExportTPToZipString', [params]);
}

// --- TP Rates ---

export function getTPRateIds(baseUrl: string, tpid: string, search?: string) {
  return jsonRpc<string[] | null>(baseUrl, 'ApierV1.GetTPRateIds', [tpIdsParams(tpid, search)]);
}

export function getTPRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPRate', [{ TPid: tpid, ID: id }]);
}

export function setTPRate(baseUrl: string, params: { TPid: string; ID: string; RateSlots: unknown[] }) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.SetTPRate', [params]);
}

export function removeTPRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc<string>(baseUrl, 'APIerSv1.RemoveTPRate', [{ TPid: tpid, ID: id }]);
}

// --- Generic JSON-RPC (Execute JSON page) ---

export function executeJsonRpc(baseUrl: string, payload: Record<string, unknown>) {
  return fetch(`${baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json());
}

// --- Account Action Triggers (on-account operations) ---

export function removeAccountActionTriggers(baseUrl: string, tenant: string, account: string, groupId: string, uniqueId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveAccountActionTriggers', [{
    Tenant: tenant, Account: account, GroupID: groupId, UniqueID: uniqueId,
  }]);
}

/** Updates the trigger matching GroupID/UniqueID on the account, or adds it; CGrateS then re-evaluates the account's triggers. */
export function setAccountActionTriggers(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetAccountActionTriggers', [params]);
}

export function resetAccountActionTriggers(baseUrl: string, tenant: string, account: string, uniqueId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.ResetAccountActionTriggers', [{
    Tenant: tenant, Account: account, UniqueID: uniqueId, Executed: false,
  }]);
}

