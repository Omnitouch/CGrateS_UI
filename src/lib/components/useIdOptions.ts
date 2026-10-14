import { useEffect, useState } from 'react';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';

export type IdSource =
  | 'filters' | 'attributes' | 'chargers' | 'resources' | 'stats' | 'thresholds' | 'routes'
  | 'actions' | 'accounts' | 'ratingPlans' | 'eeExporters';

const loaders: Record<IdSource, (baseUrl: string, tenant: string) => Promise<string[] | null>> = {
  filters: api.getFilterIDs,
  attributes: api.getAttributeProfileIDs,
  chargers: api.getChargerProfileIDs,
  resources: api.getResourceProfileIDs,
  stats: api.getStatQueueProfileIDs,
  thresholds: api.getThresholdProfileIDs,
  routes: api.getRouteProfileIDs,
  actions: (baseUrl, tenant) => api.getActions(baseUrl, tenant).then(r => Object.keys(r || {})),
  accounts: api.getAccountIDs,
  ratingPlans: baseUrl => api.getRatingPlanIDs(baseUrl),
  eeExporters: baseUrl => api.getEEsExporterIDs(baseUrl),
};

async function load(source: IdSource, baseUrl: string, tenant: string): Promise<string[]> {
  try {
    return ((await loaders[source](baseUrl, tenant)) || []).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    // The *IDs APIs answer NOT_FOUND when nothing is defined yet.
    if (e instanceof Error && e.message === 'NOT_FOUND') return [];
    throw new Error(`Loading ${source} IDs: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Known IDs for dropdowns, loaded while `enabled` (e.g. while an edit dialog is open). */
export function useIdOptions(sources: IdSource[], tenant: string, enabled: boolean) {
  const baseUrl = useOcsBaseUrl();
  const [options, setOptions] = useState<Partial<Record<IdSource, string[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const key = sources.join(',');

  useEffect(() => {
    if (!enabled || !baseUrl || !tenant) return;
    let cancelled = false;
    setError(null);
    const list = key.split(',') as IdSource[];
    Promise.allSettled(list.map(s => load(s, baseUrl, tenant))).then(results => {
      if (cancelled) return;
      const next: Partial<Record<IdSource, string[]>> = {};
      const errors: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[list[i]] = r.value;
        else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      });
      setOptions(next);
      setError(errors.length ? errors.join('; ') : null);
    });
    return () => { cancelled = true; };
  }, [key, tenant, enabled, baseUrl]);

  const get = (source: IdSource) => options[source] ?? [];
  return { get, error };
}
