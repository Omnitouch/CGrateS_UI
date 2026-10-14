import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  IconButton, Card, CardContent, Checkbox, FormControlLabel,
} from '@mui/material';
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
import ActionTriggerFormFields, {
  type TriggerForm, emptyTriggerForm, triggerToForm, formToActionTrigger, triggerFormErrors, clearedBalanceFields,
} from '../components/ActionTriggerForm';

// --- Utility functions ---

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
  const [accountFilter, setAccountFilter] = useState('');
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
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch accounts'));
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant, accountFilter]);

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

  const handleDelete = useCallback(async (account: Account) => {
    if (!baseUrl || !window.confirm(`Delete account ${account.ID}?`)) return;
    try {
      const [t, a] = splitAccountId(account.ID);
      await api.removeAccount(baseUrl, t, a);
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to delete'));
    }
  }, [baseUrl, page, fetchAccounts]);

  const handleToggle = (option: 'Disabled' | 'AllowNegative') => run(
    (t, a) => api.setAccount(baseUrl!, {
      Tenant: t, Account: a, ExtraOptions: { [option]: !selectedAccount?.[option] },
    }),
    `Failed to update ${option}`,
  );

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
  const handleRemoveBalance = (balance: Balance, category: string) => {
    if (!window.confirm(`Remove balance ${balance.ID || balance.Uuid}?`)) return;
    run((t, a) => api.removeBalances(baseUrl!, {
      Tenant: t, Account: a, BalanceType: category, Balance: { UUID: balance.Uuid }, Cdrlog: false,
    }), 'Failed to remove balance', `Removed balance ${balance.ID || balance.Uuid}.`);
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

  const handleDeleteFromModal = useCallback(async () => {
    if (!baseUrl || !selectedAccount) return;
    if (!window.confirm(`Delete account ${selectedAccount.ID}?`)) return;
    const [t, a] = splitAccountId(selectedAccount.ID);
    try {
      await api.removeAccount(baseUrl, t, a);
      handleCloseModal();
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to delete account'));
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
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances.map((balance, i) => {
              const { prettyDate, timeUntil } = formatExpiration(balance.ExpirationDate);
              return (
                <TableRow key={balance.Uuid || i}>
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
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Button size="small" variant="outlined" color="success"
                        startIcon={<VisibilityIcon />}
                        onClick={() => { setSelectedBalance(balance); setBalanceModalOpen(true); }}>
                        View
                      </Button>
                      <Button size="small" variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setBalanceDialog({ mode: 'set', balance: { ...balance, Type: category } })}>
                        Edit
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleRemoveBalance(balance, category)}>
                        Remove
                      </Button>
                    </Box>
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
                <TableCell>#</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Disabled</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length > 0 ? accounts.map((acc, idx) => {
                const [t, a] = splitAccountId(acc.ID);
                return (
                  <TableRow key={acc.ID} hover sx={{ cursor: 'pointer' }}>
                    <TableCell>{page * pageSize + idx + 1}</TableCell>
                    <TableCell>{t}</TableCell>
                    <TableCell>{a}</TableCell>
                    <TableCell>
                      <Chip label={acc.Disabled ? 'Yes' : 'No'} size="small"
                        color={acc.Disabled ? 'error' : 'success'} />
                    </TableCell>
                    <TableCell>
                      {acc.BalanceMap ? Object.entries(acc.BalanceMap).map(([cat, balances]) => (
                        <Box key={cat}>
                          {cat}: {(balances as Balance[]).map(b => b.Value).join(', ')}
                        </Box>
                      )) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" aria-label="View account" onClick={() => handleRowClick(acc)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" aria-label="Delete account" onClick={() => handleDelete(acc)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">No accounts found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
        <Button disabled={page === 0} onClick={() => fetchAccounts(page - 1)}>Previous</Button>
        <Typography sx={{ py: 1 }}>Page {page + 1}</Typography>
        <Button disabled={accounts.length < pageSize} onClick={() => fetchAccounts(page + 1)}>Next</Button>
      </Box>

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
              <Typography><strong>Updated:</strong> {selectedAccount.UpdateTime}</Typography>

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
            </Box>
          ) : (
            <Typography>No detailed data available for this account.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selectedAccount && (
            <>
              <Button color={selectedAccount.Disabled ? 'success' : 'warning'} onClick={() => handleToggle('Disabled')}>
                {selectedAccount.Disabled ? 'Enable Account' : 'Disable Account'}
              </Button>
              <Button
                color={selectedAccount.AllowNegative ? 'error' : 'primary'}
                onClick={() => handleToggle('AllowNegative')}
              >
                {selectedAccount.AllowNegative ? 'Disallow Negative' : 'Allow Negative'}
              </Button>
              <Button color="error" onClick={handleDeleteFromModal}>
                Delete Account
              </Button>
            </>
          )}
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
