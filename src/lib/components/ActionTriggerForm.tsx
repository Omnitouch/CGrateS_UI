import { Box, Checkbox, Divider, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { THRESHOLD_TYPES, isZeroTime } from '../cgrConsts';
import { parseGoDuration } from '../expiryTime';
import type { ActionTriggerEntry } from '../types';
import SearchableSelect from './SearchableSelect';
import IdMultiSelect, { stringMapToIds } from './IdMultiSelect';
import { BALANCE_TYPES, BalanceValueInput } from './BalanceValue';

type TriState = '' | 'true' | 'false';

export interface TriggerForm {
  GroupID: string;
  UniqueID: string;
  ThresholdType: string;
  ThresholdValue: number;
  Recurrent: boolean;
  MinSleep: string;
  ExpirationDate: string;
  ActivationDate: string;
  ActionsID: string;
  Weight: string;
  MinQueuedItems: string;
  Executed: boolean;
  BalanceType: string;
  BalanceID: string;
  BalanceDestinationIds: string[];
  BalanceCategories: string[];
  BalanceSharedGroups: string[];
  BalanceTimingTags: string[];
  BalanceRatingSubject: string;
  BalanceWeight: string;
  BalanceExpirationDate: string;
  BalanceBlocker: TriState;
  BalanceDisabled: TriState;
}

export const emptyTriggerForm = (): TriggerForm => ({
  GroupID: '', UniqueID: '', ThresholdType: '*min_balance', ThresholdValue: 0, Recurrent: false, MinSleep: '',
  ExpirationDate: '', ActivationDate: '', ActionsID: '', Weight: '10', MinQueuedItems: '0', Executed: false,
  BalanceType: '*monetary', BalanceID: '', BalanceDestinationIds: [], BalanceCategories: [], BalanceSharedGroups: [],
  BalanceTimingTags: [], BalanceRatingSubject: '', BalanceWeight: '', BalanceExpirationDate: '',
  BalanceBlocker: '', BalanceDisabled: '',
});

/** Nanoseconds as the shortest Go duration that is exact, e.g. 3600000000000 -> 1h. */
export function nsToGoDuration(ns: number): string {
  if (!ns) return '';
  for (const [unit, f] of [['h', 3600e9], ['m', 60e9], ['s', 1e9], ['ms', 1e6], ['us', 1e3]] as const) {
    if (ns % f === 0) return `${ns / f}${unit}`;
  }
  return `${ns}ns`;
}

const tri = (b: boolean | null | undefined): TriState => (b === true ? 'true' : b === false ? 'false' : '');
const date = (t: string | null | undefined) => (isZeroTime(t) ? '' : String(t));

export function triggerToForm(t: ActionTriggerEntry): TriggerForm {
  const b = t.Balance || {};
  return {
    GroupID: t.ID || '',
    UniqueID: t.UniqueID || '',
    ThresholdType: t.ThresholdType || '*min_balance',
    ThresholdValue: t.ThresholdValue ?? 0,
    Recurrent: !!t.Recurrent,
    MinSleep: nsToGoDuration(t.MinSleep || 0),
    ExpirationDate: date(t.ExpirationDate),
    ActivationDate: date(t.ActivationDate),
    ActionsID: t.ActionsID || '',
    Weight: String(t.Weight ?? 0),
    MinQueuedItems: String(t.MinQueuedItems ?? 0),
    Executed: !!t.Executed,
    BalanceType: b.Type || '',
    BalanceID: b.ID || '',
    BalanceDestinationIds: stringMapToIds(b.DestinationIDs),
    BalanceCategories: stringMapToIds(b.Categories),
    BalanceSharedGroups: stringMapToIds(b.SharedGroups),
    BalanceTimingTags: stringMapToIds(b.TimingIDs),
    BalanceRatingSubject: b.RatingSubject || '',
    BalanceWeight: b.Weight === null || b.Weight === undefined ? '' : String(b.Weight),
    BalanceExpirationDate: date(b.ExpirationDate),
    BalanceBlocker: tri(b.Blocker),
    BalanceDisabled: tri(b.Disabled),
  };
}

const BALANCE_FILTER_FIELDS = [
  'BalanceID', 'BalanceDestinationIds', 'BalanceCategories', 'BalanceSharedGroups', 'BalanceTimingTags',
  'BalanceRatingSubject', 'BalanceWeight', 'BalanceExpirationDate', 'BalanceBlocker', 'BalanceDisabled',
] as const;

const isSet = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== '');

