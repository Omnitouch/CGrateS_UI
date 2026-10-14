import type { JsonRpcResponse } from './types';

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
    throw new Error(data.error.message || 'JSON-RPC error');
  }

  return data.result as T;
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
  return jsonRpc(baseUrl, 'ApierV2.SetAccount', [params]);
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

export function getActionPlan(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetActionPlan', [{ Tenant: tenant, Id: id }]);
}

export function setActionPlan(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'ApierV1.SetActionPlan', [params]);
}

export function removeActionPlan(baseUrl: string, id: string, tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActionPlan', [{ Id: id, Tenant: tenant }]);
}

export function getAccountActionPlan(baseUrl: string, tenant: string, account: string) {
  return jsonRpc(baseUrl, 'ApierV2.GetAccountActionPlan', [{ Account: account, Tenant: tenant }]);
}

// --- Action Triggers ---

export function getActionTriggers(baseUrl: string, tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.GetActionTriggers', [{ Tenant: tenant }]);
}

export function setActionTrigger(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetActionTrigger', [params]);
}

export function removeActionTrigger(baseUrl: string, groupId: string, tenant: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveActionTrigger', [{ GroupID: groupId, Tenant: tenant }]);
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

export function removeChargerProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveChargerProfile', [{ Tenant: tenant, ID: id }]);
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

export function removeAttributeProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveAttributeProfile', [{ Tenant: tenant, Id: id }]);
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

export function removeFilter(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveFilter', [{ ID: id, Tenant: tenant }]);
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

export function removeResourceProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveResourceProfile', [{ ID: id, Tenant: tenant }]);
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

export function removeStatQueueProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveStatQueueProfile', [{ Tenant: tenant, ID: id }]);
}

export function getQueueStringMetrics(baseUrl: string, tenant: string, id: string) {
  return jsonRpc<Record<string, string>>(baseUrl, 'StatSv1.GetQueueStringMetrics', [{ Tenant: tenant, ID: id, APIOpts: {} }]);
}

export function resetStatQueue(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'StatSv1.ResetStatQueue', [{ Tenant: tenant, ID: id }]);
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

export function removeThresholdProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveThresholdProfile', [{ Tenant: tenant, ID: id }]);
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

export function removeRouteProfile(baseUrl: string, tenant: string, id: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveRouteProfile', [{ Tenant: tenant, ID: id }]);
}

// --- Sessions ---

export function getActiveSessions(baseUrl: string, tenant: string) {
  return jsonRpc(baseUrl, 'SessionSv1.GetActiveSessions', [{
    Limit: null,
    Filters: null,
    Tenant: tenant,
    APIOpts: {},
  }]);
}

export function terminateSession(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'SessionSv1.TerminateSession', [params]);
}

// --- Config ---

export function getConfigAsJSON(baseUrl: string) {
  return jsonRpc<string>(baseUrl, 'ConfigSv1.GetConfigAsJSON', [{}]);
}

export function getConfigSection(baseUrl: string, section: string) {
  return jsonRpc<Record<string, unknown>>(baseUrl, 'ConfigSv1.GetConfig', [{ Section: section }]);
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

// --- Charge Tester ---

export function processCDR(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'SessionSv1.ProcessCDR', [params]);
}

// --- Analyzer ---

export function analyzerStringQuery(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'AnalyzerSv1.StringQuery', [params]);
}

// --- Event Reader ---

export function runReader(baseUrl: string, readerId: string) {
  return jsonRpc(baseUrl, 'ErSv1.RunReader', [{ ID: readerId, ReaderID: readerId }]);
}

// --- Event Exporter ---

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

export function removeAccountActionTriggers(baseUrl: string, tenant: string, account: string, uniqueId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveAccountActionTriggers', [{
    Tenant: tenant, Account: account, UniqueID: uniqueId,
  }]);
}

export function resetAccountActionTriggers(baseUrl: string, tenant: string, account: string, uniqueId: string) {
  return jsonRpc(baseUrl, 'APIerSv1.ResetAccountActionTriggers', [{
    Tenant: tenant, Account: account, UniqueID: uniqueId, Executed: false,
  }]);
}

export function removeAccountActionPlans(baseUrl: string, tenant: string, account: string, actionPlanIds: string[]) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveAccountActionPlans', [{
    Tenant: tenant, Account: account, ActionPlanIDs: actionPlanIds,
  }]);
}
