import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  IconButton, Card, CardContent, Checkbox, FormControlLabel, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, Divider,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import { BalanceName, BalanceBucket, CompositeId } from '../components/ParsedId';
import type { Account, Balance, ActionTriggerEntry, AccountActionPlan } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import { formatBalanceValue } from '../components/BalanceValue';
import BalanceDialog, { type BalanceDialogMode } from '../components/BalanceDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateTime, formatRelative } from '../formatTime';
import ActionTriggerFormFields, {
  type TriggerForm, emptyTriggerForm, triggerToForm, formToActionTrigger, triggerFormErrors, clearedBalanceFields,
} from '../components/ActionTriggerForm';

// --- Utility functions ---

const BALANCE_TYPE_LABEL: Record<string, string> = { '*data': 'Data', '*voice': 'Voice', '*sms': 'SMS', '*monetary': 'Credit', '*generic': 'Generic' };

/** One line per balance type, every bucket the API returned, in readable units. */
function BalanceSummary({ balanceMap }: { balanceMap: Record<string, Balance[]> | null | undefined }) {
  if (!balanceMap || Object.keys(balanceMap).length === 0) return <Typography variant="body2" color="text.secondary">No balances</Typography>;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {Object.entries(balanceMap).map(([type, buckets]) => (
        <Chip key={type} size="small" variant="outlined"
          label={`${BALANCE_TYPE_LABEL[type] ?? type} ${buckets.map(b => formatBalanceValue(b.Value, type)).join(' · ')}`} />
      ))}
    </Box>
  );
}

function formatExpiration(expirationDateStr: string): { prettyDate: string; timeUntil: string } {
  const expirationDate = new Date(expirationDateStr);
  const now = new Date();

  if (expirationDate.toISOString() === '0001-01-01T00:00:00.000Z') {
    return { prettyDate: 'No date set', timeUntil: 'Never' };
  }

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  };
  const prettyDate = expirationDate.toLocaleString('en-US', options);

  const diffInSeconds = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
  let timeUntil: string;

  if (diffInSeconds < 0) {
    timeUntil = 'Expired';
  } else if (diffInSeconds < 60) {
    timeUntil = `${diffInSeconds} seconds`;
  } else if (diffInSeconds < 3600) {
    timeUntil = `${Math.floor(diffInSeconds / 60)} minutes`;
  } else if (diffInSeconds < 86400) {
    timeUntil = `${Math.floor(diffInSeconds / 3600)} hours`;
  } else if (diffInSeconds < 604800) {
    timeUntil = `${Math.floor(diffInSeconds / 86400)} days`;
  } else {
    timeUntil = `${Math.floor(diffInSeconds / 604800)} weeks`;
  }

  return { prettyDate, timeUntil };
}

function formatUsage(usage: number, tor: string): React.ReactNode {
  if (tor === '*data') {
    const mb = (usage / (1024 * 1024)).toFixed(2);
    return (
      <>
        {`${mb} MB`}
        <br />
        <Typography variant="caption" color="text.secondary">{`(${usage} bytes)`}</Typography>
      </>
    );
  } else if (tor === '*voice') {
    const totalSeconds = Math.floor(usage / 1e9);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return (
      <>
        {timeFormatted}
        <br />
        <Typography variant="caption" color="text.secondary">{`(${usage} ns)`}</Typography>
      </>
    );
  }
  return usage;
}