/** Balance filter fields set before and empty now; CGrateS can set these but never unset them. */
export function clearedBalanceFields(before: TriggerForm, after: TriggerForm): string[] {
  return BALANCE_FILTER_FIELDS.filter(k => isSet(before[k]) && !isSet(after[k]));
}

/**
 * The flat map engine.AttrSetActionTrigger.UpdateActionTrigger reads. Empty balance filter fields are left out:
 * sending one would set it (an empty expiry, for instance, matches only balances that never expire).
 */
export function formToActionTrigger(f: TriggerForm, withExecuted: boolean): Record<string, unknown> {
  const m: Record<string, unknown> = {
    ThresholdType: f.ThresholdType,
    ThresholdValue: f.ThresholdType === '*balance_expired' ? 0 : f.ThresholdValue,
    Recurrent: f.Recurrent,
    MinSleep: f.MinSleep.trim(),
    ExpirationDate: f.ExpirationDate,
    ActivationDate: f.ActivationDate,
    ActionsID: f.ActionsID.trim(),
    Weight: Number(f.Weight),
    MinQueuedItems: Number(f.MinQueuedItems),
    BalanceType: f.BalanceType,
  };
  if (withExecuted) m.Executed = f.Executed;
  if (f.BalanceID.trim()) m.BalanceID = f.BalanceID.trim();
  if (f.BalanceDestinationIds.length) m.BalanceDestinationIds = f.BalanceDestinationIds;
  if (f.BalanceCategories.length) m.BalanceCategories = f.BalanceCategories;
  if (f.BalanceSharedGroups.length) m.BalanceSharedGroups = f.BalanceSharedGroups;
  if (f.BalanceTimingTags.length) m.BalanceTimingTags = f.BalanceTimingTags;
  if (f.BalanceRatingSubject.trim()) m.BalanceRatingSubject = f.BalanceRatingSubject.trim();
  if (f.BalanceWeight.trim()) m.BalanceWeight = Number(f.BalanceWeight);
  if (f.BalanceExpirationDate) m.BalanceExpirationDate = f.BalanceExpirationDate;
  if (f.BalanceBlocker) m.BalanceBlocker = f.BalanceBlocker === 'true';
  if (f.BalanceDisabled) m.BalanceDisabled = f.BalanceDisabled === 'true';
  return m;
}

export function triggerFormErrors(f: TriggerForm): string[] {
  const num = (v: string) => v.trim() !== '' && Number.isFinite(Number(v));
  const errs: string[] = [];
  if (!f.GroupID.trim()) errs.push('Group ID is required');
  if (!f.ActionsID.trim()) errs.push('ActionsID is required');
  if (!f.BalanceType) errs.push('Balance type is required');
  if (!num(f.Weight)) errs.push('Weight must be a number');
  if (!/^\d+$/.test(f.MinQueuedItems.trim())) errs.push('MinQueuedItems must be a whole number');
  if (f.MinSleep.trim() && parseGoDuration(f.MinSleep.trim()) === null) errs.push('MinSleep must be a duration such as 30m or 1h');
  if (f.BalanceWeight.trim() && !num(f.BalanceWeight)) errs.push('Balance weight must be a number');
  return errs;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

/** datetime-local picker over an RFC3339 value; empty means none. */
function DateField({ label, value, onChange, helperText }: { label: string; value: string; onChange: (v: string) => void; helperText?: string }) {
  const d = value ? new Date(value) : null;
  const local = d && !isNaN(d.getTime())
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    : '';
  return (
    <TextField
      label={label} size="small" type="datetime-local" value={local} helperText={helperText ?? 'Empty means none'}
      onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString().replace('.000Z', 'Z') : '')}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

function TriSelect({ label, value, onChange }: { label: string; value: TriState; onChange: (v: TriState) => void }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={e => onChange(e.target.value as TriState)}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
      <MenuItem value="">Any</MenuItem>
      <MenuItem value="true">Yes</MenuItem>
      <MenuItem value="false">No</MenuItem>
    </TextField>
  );
}

interface ActionTriggerFormFieldsProps {
  form: TriggerForm;
  onChange: (f: TriggerForm) => void;
  actionIds: string[];
  destinationIds: string[];
  /** Existing trigger: Group ID and Unique ID can't change. */
  locked: boolean;
  /** Account copies carry their own Executed flag. */
  showExecuted?: boolean;
}

