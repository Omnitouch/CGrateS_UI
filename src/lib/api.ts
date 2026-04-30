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

export function exportCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.ExportCDRs', [params]);
}

export function removeCDRs(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveCDRs', [params]);
}

// --- Destinations (TP) ---

export function getTPIds(baseUrl: string) {
  return jsonRpc<string[]>(baseUrl, 'APIerSv1.GetTPIds', []);
}

export function getTPDestinationIDs(baseUrl: string, tpid: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetTPDestinationIDs', [{ TPid: tpid }]);
}

export function getTPDestination(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPDestination', [{ TPid: tpid, ID: id }]);
}

// --- Destination Rates (TP) ---

export function getTPDestinationRateIds(baseUrl: string, tpid: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetTPDestinationRateIds', [{ TPid: tpid }]);
}

export function getTPDestinationRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPDestinationRate', [{ TPid: tpid, ID: id }]);
}

// --- Rating Plans (TP) ---

export function getTPRatingPlanIds(baseUrl: string, tpid: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetTPRatingPlanIds', [{ TPid: tpid }]);
}

export function getTPRatingPlan(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPRatingPlan', [{ TPid: tpid, ID: id }]);
}

// --- Rating Profiles ---

export function getRatingProfileIDs(baseUrl: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetRatingProfileIDs', []);
}

export function getRatingProfile(baseUrl: string, category: string, subject: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetRatingProfile', [{ Category: category, Subject: subject }]);
}

export function setRatingProfile(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.SetRatingProfile', [params]);
}

export function removeRatingProfile(baseUrl: string, category: string, subject: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemoveRatingProfile', [{ Category: category, Subject: subject }]);
}

// --- Timings (TP) ---

export function getTPTimingIds(baseUrl: string, tpid: string) {
  return jsonRpc<string[]>(baseUrl, 'ApierV1.GetTPTimingIds', [{ TPid: tpid }]);
}

export function getTiming(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTiming', [{ TPid: tpid, ID: id }]);
}

export function setTPTiming(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'ApierV2.SetTPTiming', [params]);
}

export function timingIsActiveAt(baseUrl: string, timingId: string, time: string) {
  return jsonRpc<boolean>(baseUrl, 'APIerSv1.TimingIsActiveAt', [{ TimingID: timingId, Time: time }]);
}

// --- Actions ---

export function getActions(baseUrl: string, tenant: string) {
  return jsonRpc<Record<string, unknown[]>>(baseUrl, 'APIerSv2.GetActions', [{ Tenant: tenant }]);
}

export function setActions(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'ApierV1.SetActions', [params]);
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

// --- GetCost ---

export function getCost(baseUrl: string, params: Record<string, unknown>) {
  return jsonRpc(baseUrl, 'APIerSv1.GetCost', [params]);
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

// --- Tariff Plans ---

export function removeTP(baseUrl: string, tpid: string) {
  return jsonRpc(baseUrl, 'APIerSv1.RemTP', [{ TPid: tpid }]);
}

export function loadTariffPlanFromStorDb(baseUrl: string, tpid: string) {
  return jsonRpc(baseUrl, 'APIerSv1.LoadTariffPlanFromStorDb', [{ TPid: tpid }]);
}

export function exportTPToFolder(baseUrl: string, tpid: string, folderPath = '/tmp') {
  return jsonRpc(baseUrl, 'APIerSv1.ExportTPToFolder', [{ TPid: tpid, FolderPath: folderPath }]);
}

// --- TP Rates ---

export function getTPRate(baseUrl: string, tpid: string, id: string) {
  return jsonRpc(baseUrl, 'ApierV1.GetTPRate', [{ TPid: tpid, ID: id }]);
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
