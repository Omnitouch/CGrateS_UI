// Context
export { OcsProvider, useOcsBaseUrl, useOcsTenants } from './OcsContext';
export type { OcsContextValue, OcsProviderProps } from './OcsContext';

// API
export * as ocsApi from './api';

// Hooks
export * from './hooks';

// Types
export * from './types';

// Nav items definition for embedding (matches OmniWeb's ElementNavItem shape)
export const ocsNavItems = [
  // Core
  { label: 'Accounts', path: '' },
  { label: 'CDRs', path: 'cdrs' },
  { label: 'Exported CDRs', path: 'exported-cdrs' },
  { label: 'Sessions', path: 'sessions' },
  // Rating
  { label: 'Destinations', path: 'destinations' },
  { label: 'Destination Rates', path: 'destination-rates' },
  { label: 'Rating Plans', path: 'rating-plans' },
  { label: 'Rating Profiles', path: 'rating-profiles' },
  { label: 'Timings', path: 'timings' },
  { label: 'Tariff Plans', path: 'tariff-plans' },
  // Actions
  { label: 'Actions', path: 'actions' },
  { label: 'Action Plans', path: 'action-plans' },
  { label: 'Action Triggers', path: 'action-triggers' },
  { label: 'Upcoming Actions', path: 'upcoming-action-plans' },
  // Profiles
  { label: 'Chargers', path: 'chargers' },
  { label: 'Attributes', path: 'attributes' },
  { label: 'Filters', path: 'filters' },
  { label: 'Resources', path: 'resources' },
  { label: 'Stats', path: 'stats' },
  { label: 'Thresholds', path: 'thresholds' },
  // Routes
  { label: 'Route Lookup', path: 'routes' },
  { label: 'Route Profiles', path: 'route-profiles' },
  // Tools
  { label: 'Get Cost', path: 'get-cost' },
  { label: 'Charge Tester', path: 'charge-tester' },
  { label: 'Analyzer', path: 'analyzer' },
  { label: 'Event Reader', path: 'event-reader' },
  { label: 'Execute JSON', path: 'execute-json' },
  { label: 'Config', path: 'config' },
] as const;

// Route configuration for embedding
export { default as ocsRoutes } from './routes';