export default function ActionTriggerFormFields({ form, onChange, actionIds, destinationIds, locked, showExecuted }: ActionTriggerFormFieldsProps) {
  const set = <K extends keyof TriggerForm>(k: K, v: TriggerForm[K]) => onChange({ ...form, [k]: v });
  const valueByUnits = !form.ThresholdType.includes('event');
  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="Group ID" size="small" required value={form.GroupID} disabled={locked}
          onChange={e => set('GroupID', e.target.value)} />
        <TextField label="Unique ID" size="small" value={form.UniqueID} disabled={locked}
          onChange={e => set('UniqueID', e.target.value)} helperText={locked ? undefined : 'Empty to generate one'} />
        <TextField select size="small" label="Threshold Type" value={form.ThresholdType}
          onChange={e => set('ThresholdType', e.target.value)}>
          {THRESHOLD_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <SearchableSelect label="Balance Type" value={form.BalanceType} options={BALANCE_TYPES}
          onChange={v => set('BalanceType', v)} disableClearable />
        {form.ThresholdType !== '*balance_expired' && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary">Threshold Value</Typography>
            <BalanceValueInput
              key={`${form.BalanceType}${valueByUnits}`}
              value={form.ThresholdValue}
              balanceType={valueByUnits ? form.BalanceType : undefined}
              onChange={v => set('ThresholdValue', v)}
            />
          </Box>
        )}
        <SearchableSelect label="ActionsID" value={form.ActionsID} options={actionIds}
          onChange={v => set('ActionsID', v)} sx={{ gridColumn: '1 / -1' }} />
        <TextField label="Weight" size="small" type="number" value={form.Weight} onChange={e => set('Weight', e.target.value)} />
        <TextField label="MinSleep" size="small" value={form.MinSleep} onChange={e => set('MinSleep', e.target.value)}
          helperText="Pause between recurrent runs, e.g. 1h; empty for none" />
        <TextField label="MinQueuedItems" size="small" type="number" value={form.MinQueuedItems}
          onChange={e => set('MinQueuedItems', e.target.value)} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel control={<Checkbox checked={form.Recurrent} onChange={e => set('Recurrent', e.target.checked)} />} label="Recurrent" />
          {showExecuted && (
            <FormControlLabel control={<Checkbox checked={form.Executed} onChange={e => set('Executed', e.target.checked)} />} label="Executed" />
          )}
        </Box>
        <DateField label="Activation Date" value={form.ActivationDate} onChange={v => set('ActivationDate', v)} />
        <DateField label="Expiration Date" value={form.ExpirationDate} onChange={v => set('ExpirationDate', v)} />
      </Box>

      <Divider />
      <Typography variant="subtitle2">Balance filter</Typography>
      <Typography variant="caption" color="text.secondary">
        Only balances matching every field you set are checked; leave a field empty to match any.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="Balance ID" size="small" value={form.BalanceID} onChange={e => set('BalanceID', e.target.value)} />
        <TextField label="Rating Subject" size="small" value={form.BalanceRatingSubject} onChange={e => set('BalanceRatingSubject', e.target.value)} />
        <IdMultiSelect label="Destination IDs" value={form.BalanceDestinationIds} options={['*any', ...destinationIds]}
          onChange={v => set('BalanceDestinationIds', v)} placeholder="Prefix ! to exclude" />
        <IdMultiSelect label="Categories" value={form.BalanceCategories} options={[]} onChange={v => set('BalanceCategories', v)} />
        <IdMultiSelect label="Shared Groups" value={form.BalanceSharedGroups} options={[]} onChange={v => set('BalanceSharedGroups', v)} />
        <IdMultiSelect label="Timing IDs" value={form.BalanceTimingTags} options={[]} onChange={v => set('BalanceTimingTags', v)} />
        <TextField label="Balance Weight" size="small" type="number" value={form.BalanceWeight} onChange={e => set('BalanceWeight', e.target.value)} />
        <DateField label="Balance Expiration Date" value={form.BalanceExpirationDate} onChange={v => set('BalanceExpirationDate', v)}
          helperText="Matches only balances expiring at exactly this time" />
        <TriSelect label="Blocker" value={form.BalanceBlocker} onChange={v => set('BalanceBlocker', v)} />
        <TriSelect label="Disabled" value={form.BalanceDisabled} onChange={v => set('BalanceDisabled', v)} />
      </Box>
    </Box>
  );
}
