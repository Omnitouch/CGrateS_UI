import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOcsBaseUrl } from './OcsContext';
import * as api from './api';

function useBaseUrl() {
  return useOcsBaseUrl();
}

// --- Accounts ---

export function useAccounts(tenant: string, offset = 0, limit = 50) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'accounts', baseUrl, tenant, offset, limit],
    queryFn: () => api.getAccounts(baseUrl!, tenant, offset, limit),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useRemoveAccount() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, account }: { tenant: string; account: string }) =>
      api.removeAccount(baseUrl!, tenant, account),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'accounts'] }); },
  });
}

export function useExecuteAction() {
  const baseUrl = useBaseUrl();
  return useMutation({
    mutationFn: ({ tenant, account, actionsId }: { tenant: string; account: string; actionsId: string }) =>
      api.executeAction(baseUrl!, tenant, account, actionsId),
  });
}

// --- CDRs ---

export function useCDRs(params: Record<string, unknown> | null) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'cdrs', baseUrl, params],
    queryFn: () => api.getCDRs(baseUrl!, params!),
    enabled: !!baseUrl && !!params,
  });
}

// --- TP IDs ---

export function useTPIds() {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'tpids', baseUrl],
    queryFn: () => api.getTPIds(baseUrl!),
    enabled: !!baseUrl,
  });
}

// --- Destinations ---

export function useTPDestinationIDs(tpid: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'tp-destination-ids', baseUrl, tpid],
    queryFn: () => api.getTPDestinationIDs(baseUrl!, tpid),
    enabled: !!baseUrl && !!tpid,
  });
}

// --- Destination Rates ---

export function useTPDestinationRateIds(tpid: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'tp-destination-rate-ids', baseUrl, tpid],
    queryFn: () => api.getTPDestinationRateIds(baseUrl!, tpid),
    enabled: !!baseUrl && !!tpid,
  });
}

// --- Rating Plans ---

export function useTPRatingPlanIds(tpid: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'tp-rating-plan-ids', baseUrl, tpid],
    queryFn: () => api.getTPRatingPlanIds(baseUrl!, tpid),
    enabled: !!baseUrl && !!tpid,
  });
}

// --- Rating Profiles ---

export function useRatingProfileIDs() {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'rating-profile-ids', baseUrl],
    queryFn: () => api.getRatingProfileIDs(baseUrl!),
    enabled: !!baseUrl,
  });
}

// --- Timings ---

export function useTPTimingIds(tpid: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'tp-timing-ids', baseUrl, tpid],
    queryFn: () => api.getTPTimingIds(baseUrl!, tpid),
    enabled: !!baseUrl && !!tpid,
  });
}

// --- Actions ---

export function useActions(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'actions', baseUrl, tenant],
    queryFn: () => api.getActions(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteAction() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ actionIds, tenant }: { actionIds: string[]; tenant: string }) =>
      api.removeActions(baseUrl!, actionIds, tenant),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'actions'] }); },
  });
}

// --- Action Plans ---

export function useActionPlanIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'action-plan-ids', baseUrl, tenant],
    queryFn: () => api.getActionPlanIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteActionPlan() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tenant }: { id: string; tenant: string }) =>
      api.removeActionPlan(baseUrl!, id, tenant),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'action-plan-ids'] }); },
  });
}

// --- Action Triggers ---

export function useActionTriggers(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'action-triggers', baseUrl, tenant],
    queryFn: () => api.getActionTriggers(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

// --- Scheduled Actions ---

export function useScheduledActions(offset = 0, limit = 50) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'scheduled-actions', baseUrl, offset, limit],
    queryFn: () => api.getScheduledActions(baseUrl!, offset, limit),
    enabled: !!baseUrl,
  });
}

// --- Chargers ---

export function useChargerProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'charger-profile-ids', baseUrl, tenant],
    queryFn: () => api.getChargerProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteChargerProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeChargerProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'charger-profile-ids'] }); },
  });
}

// --- Attributes ---

export function useAttributeProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'attribute-profile-ids', baseUrl, tenant],
    queryFn: () => api.getAttributeProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteAttributeProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeAttributeProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'attribute-profile-ids'] }); },
  });
}

// --- Filters ---

export function useFilterIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'filter-ids', baseUrl, tenant],
    queryFn: () => api.getFilterIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteFilter() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeFilter(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'filter-ids'] }); },
  });
}

// --- Resources ---

export function useResourceProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'resource-profile-ids', baseUrl, tenant],
    queryFn: () => api.getResourceProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteResourceProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeResourceProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'resource-profile-ids'] }); },
  });
}

// --- Stats ---

export function useStatQueueProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'stat-queue-profile-ids', baseUrl, tenant],
    queryFn: () => api.getStatQueueProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteStatQueueProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeStatQueueProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'stat-queue-profile-ids'] }); },
  });
}

// --- Thresholds ---

export function useThresholdProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'threshold-profile-ids', baseUrl, tenant],
    queryFn: () => api.getThresholdProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteThresholdProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeThresholdProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'threshold-profile-ids'] }); },
  });
}

// --- Route Profiles ---

export function useRouteProfileIDs(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'route-profile-ids', baseUrl, tenant],
    queryFn: () => api.getRouteProfileIDs(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

export function useDeleteRouteProfile() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenant, id }: { tenant: string; id: string }) =>
      api.removeRouteProfile(baseUrl!, tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'route-profile-ids'] }); },
  });
}

// --- Sessions ---

export function useActiveSessions(tenant: string) {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'active-sessions', baseUrl, tenant],
    queryFn: () => api.getActiveSessions(baseUrl!, tenant),
    enabled: !!baseUrl && !!tenant,
  });
}

// --- Config ---

export function useConfig() {
  const baseUrl = useBaseUrl();
  return useQuery({
    queryKey: ['ocs', 'config', baseUrl],
    queryFn: async () => {
      const result = await api.getConfigAsJSON(baseUrl!);
      return typeof result === 'string' ? JSON.parse(result) : result;
    },
    enabled: !!baseUrl,
  });
}

// --- Tariff Plans ---

export function useRemoveTP() {
  const baseUrl = useBaseUrl();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tpid: string) => api.removeTP(baseUrl!, tpid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ocs', 'tpids'] }); },
  });
}
