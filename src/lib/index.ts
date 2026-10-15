// Context
export { OcsProvider, useOcsBaseUrl, useOcsTenants } from './OcsContext';
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

export interface OcsNavGroup {
  label: string;
  items: OcsNavItem[];
}

/** Sidebar groups for embedding; hosts should render these rather than pick pages themselves, so new pages show up. */
export const ocsNavGroups: OcsNavGroup[] = [
  {
    label: 'Core',
    items: [
      { label: 'Accounts', path: '' },
      { label: 'CDRs', path: 'cdrs' },
      { label: 'Exported CDRs', path: 'exported-cdrs' },
      { label: 'Sessions', path: 'sessions' },
    ],
  },
  {
    label: 'Rating',
    items: [
      { label: 'Destinations', path: 'destinations' },
      { label: 'Destination Rates', path: 'destination-rates' },
      { label: 'Rating Plans', path: 'rating-plans' },
      { label: 'Rating Profiles', path: 'rating-profiles' },
      { label: 'Timings', path: 'timings' },
      { label: 'Tariff Plans', path: 'tariff-plans' },
      { label: 'TP Explorer', path: 'tp-explorer' },
      { label: 'Rating Hierarchy', path: 'rating-hierarchy' },
    ],
  },
  {
    label: 'Actions',
    items: [
      { label: 'Actions', path: 'actions' },
      { label: 'Action Plans', path: 'action-plans' },
      { label: 'Action Triggers', path: 'action-triggers' },
      { label: 'Upcoming Actions', path: 'upcoming-action-plans' },
    ],
  },
  {
    label: 'Profiles',
    items: [
      { label: 'Chargers', path: 'chargers' },
      { label: 'Attributes', path: 'attributes' },
      { label: 'Filters', path: 'filters' },
      { label: 'Resources', path: 'resources' },
      { label: 'Stats', path: 'stats' },
      { label: 'Thresholds', path: 'thresholds' },
    ],
  },
  {
    label: 'Routes',
    items: [
      { label: 'Route Lookup', path: 'routes' },
      { label: 'Route Profiles', path: 'route-profiles' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Get Cost', path: 'get-cost' },
      { label: 'Event Tester', path: 'charge-tester' },
      { label: 'Analyzer', path: 'analyzer' },
      { label: 'Event Reader', path: 'event-reader' },
      { label: 'Event Exporter', path: 'event-exporter' },
      { label: 'Execute JSON', path: 'execute-json' },
      { label: 'Config', path: 'config' },
      { label: 'Cache', path: 'cache' },
      { label: 'Core', path: 'core' },
    ],
  },
];

/** Every page, ungrouped (matches OmniWeb's ElementNavItem shape). */
export const ocsNavItems: OcsNavItem[] = ocsNavGroups.flatMap(g => g.items);

// Route configuration for embedding
export { default as ocsRoutes } from './routes';
