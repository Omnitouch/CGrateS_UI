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