function splitAccountId(id: string): [string, string] {
  const i = id.indexOf(':');
  return [id.slice(0, i), id.slice(i + 1)];
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** UUIDv4 from getRandomValues, which unlike randomUUID also works on plain-HTTP origins. */
const balanceLabel = (b: Balance) => b.ID || b.Uuid || 'unnamed default balance';

function newUuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface TriggerEdit {
  form: TriggerForm;
  original: ActionTriggerEntry | null;
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [searchParams] = useSearchParams();
  const [accountFilter, setAccountFilter] = useState(() => searchParams.get('q') ?? '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');
  const [newAllowNegative, setNewAllowNegative] = useState(false);
  const [newDisabled, setNewDisabled] = useState(false);
  const [newPlanIds, setNewPlanIds] = useState<string[]>([]);
  const [newTriggerIds, setNewTriggerIds] = useState<string[]>([]);

  const [executeActionId, setExecuteActionId] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Option lists for the pickers
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [triggerGroups, setTriggerGroups] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [destinationIds, setDestinationIds] = useState<string[]>([]);

  const [accountActionPlans, setAccountActionPlans] = useState<AccountActionPlan[]>([]);
  const [attachPlanId, setAttachPlanId] = useState('');
  const [attachTriggerIds, setAttachTriggerIds] = useState<string[]>([]);

  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const [balanceDialog, setBalanceDialog] = useState<{ mode: BalanceDialogMode; balance: Balance | null } | null>(null);

  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<ActionTriggerEntry | null>(null);
  const [triggerEdit, setTriggerEdit] = useState<TriggerEdit | null>(null);
  const [triggerSaving, setTriggerSaving] = useState(false);

  const selectedAccountRef = useRef<Account | null>(null);
  const detailOpenRef = useRef(false);

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  useEffect(() => {
    detailOpenRef.current = detailOpen;
  }, [detailOpen]);

  const pageSize = 50;
  const [total, setTotal] = useState<number | null>(null);

  const fetchAccounts = useCallback(async (p = 0) => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAccounts(
        baseUrl, tenant, p * pageSize, pageSize,
        accountFilter ? [accountFilter] : undefined
      ) as Account[];
      setAccounts(result || []);
      setPage(p);
      setTotal(accountFilter ? (result || []).length : await api.getAccountsCount(baseUrl, tenant) as number);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch accounts'));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant, accountFilter]);

  // Linked with ?q=<account> (e.g. from Subscriber Health): show that account straight away.
  const linkedAccount = useRef(searchParams.get('q'));
  useEffect(() => {
    if (!linkedAccount.current) return;
    linkedAccount.current = null;
    void fetchAccounts(0);
  }, [fetchAccounts]);

  const loadOptions = useCallback(async (t: string) => {
    if (!baseUrl) return;
    api.getActions(baseUrl, t).then(r => setActionsList(Object.keys(r || {}).sort())).catch(() => setActionsList([]));
    api.getActionPlanIDs(baseUrl, t).then(r => setPlanIds((r || []).sort())).catch(() => setPlanIds([]));
    api.getActionTriggers(baseUrl)
      .then(r => setTriggerGroups([...new Set((r || []).map(x => x.ID))].sort()))
      .catch(() => setTriggerGroups([]));
    (api.getAccounts(baseUrl, t, 0, 0) as Promise<Account[] | null>)
      .then(r => setAccountIds((r || []).map(x => splitAccountId(x.ID)[1]).sort()))
      .catch(() => setAccountIds([]));
    api.getAllTPDestinationIds(baseUrl).then(setDestinationIds).catch(() => setDestinationIds([]));
  }, [baseUrl]);

  const fetchAccountDetails = useCallback(async (t: string, a: string, autoRefresh = false) => {
    if (!baseUrl) return;
    if (!autoRefresh) setModalLoading(true);
    try {
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      if (details?.[0]) {
        setSelectedAccount(details[0]);
      }
    } catch {
      // silent on auto-refresh
    } finally {
      if (!autoRefresh) setModalLoading(false);
    }
  }, [baseUrl]);

  const fetchAccountPlans = useCallback(async (t: string, a: string) => {
    if (!baseUrl) return;
    try {
      const plans = await api.getAccountActionPlan(baseUrl, t, a) as AccountActionPlan[];
      setAccountActionPlans(Array.isArray(plans) ? plans : []);
    } catch {
      setAccountActionPlans([]);
    }
  }, [baseUrl]);

  /** Re-read the account and its plans after a change, without the full-dialog spinner. */
  const refresh = useCallback(async () => {
    const acc = selectedAccountRef.current;
    if (!acc) return;
    const [t, a] = splitAccountId(acc.ID);
    await Promise.all([fetchAccountDetails(t, a, true), fetchAccountPlans(t, a)]);
  }, [fetchAccountDetails, fetchAccountPlans]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (detailOpen && selectedAccount) {
      const [t, a] = splitAccountId(selectedAccount.ID);
      intervalId = setInterval(() => {
        if (detailOpenRef.current && selectedAccountRef.current) {
          fetchAccountDetails(t, a, true);
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [detailOpen, selectedAccount?.ID, fetchAccountDetails]);

  const handleRowClick = useCallback(async (account: Account) => {
    if (!baseUrl) return;
    setModalLoading(true);
    const [t, a] = splitAccountId(account.ID);
    setSelectedAccount(account);
    setDetailOpen(true);
    setNotice(null);
    loadOptions(t);

    try {
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      setSelectedAccount(details?.[0] || account);
    } catch {
      setSelectedAccount(account);
    }
    await fetchAccountPlans(t, a);
    setModalLoading(false);
  }, [baseUrl, loadOptions, fetchAccountPlans]);

  const handleCloseModal = useCallback(() => {
    setDetailOpen(false);
    setSelectedAccount(null);
    setExecuteActionId('');
    setShowConfirm(false);
    setAccountActionPlans([]);
    setAttachPlanId('');
    setAttachTriggerIds([]);
    setNotice(null);
  }, []);

  /** Runs an account change, reporting failure in the page alert and refreshing on success. */
  const run = useCallback(async (fn: (t: string, a: string) => Promise<unknown>, failure: string, success?: string) => {
    const acc = selectedAccountRef.current;
    if (!baseUrl || !acc) return;
    const [t, a] = splitAccountId(acc.ID);
    try {
      await fn(t, a);
      setError(null);
      if (success) setNotice(success);
      await refresh();
    } catch (e: unknown) {
      setError(errMsg(e, failure));
    }
  }, [baseUrl, refresh]);

  const handleToggle = (option: 'Disabled' | 'AllowNegative') => run(
    (t, a) => api.setAccount(baseUrl!, {
      Tenant: t, Account: a, ExtraOptions: { [option]: !selectedAccount?.[option] },
    }),
    `Failed to update ${option}`,
  );

  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; balance: Balance; category: string } | null>(null);
  const [removeBalance, setRemoveBalance] = useState<{ balance: Balance; category: string } | null>(null);

  const openCreate = () => {
    setNewAccountId('');
    setNewAllowNegative(false);
    setNewDisabled(false);
    setNewPlanIds([]);
    setNewTriggerIds([]);
    setCreateOpen(true);
    loadOptions(tenant);
  };

  const handleCreateAccount = useCallback(async () => {
    if (!baseUrl || !newAccountId.trim()) return;
    try {
      await api.setAccount(baseUrl, {
        Tenant: tenant,
        Account: newAccountId.trim(),
        ActionPlanIDs: newPlanIds,
        ActionTriggerIDs: newTriggerIds,
        ExtraOptions: { AllowNegative: newAllowNegative, Disabled: newDisabled },
        ReloadScheduler: true,
      });
      setCreateOpen(false);
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to create account'));
    }
  }, [baseUrl, tenant, newAccountId, newPlanIds, newTriggerIds, newAllowNegative, newDisabled, page, fetchAccounts]);

  const handleConfirmExecuteAction = async () => {
    if (!executeActionId) return;
    await run((t, a) => api.executeAction(baseUrl!, t, a, executeActionId), 'Failed to execute action', `Executed ${executeActionId}.`);
    setShowConfirm(false);
  };

  // CGrateS removes every balance matching the filter, so match on the UUID to remove just this one.
  const handleRemoveBalance = async () => {
    if (!removeBalance) return;
    const { balance, category } = removeBalance;
    await run((t, a) => api.removeBalances(baseUrl!, {
      Tenant: t, Account: a, BalanceType: category, Balance: { UUID: balance.Uuid }, Cdrlog: false,
    }), 'Failed to remove balance', `Removed balance ${balanceLabel(balance)}.`);
    setRemoveBalance(null);
  };

  const handleRemoveActionTrigger = (trigger: ActionTriggerEntry) => {
    if (!window.confirm(`Remove trigger ${trigger.ID} (${trigger.UniqueID}) from this account?`)) return;
    run((t, a) => api.removeAccountActionTriggers(baseUrl!, t, a, trigger.ID, trigger.UniqueID),
      'Failed to remove action trigger');
  };

  const handleResetActionTrigger = (trigger: ActionTriggerEntry) => run(
    (t, a) => api.resetAccountActionTriggers(baseUrl!, t, a, trigger.UniqueID),
    'Failed to reset action trigger', `Trigger ${trigger.ID} reset; it can fire again.`,
  );

  const handleAttachTriggers = async () => {
    if (!attachTriggerIds.length) return;
    await run((t, a) => api.setAccount(baseUrl!, {
      Tenant: t, Account: a, ActionTriggerIDs: attachTriggerIds, ActionTriggerOverwrite: false,
    }), 'Failed to attach action triggers', `Attached ${attachTriggerIds.join(', ')}.`);
    setAttachTriggerIds([]);
  };

  const openTriggerEdit = (trigger: ActionTriggerEntry | null) => {
    setTriggerEdit({ form: trigger ? triggerToForm(trigger) : emptyTriggerForm(), original: trigger });
  };

  const triggerCleared = triggerEdit?.original ? clearedBalanceFields(triggerToForm(triggerEdit.original), triggerEdit.form) : [];
  const triggerErrors = triggerEdit ? triggerFormErrors(triggerEdit.form) : [];

  const handleSaveTrigger = async () => {
    if (!triggerEdit || triggerErrors.length) return;
    const { form, original } = triggerEdit;
    setTriggerSaving(true);
    // Without a UniqueID CGrateS leaves it empty, and the trigger could then only be removed with its whole group.
    const uniqueId = form.UniqueID.trim() || newUuid();
    await run(async (t, a) => {
      if (original && triggerCleared.length) {
        await api.removeAccountActionTriggers(baseUrl!, t, a, original.ID, original.UniqueID);
      }
      await api.setAccountActionTriggers(baseUrl!, {
        Tenant: t, Account: a, GroupID: form.GroupID.trim(), UniqueID: uniqueId,
        ActionTrigger: formToActionTrigger(form, true),
      });
      setTriggerEdit(null);
    }, 'Failed to save action trigger', `Trigger ${form.GroupID} saved.`);
    setTriggerSaving(false);
  };

  const handleAttachPlan = async () => {
    if (!attachPlanId) return;
    await run((t, a) => api.setAccount(baseUrl!, {
      Tenant: t, Account: a, ActionPlanIDs: [attachPlanId], ReloadScheduler: true,
    }), 'Failed to attach action plan', `Attached ${attachPlanId}.`);
    setAttachPlanId('');
  };

  const handleRemoveActionPlanFromAccount = (plan: AccountActionPlan) => {
    if (!window.confirm(`Remove action plan ${plan.ActionPlanId} from this account? The plan itself stays.`)) return;
    run((t, a) => api.removeAccountFromActionPlan(baseUrl!, t, a, plan.ActionPlanId),
      'Failed to remove action plan from account', `Removed ${plan.ActionPlanId} from the account.`);
  };

  const handleDeleteActionPlanGlobal = (plan: AccountActionPlan) => {
    if (!window.confirm(`Are you sure you want to DELETE the action plan "${plan.ActionPlanId}" globally? This will remove it from all accounts.`)) return;
    run((t) => api.removeActionPlan(baseUrl!, plan.ActionPlanId, t),
      'Failed to delete action plan globally', `Deleted ${plan.ActionPlanId}.`);
  };

  const [danger, setDanger] = useState<{ kind: 'delete' | 'Disabled' | 'AllowNegative'; typed: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteFromModal = useCallback(async () => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = splitAccountId(selectedAccount.ID);
    setDeleting(true);
    try {
      await api.removeAccount(baseUrl, t, a);
      setDanger(null);
      handleCloseModal();
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to delete account'));
    } finally {
      setDeleting(false);
    }
  }, [baseUrl, selectedAccount, page, fetchAccounts, handleCloseModal]);

  const renderBalanceTable = (balanceMap: Record<string, Balance[]> | null, category: string) => {
    if (!balanceMap || !balanceMap[category]) return null;
    const balances = balanceMap[category];

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Expiration Date</TableCell>
              <TableCell>Weight</TableCell>
              <TableCell>Blocker</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {balances.map((balance, i) => {
              const { prettyDate, timeUntil } = formatExpiration(balance.ExpirationDate);
              return (
                <TableRow key={balance.Uuid || i} hover sx={{ cursor: 'pointer' }}
                  onClick={() => { setSelectedBalance(balance); setBalanceModalOpen(true); }}>
                  <TableCell><BalanceName id={balance.ID} /></TableCell>
                  <TableCell>
                    {formatUsage(balance.Value, category)}
                    <BalanceBucket id={balance.ID} balanceType={category} value={balance.Value} />
                  </TableCell>
                  <TableCell>
                    {prettyDate}
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Time remaining: {timeUntil}
                    </Typography>
                  </TableCell>
                  <TableCell>{balance.Weight}</TableCell>
                  <TableCell>{balance.Blocker ? 'Yes' : 'No'}</TableCell>
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={`Actions for ${balanceLabel(balance)}`}
                      onClick={e => { e.stopPropagation(); setRowMenu({ anchor: e.currentTarget, balance, category }); }}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const [selTenant, selAccount] = selectedAccount ? splitAccountId(selectedAccount.ID) : ['', ''];

  const dangerText = !selectedAccount || !danger ? { title: '', body: '' }
    : danger.kind === 'delete' ? {
      title: 'Delete account',
      body: `This removes ${selectedAccount.ID} and all its balances from the OCS. It can't be undone.`,
    } : danger.kind === 'Disabled' ? {
      title: selectedAccount.Disabled ? 'Enable account' : 'Disable account',
      body: selectedAccount.Disabled
        ? `${selectedAccount.ID} will be able to rate and charge again.`
        : `${selectedAccount.ID} will be refused for all rating and charging until it is enabled again.`,
    } : {
      title: selectedAccount.AllowNegative ? 'Disallow negative balance' : 'Allow negative balance',
      body: selectedAccount.AllowNegative
        ? `${selectedAccount.ID} will no longer be able to go below zero.`
        : `${selectedAccount.ID} will be able to keep spending below zero.`,
    };

  const dangerRows = selectedAccount ? [
    {
      kind: 'Disabled' as const,
      label: selectedAccount.Disabled ? 'Enable account' : 'Disable account',
      help: selectedAccount.Disabled ? 'The account is disabled; it is refused for rating and charging.' : 'Refuse all rating and charging for this account.',
    },
    {
      kind: 'AllowNegative' as const,
      label: selectedAccount.AllowNegative ? 'Disallow negative' : 'Allow negative',
      help: selectedAccount.AllowNegative ? 'Balances may currently go below zero.' : 'Let balances go below zero.',
    },
    { kind: 'delete' as const, label: 'Delete account', help: 'Remove the account and all its balances. Cannot be undone.' },
  ] : [];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Accounts</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <TextField
            size="small" label="Account" value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            placeholder="Filter by account ID"
          />
          <Button variant="contained" onClick={() => fetchAccounts(0)}>Search</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate}>Create Account</Button>
        </Box>
      </Paper>

      {error && !detailOpen && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Balances</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length > 0 ? accounts.map(acc => {
                const [, a] = splitAccountId(acc.ID);
                return (
                  <TableRow key={acc.ID} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(acc)}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{a}</TableCell>
                    <TableCell>{acc.Disabled && <Chip label="Disabled" size="small" color="error" />}</TableCell>
                    <TableCell><BalanceSummary balanceMap={acc.BalanceMap} /></TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={3} align="center">No accounts found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
        <Button disabled={page === 0} onClick={() => fetchAccounts(page - 1)}>Previous</Button>
        <Typography sx={{ py: 1 }}>
          {total === null ? '' : accounts.length === 0 ? `${total} accounts`
            : `${page * pageSize + 1}–${page * pageSize + accounts.length} of ${total.toLocaleString()} accounts`}
        </Typography>
        <Button disabled={total !== null ? (page + 1) * pageSize >= total : accounts.length < pageSize} onClick={() => fetchAccounts(page + 1)}>Next</Button>
      </Box>

      <ConfirmDialog open={!!danger && !!selectedAccount} title={dangerText.title}
        confirmLabel={dangerText.title} busy={deleting}
        confirmDisabled={danger?.typed !== selAccount}
        onConfirm={async () => {
          if (danger?.kind === 'delete') return handleDeleteFromModal();
          if (danger) await handleToggle(danger.kind);
          setDanger(null);
        }}
        onClose={() => setDanger(null)}>
        <Typography sx={{ mb: 2 }}>
          {dangerText.body} Type the account name <strong>{selAccount}</strong> to confirm.
        </Typography>
        <TextField autoFocus fullWidth size="small" label="Account name" value={danger?.typed ?? ''}
          onChange={e => setDanger(d => d && { ...d, typed: e.target.value })} />
      </ConfirmDialog>

      <ConfirmDialog open={!!removeBalance} title="Remove balance" confirmLabel="Remove balance"
        onConfirm={handleRemoveBalance} onClose={() => setRemoveBalance(null)}>
        <Typography>
          Removes the {removeBalance?.category} balance <strong>{removeBalance && balanceLabel(removeBalance.balance)}</strong> (UUID {removeBalance?.balance.Uuid || 'empty'}) from <strong>{selectedAccount?.ID}</strong>.
        </Typography>
      </ConfirmDialog>

      <Menu anchorEl={rowMenu?.anchor} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        <MenuItem onClick={() => { setBalanceDialog({ mode: 'set', balance: { ...rowMenu!.balance, Type: rowMenu!.category } }); setRowMenu(null); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit…</ListItemText>
        </MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setRemoveBalance({ balance: rowMenu!.balance, category: rowMenu!.category }); setRowMenu(null); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Remove…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Account Detail Dialog */}
      <Dialog open={detailOpen} onClose={handleCloseModal} maxWidth="lg" fullWidth>
        <DialogTitle>Account Details - {selectedAccount?.ID}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
          {modalLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedAccount ? (
            <Box>
              <Typography><strong>Allow Negative:</strong> {selectedAccount.AllowNegative ? 'Yes' : 'No'}</Typography>
              <Typography><strong>Disabled:</strong> {selectedAccount.Disabled ? 'Yes' : 'No'}</Typography>
              <Typography>
                <strong>Updated</strong>{' '}
                <Tooltip title={formatDateTime(selectedAccount.UpdateTime)}>
                  <span>{formatRelative(selectedAccount.UpdateTime)}</span>
                </Tooltip>
              </Typography>

              {/* Balances */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6">Balances</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setBalanceDialog({ mode: 'add', balance: null })}>Add</Button>
                  <Button size="small" variant="outlined" onClick={() => setBalanceDialog({ mode: 'debit', balance: null })}>Debit</Button>
                  <Button size="small" variant="outlined" onClick={() => setBalanceDialog({ mode: 'set', balance: null })}>New balance</Button>
                  <Button size="small" variant="outlined" onClick={() => setBalanceDialog({ mode: 'transfer', balance: null })}>Transfer</Button>
                </Box>
              </Box>
              {selectedAccount.BalanceMap && Object.entries(selectedAccount.BalanceMap)
                .filter(([, bs]) => bs && bs.length > 0)
                .map(([category]) => (
                  <Box key={category} sx={{ mt: 2 }}>
                    <Typography variant="subtitle1">{category}</Typography>
                    {renderBalanceTable(selectedAccount.BalanceMap, category)}
                  </Box>
                ))}

              {/* Action Triggers */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6">Action Triggers</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', my: 1 }}>
                  <IdMultiSelect label="Attach trigger groups" value={attachTriggerIds} options={triggerGroups}
                    onChange={setAttachTriggerIds} fullWidth={false} sx={{ minWidth: 300 }} />
                  <Button size="small" variant="contained" onClick={handleAttachTriggers} disabled={!attachTriggerIds.length}>Attach</Button>
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openTriggerEdit(null)}>New trigger on this account</Button>
                </Box>
                {selectedAccount.ActionTriggers && selectedAccount.ActionTriggers.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Action Trigger ID</TableCell>
                          <TableCell>Threshold</TableCell>
                          <TableCell>Action</TableCell>
                          <TableCell>Last Execution Time</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAccount.ActionTriggers.map((trigger, i) => {
                          const { prettyDate, timeUntil } = formatExpiration(trigger.LastExecutionTime);
                          return (
                            <TableRow key={trigger.UniqueID || i}>
                              <TableCell>
                                {trigger.ID}
                                <br />
                                <Typography variant="caption" color="text.secondary">{trigger.UniqueID}</Typography>
                              </TableCell>
                              <TableCell>
                                {trigger.ThresholdType}{' '}
                                {trigger.ThresholdType !== '*balance_expired'
                                  && formatBalanceValue(trigger.ThresholdValue, trigger.ThresholdType.includes('event') ? undefined : trigger.Balance?.Type)}
                                <br />
                                <Typography variant="caption" color="text.secondary">{trigger.Balance?.Type}</Typography>
                              </TableCell>
                              <TableCell><CompositeId id={trigger.ActionsID} compact /></TableCell>
                              <TableCell>
                                {timeUntil}
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  {prettyDate}
                                  <br />
                                  Executed: {trigger.Executed ? 'Yes' : 'No'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <Button size="small" variant="outlined" color="success"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => { setSelectedTrigger(trigger); setTriggerModalOpen(true); }}>
                                    View
                                  </Button>
                                  <Button size="small" variant="outlined" startIcon={<EditIcon />}
                                    onClick={() => openTriggerEdit(trigger)}>
                                    Edit
                                  </Button>
                                  <Button size="small" variant="outlined" color="error"
                                    startIcon={<RemoveCircleOutlineIcon />}
                                    onClick={() => handleRemoveActionTrigger(trigger)}>
                                    Remove
                                  </Button>
                                  <Button size="small" variant="outlined" color="warning"
                                    startIcon={<RestartAltIcon />}
                                    onClick={() => handleResetActionTrigger(trigger)}>
                                    Reset
                                  </Button>
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="text.secondary">No action triggers available for this account.</Typography>
                )}
              </Box>

              {/* Action Plans */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6">Action Plans</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', my: 1 }}>
                  <SearchableSelect label="Attach action plan" value={attachPlanId} options={planIds}
                    onChange={setAttachPlanId} sx={{ minWidth: 300 }} />
                  <Button size="small" variant="contained" onClick={handleAttachPlan} disabled={!attachPlanId}>Attach</Button>
                  <Typography variant="caption" color="text.secondary">
                    The plan's *asap timings run for this account straight away.
                  </Typography>
                </Box>
                {accountActionPlans.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    {accountActionPlans.map((plan, index) => {
                      const { prettyDate, timeUntil } = formatExpiration(plan.NextExecTime);
                      return (
                        <Card key={index} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Action Plan ID</Typography>
                            <CompositeId id={plan.ActionPlanId} />
                            <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">UUID</Typography>
                                <Typography variant="body2">{plan.Uuid}</Typography>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Actions ID</Typography>
                                <CompositeId id={plan.ActionsId} compact />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">Next Execution Time</Typography>
                                <Typography variant="body2">{prettyDate}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Time until execution: {timeUntil}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                              <Button size="small" variant="outlined" color="warning"
                                onClick={() => handleRemoveActionPlanFromAccount(plan)}>
                                Remove Plan from Account
                              </Button>
                              <Button size="small" variant="outlined" color="error"
                                onClick={() => handleDeleteActionPlanGlobal(plan)}>
                                Delete ActionPlan Global
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography color="text.secondary">No action plans available for this account.</Typography>
                )}
              </Box>

              {/* Execute Action */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6">Execute Action</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mt: 1 }}>
                  <SearchableSelect label="Action" value={executeActionId} options={actionsList} onChange={setExecuteActionId} sx={{ minWidth: 250 }} />
                  <Button variant="contained" onClick={() => setShowConfirm(true)} disabled={!executeActionId}>
                    Execute
                  </Button>
                </Box>
                {showConfirm && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography>
                      Confirm you want to execute Action <strong>{executeActionId}</strong> on Account <strong>{selectedAccount.ID}</strong>?
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button size="small" variant="contained" color="error" onClick={handleConfirmExecuteAction}>
                        Confirm
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setShowConfirm(false)}>
                        Cancel
                      </Button>
                    </Box>
                  </Alert>
                )}
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2">Raw JSON</Typography>
                <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'action.hover' }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(selectedAccount, null, 2)}</pre>
                </Paper>
              </Box>

              <Paper variant="outlined" sx={{ mt: 3, borderColor: 'error.main' }}>
                <Typography variant="h6" color="error" sx={{ px: 2, pt: 1.5, pb: 1 }}>Danger zone</Typography>
                {dangerRows.map(r => (
                  <Box key={r.kind}>
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">{r.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{r.help}</Typography>
                      </Box>
                      <Button variant="outlined" color="error" size="small" onClick={() => setDanger({ kind: r.kind, typed: '' })}>
                        {r.label}…
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Paper>
            </Box>
          ) : (
            <Typography>No detailed data available for this account.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>

      {baseUrl && selectedAccount && (
        <BalanceDialog
          open={!!balanceDialog}
          mode={balanceDialog?.mode ?? 'add'}
          baseUrl={baseUrl}
          tenant={selTenant}
          account={selAccount}
          balance={balanceDialog?.balance ?? null}
          balanceMap={selectedAccount.BalanceMap}
          accountIds={accountIds}
          destinationIds={destinationIds}
          onClose={() => setBalanceDialog(null)}
          onDone={msg => { setBalanceDialog(null); setNotice(msg); refresh(); }}
        />
      )}

      {/* Account trigger edit */}
      <Dialog open={!!triggerEdit} onClose={() => setTriggerEdit(null)} maxWidth="md" fullWidth>
        <DialogTitle>{triggerEdit?.original ? `Edit trigger on ${selectedAccount?.ID}` : `New trigger on ${selectedAccount?.ID}`}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {triggerEdit && (
            <>
              <ActionTriggerFormFields
                form={triggerEdit.form}
                onChange={form => setTriggerEdit({ ...triggerEdit, form })}
                actionIds={actionsList}
                destinationIds={destinationIds}
                locked={!!triggerEdit.original}
                showExecuted
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                This changes only this account's copy. Saving re-evaluates the account's triggers, so one whose threshold is already met fires now.
                {triggerCleared.length > 0 && ` CGrateS can't unset balance filter fields (${triggerCleared.join(', ')}), so the trigger is removed and added back with the same Unique ID.`}
              </Alert>
              {triggerErrors.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>{triggerErrors.join('. ')}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleSaveTrigger} disabled={triggerSaving || triggerErrors.length > 0}>Save</Button>
          <Button onClick={() => setTriggerEdit(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Balance Detail Sub-Modal */}
      <Dialog open={balanceModalOpen} onClose={() => { setBalanceModalOpen(false); setSelectedBalance(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Balance Details</DialogTitle>
        <DialogContent>
          {selectedBalance ? (
            <TableContainer>
              <Box sx={{ mb: 2 }}>
                <BalanceName id={selectedBalance.ID} />
                <BalanceBucket id={selectedBalance.ID} balanceType={selectedBalance.Type} value={selectedBalance.Value} />
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Property</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(selectedBalance).map(([key, value], index) => (
                    <TableRow key={index}>
                      <TableCell><strong>{key}</strong></TableCell>
                      <TableCell>
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value, null, 2)
                          : String(value ?? '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography>No balance details available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBalanceModalOpen(false); setSelectedBalance(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Action Trigger Detail Sub-Modal */}
      <Dialog open={triggerModalOpen} onClose={() => { setTriggerModalOpen(false); setSelectedTrigger(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Action Trigger Details</DialogTitle>
        <DialogContent>
          {selectedTrigger ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Property</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(selectedTrigger).map(([key, value], index) => (
                    <TableRow key={index}>
                      <TableCell><strong>{key}</strong></TableCell>
                      <TableCell>
                        {typeof value === 'object' && value !== null
                          ? JSON.stringify(value, null, 2)
                          : String(value ?? '')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography>No action trigger details available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTriggerModalOpen(false); setSelectedTrigger(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Account</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField fullWidth size="small" label="Account ID" value={newAccountId}
              onChange={e => setNewAccountId(e.target.value)}
              placeholder="e.g. 1001" helperText={`Tenant: ${tenant}`} />
            <IdMultiSelect label="Action plans" value={newPlanIds} options={planIds} onChange={setNewPlanIds}
              helperText="*asap timings run for the account straight away" />
            <IdMultiSelect label="Action trigger groups" value={newTriggerIds} options={triggerGroups} onChange={setNewTriggerIds} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel control={<Checkbox checked={newAllowNegative} onChange={e => setNewAllowNegative(e.target.checked)} />} label="Allow negative" />
              <FormControlLabel control={<Checkbox checked={newDisabled} onChange={e => setNewDisabled(e.target.checked)} />} label="Disabled" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCreateAccount} disabled={!newAccountId.trim()}>Create</Button>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
