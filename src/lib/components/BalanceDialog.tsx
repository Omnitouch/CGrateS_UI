import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography,
} from '@mui/material';
import type { Balance } from '../types';
import * as api from '../api';
import { isZeroTime } from '../cgrConsts';
import SearchableSelect from './SearchableSelect';
import IdMultiSelect, { joinIds, stringMapToIds } from './IdMultiSelect';
import ExpiryTimeInput from './ExpiryTimeInput';
import { BALANCE_TYPES, BalanceValueInput } from './BalanceValue';

export type BalanceDialogMode = 'add' | 'debit' | 'set' | 'transfer';

interface BalanceDialogProps {
  open: boolean;
  mode: BalanceDialogMode;
  baseUrl: string;
  tenant: string;
  account: string;
  /** Balance being edited (mode "set"), or the transfer source. */
  balance: (Balance & { Type?: string }) | null;
  /** Balances on the account, by type, for picking a transfer source. */
  balanceMap: Record<string, Balance[]> | null;
  accountIds: string[];
  destinationIds: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const TITLES: Record<BalanceDialogMode, string> = {
  add: 'Add to balance (*topup)', debit: 'Debit balance (*debit)', set: 'Set balance', transfer: 'Transfer between balances',
};

export default function BalanceDialog(props: BalanceDialogProps) {
  const { open, mode, baseUrl, tenant, account, balance, balanceMap, accountIds, destinationIds, onClose, onDone } = props;
  const [type, setType] = useState('*monetary');
  const [id, setId] = useState('');
  const [value, setValue] = useState(0);
  const [expiry, setExpiry] = useState('');
  const [weight, setWeight] = useState('');
  const [dests, setDests] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [sharedGroups, setSharedGroups] = useState<string[]>([]);
  const [timingIds, setTimingIds] = useState<string[]>([]);
  const [ratingSubject, setRatingSubject] = useState('');
  const [blocker, setBlocker] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [reset, setReset] = useState(false);
  const [cdrlog, setCdrlog] = useState(false);
  const [destAccount, setDestAccount] = useState('');
  const [destBalanceId, setDestBalanceId] = useState('');
  const [refValue, setRefValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = mode === 'set' && !!balance;

  useEffect(() => {
    if (!open) return;
    const b = balance;
    setType(b?.Type || '*monetary');
    setId(b?.ID || '');
    setValue(mode === 'set' ? b?.Value ?? 0 : 0);
    setExpiry(mode === 'set' && b && !isZeroTime(b.ExpirationDate) ? b.ExpirationDate : '');
    setWeight(mode === 'set' && b ? String(b.Weight ?? '') : '');
    setDests(mode === 'set' ? stringMapToIds(b?.DestinationIDs) : []);
    setCategories(mode === 'set' ? stringMapToIds(b?.Categories) : []);
    setSharedGroups(mode === 'set' ? stringMapToIds(b?.SharedGroups) : []);
    setTimingIds(mode === 'set' ? stringMapToIds(b?.TimingIDs) : []);
    setRatingSubject(mode === 'set' ? b?.RatingSubject || '' : '');
    setBlocker(!!b?.Blocker);
    setDisabled(!!b?.Disabled);
    setReset(false);
    setCdrlog(false);
    setDestAccount(account);
    setDestBalanceId('');
    setRefValue('');
    setError(null);
  }, [open, mode, balance, account]);

  const sources = Object.entries(balanceMap || {}).flatMap(([t, bs]) => (bs || []).filter(b => b.ID).map(b => ({ ...b, Type: t })));
  const source = mode === 'transfer' ? sources.find(b => b.ID === id) : undefined;

  /** Fields NewBalanceFilter reads; for add/debit only what was filled in, since each one also narrows the match. */
  const balanceMapPayload = (all: boolean): Record<string, unknown> => {
    const m: Record<string, unknown> = {};
    const put = (k: string, v: unknown, has: boolean) => { if (all || has) m[k] = v; };
    put('ID', id.trim(), !!id.trim());
    put('ExpiryTime', expiry, !!expiry);
    if (weight.trim()) m.Weight = weight.trim();
    put('DestinationIDs', joinIds(dests), dests.length > 0);
    put('Categories', joinIds(categories), categories.length > 0);
    put('SharedGroups', joinIds(sharedGroups), sharedGroups.length > 0);
    put('TimingIDs', joinIds(timingIds), timingIds.length > 0);
    put('RatingSubject', ratingSubject.trim(), !!ratingSubject.trim());
    return m;
  };

  const problem = (() => {
    if (mode === 'transfer') {
      if (!source) return 'Pick the source balance';
      if (!destAccount.trim() || !destBalanceId.trim()) return 'Destination account and balance ID are required';
      if (!(value > 0) && !refValue.trim()) return 'Units must be above 0';
      if (refValue.trim() && !Number.isFinite(Number(refValue))) return 'Reference value must be a number';
      return null;
    }
    if (mode === 'set' && !id.trim() && !balance?.Uuid) return 'Balance ID is required';
    if ((mode === 'add' || mode === 'debit') && !(value > 0)) return 'Value must be above 0';
    if (value < 0) return 'CGrateS stores the absolute value; use Debit to lower a balance';
    return null;
  })();

  const submit = async () => {
    if (problem) return;
    setBusy(true); setError(null);
    try {
      if (mode === 'add' || mode === 'debit') {
        const params = { Tenant: tenant, Account: account, BalanceType: type, Value: value, Balance: balanceMapPayload(false), Overwrite: reset, Cdrlog: cdrlog };
        await (mode === 'add' ? api.addBalance : api.debitBalance)(baseUrl, params);
        onDone(`${mode === 'add' ? 'Added to' : 'Debited from'} ${type} balance${id ? ` ${id}` : ''}.`);
      } else if (mode === 'set') {
        const b = { ...balanceMapPayload(true), Value: value, Blocker: blocker, Disabled: disabled } as Record<string, unknown>;
        if (balance?.Uuid) b.UUID = balance.Uuid;
        await api.setBalance(baseUrl, { Tenant: tenant, Account: account, BalanceType: type, Balance: b, Cdrlog: cdrlog });
        onDone(`Balance ${id || balance?.Uuid} set.`);
      } else {
        const params: Record<string, unknown> = {
          Tenant: tenant, SourceAccountID: account, SourceBalanceID: id,
          DestinationAccountID: destAccount.trim(), DestinationBalanceID: destBalanceId.trim(), Units: value, Cdrlog: cdrlog,
        };
        if (refValue.trim()) params.DestinationReferenceValue = Number(refValue);
        await api.transferBalance(baseUrl, params);
        onDone(`Transferred from ${id} to ${destAccount}/${destBalanceId}.`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const valueType = mode === 'transfer' ? source?.Type : type;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? `Edit balance ${balance?.ID || balance?.Uuid}` : TITLES[mode]}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {mode === 'transfer' ? (
            <SearchableSelect label="Source balance" value={id} options={sources.map(b => b.ID)}
              groupBy={o => sources.find(b => b.ID === o)?.Type || ''} onChange={setId} />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <SearchableSelect label="Balance type" value={type} options={BALANCE_TYPES} onChange={setType} disableClearable disabled={editing} />
              <TextField size="small" label="Balance ID" value={id} onChange={e => setId(e.target.value)} disabled={editing}
                helperText={mode === 'set' ? undefined : 'Empty to match by the fields below'} />
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">{mode === 'transfer' ? 'Units' : 'Value'}</Typography>
            <BalanceValueInput key={`${valueType}${open}`} value={value} balanceType={valueType} onChange={setValue} />
          </Box>

          {mode === 'transfer' ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <SearchableSelect label="Destination account" value={destAccount} options={accountIds} onChange={setDestAccount} />
              <TextField size="small" label="Destination balance ID" value={destBalanceId} onChange={e => setDestBalanceId(e.target.value)}
                helperText="Created if it doesn't exist" />
              <TextField size="small" label="Destination reference value" value={refValue} onChange={e => setRefValue(e.target.value)}
                helperText="Optional: transfer whatever brings the destination to this value" sx={{ gridColumn: '1 / -1' }} />
            </Box>
          ) : (
            <>
              <Typography variant="subtitle2">{mode === 'set' ? 'Balance properties' : 'Match or create with (optional)'}</Typography>
              <Box>
                <Typography variant="caption" color="text.secondary">Expiry</Typography>
                <ExpiryTimeInput value={expiry} onChange={setExpiry} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField size="small" label="Weight" value={weight} onChange={e => setWeight(e.target.value)}
                  helperText="Number, or *time_desc / *time_asc" />
                <TextField size="small" label="Rating subject" value={ratingSubject} onChange={e => setRatingSubject(e.target.value)} />
                <IdMultiSelect label="Destination IDs" value={dests} options={['*any', ...destinationIds]} onChange={setDests}
                  placeholder="Prefix ! to exclude" />
                <IdMultiSelect label="Categories" value={categories} options={[]} onChange={setCategories} />
                <IdMultiSelect label="Shared groups" value={sharedGroups} options={[]} onChange={setSharedGroups} />
                <IdMultiSelect label="Timing IDs" value={timingIds} options={[]} onChange={setTimingIds} />
              </Box>
              {mode === 'set' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel control={<Checkbox checked={blocker} onChange={e => setBlocker(e.target.checked)} />} label="Blocker" />
                  <FormControlLabel control={<Checkbox checked={disabled} onChange={e => setDisabled(e.target.checked)} />} label="Disabled" />
                </Box>
              )}
              {(mode === 'add' || mode === 'debit') && (
                <FormControlLabel
                  control={<Checkbox checked={reset} onChange={e => setReset(e.target.checked)} />}
                  label={`Reset the balance to this value first (*${mode === 'add' ? 'topup' : 'debit'}_reset)`}
                />
              )}
            </>
          )}
          <FormControlLabel control={<Checkbox checked={cdrlog} onChange={e => setCdrlog(e.target.checked)} />} label="Write a CDR (*cdrlog)" />
          {problem && <Alert severity="warning">{problem}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={submit} disabled={busy || !!problem}>{mode === 'set' ? 'Save' : 'Apply'}</Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
