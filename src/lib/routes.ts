import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = [
  {
    index: true,
    lazy: () => import('./pages/Accounts'),
  },
  {
    path: 'accounts',
    lazy: () => import('./pages/Accounts'),
  },
  {
    path: 'cdrs',
    lazy: () => import('./pages/CDRs'),
  },
  {
    path: 'exported-cdrs',
    lazy: () => import('./pages/ExportedCDRs'),
  },
  {
    path: 'destinations',
    lazy: () => import('./pages/Destinations'),
  },
  {
    path: 'destination-rates',
    lazy: () => import('./pages/DestinationRates'),
  },
  {
    path: 'rating-plans',
    lazy: () => import('./pages/RatingPlans'),
  },
  {
    path: 'rating-profiles',
    lazy: () => import('./pages/RatingProfile'),
  },
  {
    path: 'timings',
    lazy: () => import('./pages/Timings'),
  },
  {
    path: 'actions',
    lazy: () => import('./pages/Actions'),
  },
  {
    path: 'action-plans',
    lazy: () => import('./pages/ActionPlans'),
  },
  {
    path: 'action-triggers',
    lazy: () => import('./pages/ActionTriggers'),
  },
  {
    path: 'upcoming-action-plans',
    lazy: () => import('./pages/UpcomingActionPlans'),
  },
  {
    path: 'chargers',
    lazy: () => import('./pages/Chargers'),
  },
  {
    path: 'attributes',
    lazy: () => import('./pages/Attributes'),
  },
  {
    path: 'filters',
    lazy: () => import('./pages/Filters'),
  },
  {
    path: 'resources',
    lazy: () => import('./pages/Resources'),
  },
  {
    path: 'stats',
    lazy: () => import('./pages/Stats'),
  },
  {
    path: 'thresholds',
    lazy: () => import('./pages/Thresholds'),
  },
  {
    path: 'routes',
    lazy: () => import('./pages/RouteS'),
  },
  {
    path: 'route-profiles',
    lazy: () => import('./pages/RouteProfiles'),
  },
  {
    path: 'sessions',
    lazy: () => import('./pages/Sessions'),
  },
  {
    path: 'config',
    lazy: () => import('./pages/Config'),
  },
  {
    path: 'get-cost',
    lazy: () => import('./pages/GetCost'),
  },
  {
    path: 'charge-tester',
    lazy: () => import('./pages/ChargeTester'),
  },
  {
    path: 'analyzer',
    lazy: () => import('./pages/Analyzer'),
  },
  {
    path: 'event-reader',
    lazy: () => import('./pages/EventReader'),
  },
  {
    path: 'execute-json',
    lazy: () => import('./pages/ExecuteJSON'),
  },
  {
    path: 'tariff-plans',
    lazy: () => import('./pages/TariffPlans'),
  },
];

export default routes;
