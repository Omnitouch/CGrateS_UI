// Option lists taken from the CGrateS source (utils/consts.go, engine/filters.go).

export const TORS = ['*voice', '*data', '*sms', '*mms', '*generic', '*monetary'];

export const REQUEST_TYPES = ['*prepaid', '*postpaid', '*pseudoprepaid', '*rated', '*dynaprepaid', '*none'];

/** APIOpts.*cache values; empty means the server's default caching. */
export const CACHING_OPTIONS = ['*reload', '*load', '*remove', '*clear', '*none'];

/** Filter rule types (engine/filters.go supportedFiltersType); each also works with a *not prefix. */
export const FILTER_TYPES = [
  '*string', '*contains', '*prefix', '*suffix', '*empty', '*exists',
  '*lt', '*lte', '*gt', '*gte', '*eq',
  '*timings', '*destinations', '*rsr', '*regex', '*ipnet', '*ai',
  '*apiban', '*sentrypeer',
];

/** Rule types that take no values (only a field name). */
export const VALUELESS_FILTER_TYPES = ['*empty', '*exists'];

export function negateFilterType(type: string) {
  return type.startsWith('*not') ? `*${type.slice(4)}` : `*not${type.slice(1)}`;
}

export const ALL_FILTER_TYPES = [...FILTER_TYPES, ...FILTER_TYPES.map(negateFilterType)];

export const ZERO_TIME = '0001-01-01T00:00:00Z';

export function isZeroTime(t: string | undefined | null) {
  return !t || t.startsWith('0001-01-01');
}

/** Action types registered in engine/action.go (actionFuncMap) and ees/libactions.go. */
export const ACTION_TYPES = [
  '*topup', '*topup_reset', '*debit', '*debit_reset', '*set_balance', '*remove_balance',
  '*transfer_balance', '*transfer_monetary_default', '*topup_zero_negative', '*set_expiry', '*remove_expired',
  '*reset_account', '*reset_counters', '*reset_triggers', '*set_recurrent', '*unset_recurrent',
  '*allow_negative', '*deny_negative', '*enable_account', '*disable_account', '*remove_account',
  '*publish_account', '*reset_account_cdr', '*cdrlog', '*log',
  '*http_post', '*http_post_async', '*post_event', '*mail_async', '*cgr_rpc', '*export',
  '*set_ddestinations', '*remove_session_costs', '*alter_sessions', '*force_disconnect_sessions',
  '*reset_threshold', '*reset_stat_queue', '*remote_set_account', '*sy_publish',
  '*dynamic_threshold', '*dynamic_stats', '*dynamic_attribute', '*dynamic_action_plan',
  '*dynamic_action_plan_accounts', '*dynamic_action', '*dynamic_destination', '*dynamic_filter',
  '*dynamic_route', '*dynamic_ranking', '*dynamic_rating_profile', '*dynamic_trend',
  '*dynamic_resource', '*dynamic_action_trigger',
];

/** What each action type reads from ExtraParameters (engine/action.go). */
export const EXTRA_PARAMETERS_HINTS: Record<string, string> = {
  '*cdrlog': 'Optional JSON object of CDR field templates, e.g. {"Category":"^activation"}',
  '*transfer_balance': 'JSON: {"DestinationAccountID":"tenant:account","DestinationBalanceID":"…","DestinationReferenceValue":10}',
  '*remove_account': 'Optional JSON {"Tenant":"…","Account":"…"} when not run on an account',
  '*http_post': 'URL to post to',
  '*http_post_async': 'URL to post to',
  '*post_event': 'URL to post to',
  '*remote_set_account': 'URL to post the account to',
  '*mail_async': 'Comma-separated: recipients (;-separated), then optional fields',
  '*cgr_rpc': 'Go template (<< >> delimiters) producing a JSON RPC request',
  '*export': 'Exporter IDs, ;-separated',
  '*set_ddestinations': 'Stat queue IDs, ;-separated',
  '*remove_session_costs': 'Filter IDs, ;-separated',
  '*reset_threshold': 'tenant:ThresholdID',
  '*reset_stat_queue': 'tenant:StatQueueID',
  '*alter_sessions': 'tenant;filters(&);limit;APIOpts(&);Event(&)',
  '*force_disconnect_sessions': 'tenant;filters(&);limit;APIOpts(&);Event(&)',
  '*dynamic_action_plan': 'Id;ActionsId;TimingId;Weight;Overwrite',
  '*dynamic_action_plan_accounts': 'Id;ActionsId;TimingId;Weight;Overwrite;Tenant:AccountIDs(&)',
  '*dynamic_destination': 'Id;Prefixes(&)',
};

/** ThresholdType values Account.ExecuteActionTriggers acts on. */
export const THRESHOLD_TYPES = [
  '*min_balance', '*max_balance', '*balance_expired',
  '*min_event_counter', '*max_event_counter', '*min_balance_counter', '*max_balance_counter',
];

/** ActionPlan Time keywords; all but *asap are expanded by engine.checkDefaultTiming and ignore the date fields. */
export const ACTION_PLAN_TIME_KEYWORDS = [
  '*asap', '*every_minute', '*hourly', '*daily', '*weekly', '*monthly', '*monthly_estimated', '*month_end', '*yearly',
];
