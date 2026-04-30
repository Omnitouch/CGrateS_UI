// CGrateS OCS TypeScript Interfaces

/** JSON-RPC response envelope */
export interface JsonRpcResponse<T = unknown> {
  id: number;
  result: T | null;
  error: JsonRpcError | null;
}

export interface JsonRpcError {
  code?: number;
  message: string;
}

/** Account (APIerSv2.GetAccounts) */
export interface Account {
  ID: string;
  BalanceMap: Record<string, Balance[]> | null;
  UnitCounters: unknown | null;
  ActionTriggers: ActionTriggerEntry[] | null;
  AllowNegative: boolean;
  Disabled: boolean;
  UpdateTime: string;
}

export interface Balance {
  Uuid: string;
  ID: string;
  Type: string;
  Value: number;
  ExpirationDate: string;
  Weight: number;
  DestinationIDs: Record<string, boolean> | string | null;
  RatingSubject: string;
  Categories: Record<string, boolean> | null;
  SharedGroups: Record<string, boolean> | null;
  Timings: unknown | null;
  TimingIDs: Record<string, boolean> | null;
  Disabled: boolean | null;
  Factors: unknown | null;
  Blocker: boolean;
}

/** CDR record (CDRsV2.GetCDRs) */
export interface CDR {
  CGRID: string;
  RunID: string;
  OrderID: number;
  OriginHost: string;
  Source: string;
  OriginID: string;
  ToR: string;
  RequestType: string;
  Tenant: string;
  Category: string;
  Account: string;
  Subject: string;
  Destination: string;
  SetupTime: string;
  AnswerTime: string;
  Usage: number;
  ExtraFields: Record<string, string>;
  ExtraInfo: string;
  Partial: boolean;
  PreRated: boolean;
  CostSource: string;
  Cost: number;
  CostDetails: unknown | null;
}

/** Action trigger entry on an account */
export interface ActionTriggerEntry {
  ID: string;
  UniqueID: string;
  ThresholdType: string;
  ThresholdValue: number;
  Recurrent: boolean;
  MinSleep: number;
  ExpirationDate: string;
  ActivationDate: string;
  Balance: TriggerBalance;
  Weight: number;
  ActionsID: string;
  MinQueuedItems: number;
  Executed: boolean;
  LastExecutionTime: string;
}

export interface TriggerBalance {
  Uuid?: string;
  ID?: string;
  Type?: string;
  Value?: number;
  ExpirationDate?: string;
  Weight?: number;
  DestinationIDs?: Record<string, boolean> | null;
  RatingSubject?: string;
  Categories?: Record<string, boolean> | null;
  SharedGroups?: Record<string, boolean> | null;
  TimingIDs?: Record<string, boolean> | null;
  Timings?: unknown | null;
  Disabled?: boolean | null;
  Factors?: unknown | null;
  Blocker?: boolean;
}

/** Action plan (APIerSv1.GetActionPlan) */
export interface ActionPlan {
  Id: string;
  AccountIDs: Record<string, boolean>;
  ActionTimings: ActionTiming[];
}

export interface ActionTiming {
  ActionsID: string;
  Years: string;
  Months: string;
  MonthDays: string;
  WeekDays: string;
  Time: string;
  Weight: string | number;
}

/** Scheduled action (ApierV1.GetScheduledActions) */
export interface ScheduledAction {
  ActionPlanID: string;
  ActionsID: string;
  ActionTimingUUID: string;
  NextRunTime: string;
  Accounts: number;
}

/** Action definition (APIerSv2.GetActions) */
export interface ActionPart {
  Id: string;
  ActionType: string;
  ExtraParameters: string;
  Filters: string | string[];
  ExpirationString: string;
  Weight: number;
  Balance: ActionBalance;
}

export interface ActionBalance {
  Uuid?: string;
  ID?: string;
  Type?: string;
  Value?: { Static: number } | null;
  ExpirationDate?: string;
  Weight?: number;
  DestinationIDs?: Record<string, boolean> | string;
  RatingSubject?: string;
  Categories?: Record<string, boolean> | null;
  SharedGroups?: Record<string, boolean> | null;
  TimingIDs?: Record<string, boolean> | null;
  Timings?: unknown | null;
  Disabled?: boolean | null;
  Factors?: unknown | null;
  Blocker?: boolean;
}

/** Account action plan (ApierV2.GetAccountActionPlan) */
export interface AccountActionPlan {
  ActionPlanId: string;
  Uuid: string;
  ActionsId: string;
  NextExecTime: string;
}

/** Charger profile */
export interface ChargerProfile {
  Tenant: string;
  ID: string;
  FilterIDs: string[];
  AttributeIDs: string[];
  RunID: string;
  Weight: number;
}

/** Attribute profile */
export interface AttributeProfile {
  Tenant: string;
  ID: string;
  Contexts: string[];
  FilterIDs: string[];
  ActivationInterval: ActivationInterval | null;
  Attributes: AttributeEntry[];
  Blocker: boolean;
  Weight: number;
}

export interface AttributeEntry {
  Path: string;
  Type: string;
  Value: { Rules: string }[];
  FilterIDs: string[];
}

