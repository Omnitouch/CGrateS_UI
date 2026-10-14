import { ACTION_PLAN_TIME_KEYWORDS } from './cgrConsts';
import { parseGoDuration } from './expiryTime';
import type { ActionTiming } from './types';

export interface TimingForm {
  ActionsID: string;
  Years: string;
  Months: string;
  MonthDays: string;
  WeekDays: string;
  Time: string;
  Weight: string;
}

export const emptyTiming = (): TimingForm => ({
  ActionsID: '', Years: '*any', Months: '*any', MonthDays: '*any', WeekDays: '*any', Time: '*asap', Weight: '0',
});

function joinList(xs: number[] | null | undefined) {
  return xs && xs.length ? xs.join(';') : '*any';
}

/** checkDefaultTiming stores the keyword as the timing ID, so a keyword ID means the keyword was the Time. */
export function timingToForm(at: ActionTiming): TimingForm {
  const t = at.Timing?.Timing;
  const id = t?.ID ?? '';
  const keyword = id.startsWith('*') ? id : '';
  return {
    ActionsID: at.ActionsID,
    Years: keyword ? '*any' : joinList(t?.Years),
    Months: keyword ? '*any' : joinList(t?.Months),
    MonthDays: keyword ? '*any' : joinList(t?.MonthDays),
    WeekDays: keyword ? '*any' : joinList(t?.WeekDays),
    Time: keyword || t?.StartTime || '',
    Weight: String(at.Weight ?? 0),
  };
}

/** True when Years/Months/MonthDays/WeekDays are ignored: a keyword, *asap or a +duration start. */
export function timeIgnoresDates(time: string) {
  const t = time.trim();
  return ACTION_PLAN_TIME_KEYWORDS.includes(t) || t.startsWith('+') || t.startsWith('*recurring+');
}

function rangeListError(label: string, value: string, min: number, max: number): string | null {
  const v = value.trim();
  if (!v || v === '*any') return null;
  for (const part of v.split(';')) {
    if (!/^\d+$/.test(part.trim())) return `${label}: "${part}" must be a whole number ${min}-${max}, ;-separated, or *any`;
    const n = Number(part);
    if (n < min || n > max) return `${label}: ${part} is outside ${min}-${max}`;
  }
  return null;
}

function timeError(time: string): string | null {
  const t = time.trim();
  if (!t) return 'Time: required';
  if (ACTION_PLAN_TIME_KEYWORDS.includes(t)) return null;
  const dur = t.startsWith('*recurring+') ? t.slice('*recurring+'.length) : t.startsWith('+') ? t.slice(1) : null;
  if (dur !== null) {
    const ms = parseGoDuration(dur);
    return ms !== null && ms > 0 ? null : `Time: "${dur}" is not a positive duration such as 1h or 30m`;
  }
  const m = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return `Time: use hh:mm:ss, *asap, +duration, *recurring+duration or a keyword`;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (h > 23 || min > 59 || s > 59) return `Time: ${t} is not a valid time of day`;
  return null;
}

/**
 * Everything here ends up in the cron string RITiming.CronString builds, which cronexpr.MustParse
 * panics on, taking the engine down; so reject anything outside these ranges before sending.
 */
export function timingErrors(t: TimingForm): string[] {
  const errs: (string | null)[] = [
    t.ActionsID.trim() ? null : 'ActionsID: required',
    timeError(t.Time),
    t.Weight.trim() !== '' && Number.isFinite(Number(t.Weight)) ? null : 'Weight must be a number',
  ];
  if (!timeIgnoresDates(t.Time)) {
    errs.push(
      rangeListError('Years', t.Years, 1970, 2099),
      rangeListError('Months', t.Months, 1, 12),
      rangeListError('MonthDays', t.MonthDays, 1, 31),
      rangeListError('WeekDays', t.WeekDays, 0, 7),
    );
  }
  return errs.filter((e): e is string => !!e);
}

export function formToAttr(t: TimingForm): Record<string, unknown> {
  const dates = !timeIgnoresDates(t.Time);
  const list = (v: string) => (dates && v.trim() ? v.trim() : '*any');
  return {
    ActionsId: t.ActionsID.trim(),
    Years: list(t.Years),
    Months: list(t.Months),
    MonthDays: list(t.MonthDays),
    WeekDays: list(t.WeekDays),
    Time: t.Time.trim(),
    Weight: Number(t.Weight),
  };
}

export function describeTiming(t: TimingForm): string {
  if (timeIgnoresDates(t.Time)) return t.Time;
  const parts = [`at ${t.Time || '00:00:00'}`];
  if (t.Years !== '*any') parts.push(`years ${t.Years}`);
  if (t.Months !== '*any') parts.push(`months ${t.Months}`);
  if (t.MonthDays !== '*any') parts.push(`days ${t.MonthDays}`);
  if (t.WeekDays !== '*any') parts.push(`weekdays ${t.WeekDays}`);
  return parts.join(', ');
}
