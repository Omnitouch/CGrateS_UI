// Context
export { OcsProvider, useOcsBaseUrl, useOcsTenants, useOcsShowEngineering } from './OcsContext';
export type { OcsContextValue, OcsProviderProps } from './OcsContext';

// API
export * as ocsApi from './api';

// Hooks
export * from './hooks';

// Types
export * from './types';

export interface OcsNavItem {
  label: string;
  path: string;
}

export type OcsNavGroupKey = 'subscribers' | 'products' | 'automation' | 'status' | 'engineering';

export interface OcsNavGroup {
  key: OcsNavGroupKey;
  label: string;
  items: OcsNavItem[];
}

/** Engine-level pages; hosts without admin roles can drop this group (see filterOcsNavGroups). */
export const OCS_ENGINEERING_GROUP: OcsNavGroupKey = 'engineering';

/** Sidebar groups for embedding; hosts should render these rather than pick pages themselves, so new pages show up. */
export const ocsNavGroups: OcsNavGroup[] = [
  {
    key: 'subscribers',
    label: 'Subscribers',
    items: [
      { label: 'Accounts', path: '' },
      { label: 'Subscriber', path: 'subscriber' },
      { label: 'Sessions', path: 'sessions' },
      { label: 'CDRs', path: 'cdrs' },
      { label: 'Exported CDRs', path: 'exported-cdrs' },
    ],
  },
  {
    key: 'products',
    label: 'Products & Rates',
    items: [
      { label: 'Rating map', path: 'rating-hierarchy' },
      { label: 'Destinations', path: 'destinations' },
      { label: 'Destination Rates', path: 'destination-rates' },
      { label: 'Rating Plans', path: 'rating-plans' },
      { label: 'Rating Profiles', path: 'rating-profiles' },
      { label: 'Timings', path: 'timings' },
      { label: 'Tariff Plans', path: 'tariff-plans' },
      { label: 'TP Explorer', path: 'tp-explorer' },
    ],
  },
  {
    key: 'automation',
    label: 'Automation',
    items: [
      { label: 'Actions', path: 'actions' },
      { label: 'Action Plans', path: 'action-plans' },
      { label: 'Action Triggers', path: 'action-triggers' },
      { label: 'Upcoming Actions', path: 'upcoming-action-plans' },
      { label: 'Thresholds', path: 'thresholds' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    items: [
      { label: 'System status', path: 'core' },
      { label: 'Cache', path: 'cache' },
    ],
  },
  {
    key: 'engineering',
    label: 'Engineering',
    items: [
      { label: 'Chargers', path: 'chargers' },
      { label: 'Attributes', path: 'attributes' },
      { label: 'Filters', path: 'filters' },
      { label: 'Resources', path: 'resources' },
      { label: 'Stats', path: 'stats' },
      { label: 'Route Lookup', path: 'routes' },
      { label: 'Route Profiles', path: 'route-profiles' },
      { label: 'Get Cost', path: 'get-cost' },
      { label: 'Event Tester', path: 'charge-tester' },
      { label: 'Analyzer', path: 'analyzer' },
      { label: 'Event Reader', path: 'event-reader' },
      { label: 'Event Exporter', path: 'event-exporter' },
      { label: 'Execute JSON', path: 'execute-json' },
      { label: 'Config', path: 'config' },
    ],
  },
];

/** Hides the Engineering group from the sidebar only; its routes stay registered, so access control is the host's job. */
export function filterOcsNavGroups(groups: OcsNavGroup[], { showEngineering = true }: { showEngineering?: boolean } = {}) {
  return showEngineering ? groups : groups.filter(g => g.key !== OCS_ENGINEERING_GROUP);
}

/** Every page, ungrouped (matches OmniWeb's ElementNavItem shape). */
export const ocsNavItems: OcsNavItem[] = ocsNavGroups.flatMap(g => g.items);

// Route configuration for embedding
export { default as ocsRoutes } from './routes';