export interface ActivationInterval {
  ActivationTime: string;
  ExpiryTime: string;
}

/** Filter profile */
export interface FilterProfile {
  Tenant: string;
  ID: string;
  Rules: FilterRule[];
  ActivationInterval: ActivationInterval | null;
}

export interface FilterRule {
  Type: string;
  Element: string;
  Values: string[];
}

/** Resource profile */
export interface ResourceProfile {
  Tenant: string;
  ID: string;
  FilterIDs: string[];
  ActivationInterval: ActivationInterval | null;
  UsageTTL: number;
  Limit: number;
  Blocker: boolean;
  Stored: boolean;
  Weight: number;
  ThresholdIDs: string[];
}

export interface ResourceUsage {
  Tenant: string;
  ID: string;
  Usages: Record<string, ResourceUsageEntry> | null;
  TTLIdx: string | null;
}

export interface ResourceUsageEntry {
  Tenant: string;
  ExpiryTime: string;
  Units: number;
}

/** Stat queue profile */
export interface StatQueueProfile {
  Tenant: string;
  ID: string;
  FilterIDs: string[];
  QueueLength: number;
  TTL: number;
  MinItems: number;
  Metrics: StatMetric[];
  Stored: boolean;
  Blocker: boolean;
  Weight: number;
  ThresholdIDs: string[];
}

export interface StatMetric {
  MetricID: string;
  FilterIDs: string[];
}

/** Threshold profile */
export interface ThresholdProfile {
  Tenant: string;
  ID: string;
  FilterIDs: string[];
  ActivationInterval: ActivationInterval | null;
  MaxHits: number;
  MinHits: number;
  MinSleep: string;
  Blocker: boolean;
  Weight: number;
  ActionIDs: string[];
  Async: boolean;
}

/** Route profile */
export interface RouteProfile {
  Tenant: string;
  ID: string;
  FilterIDs: string[];
  Sorting: string;
  SortingParameters: string[];
  Routes: Route[];
  Weight: number;
}

export interface Route {
  ID: string;
  FilterIDs: string[];
  AccountIDs: string[];
  RatingPlanIDs: string[];
  ResourceIDs: string[];
  StatIDs: string[];
  RouteParameters: string;
  Weight: number;
  Blocker: boolean;
}

/** Route result from RouteSv1.GetRoutes */
export interface RouteResult {
  ProfileID: string;
  Sorting: string;
  Routes: RouteEntry[];
}

export interface RouteEntry {
  RouteID: string;
  RouteParameters: string;
  SortingData: {
    Cost: number;
    RatingPlanID: string;
    Weight: number;
  };
}

/** Session (SessionSv1.GetActiveSessions) */
export interface Session {
  CGRID: string;
  RunID: string;
  OriginHost: string;
  Source: string;
  OriginID: string;
  ToR: string;
  RequestType: string;
  Tenant: string;
  Category: string;
  Account: string;
  Subject: string;
  Destination: string;
  SetupTime: string;
  AnswerTime: string;
  Usage: number;
  ExtraFields: Record<string, string>;
  NodeID: string;
  LoopIndex: number;
  DurationIndex: number;
  MaxRate: number;
  MaxRateUnit: number;
  MaxCostSoFar: number;
  DebitInterval: number;
  NextAutoDebit: string;
}

/** Destination (TP) */
export interface TPDestination {
  TPid: string;
  ID: string;
  Prefixes: string[];
}

/** Destination Rate (TP) */
export interface TPDestinationRate {
  TPid: string;
  ID: string;
  DestinationRates: DestinationRateEntry[];
}

export interface DestinationRateEntry {
  DestinationId: string;
  RateId: string;
  RoundingMethod: string;
  RoundingDecimals: number;
  MaxCost: number;
  MaxCostStrategy: string;
}

/** Rating Plan (TP) */
export interface TPRatingPlan {
  TPid: string;
  ID: string;
  RatingPlanBindings: unknown[];
}

/** Rating Profile */
export interface RatingProfileData {
  Id: string;
  Category: string;
  Subject: string;
  RatingPlanActivations: RatingPlanActivation[];
}

export interface RatingPlanActivation {
  ActivationTime: string;
  RatingPlanId: string;
  FallbackSubjects: string;
}

/** Timing (TP) */
export interface TPTiming {
  TPid?: string;
  ID: string;
  Years: string;
  Months: string;
  MonthDays: string;
  WeekDays: string;
  StartTime: string;
  EndTime: string;
  Time?: string;
}

/** GetCost result */
export interface CostResult {
  Cost: number;
  RatingPlanId: string;
  [key: string]: unknown;
}

/** Analyzer result */
export interface AnalyzerResult {
  RequestID: number;
  RequestMethod: string;
  RequestStartTime: string;
  RequestDuration: string;
  RequestEncoding: string;
  RequestSource: string;
  RequestDestination: string;
  RequestParams: unknown;
  Reply: unknown;
  ReplyError: string | null;
}

/** Event reader (from config) */
export interface EventReaderConfig {
  id: string;
  type?: string;
  description?: string;
  config?: unknown;
  [key: string]: unknown;
}
