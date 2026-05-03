import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  IconButton, Card, CardContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Account, Balance, ActionTriggerEntry, AccountActionPlan } from '../types';

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

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [accountFilter, setAccountFilter] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Create account modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');

  // Execute action
  const [executeActionId, setExecuteActionId] = useState('');
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  // Action plans for selected account
  const [accountActionPlans, setAccountActionPlans] = useState<AccountActionPlan[]>([]);

  // Balance detail sub-modal
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);

  // Action trigger detail sub-modal
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<ActionTriggerEntry | null>(null);

  // Ref for auto-refresh to avoid stale closures
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
      setError(e instanceof Error ? e.message : 'Failed to fetch accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant, accountFilter]);

  // Fetch account details (used for initial load and auto-refresh)
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

  // Auto-refresh account details every 5 seconds when modal is open
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (detailOpen && selectedAccount) {
      const [t, a] = selectedAccount.ID.split(':');
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
    const [t, a] = account.ID.split(':');

    // Set initial data and open the modal
    setSelectedAccount(account);
    setDetailOpen(true);

    try {
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      setSelectedAccount(details?.[0] || account);
    } catch {
      setSelectedAccount(account);
    }

    // Fetch action plans for the account
    try {
      const plans = await api.getAccountActionPlan(baseUrl, t, a) as AccountActionPlan[];
      setAccountActionPlans(Array.isArray(plans) ? plans : []);
    } catch {
      setAccountActionPlans([]);
    }

    // Fetch available actions for execute dropdown
    try {
      const actionsResult = await api.getActions(baseUrl, tenant);
      if (actionsResult) {
        setActionsList(Object.keys(actionsResult));
      }
    } catch {
      setActionsList([]);
    }

    setModalLoading(false);
  }, [baseUrl, tenant]);

  const handleCloseModal = useCallback(() => {
    setDetailOpen(false);
    setSelectedAccount(null);
    setActionsList([]);
    setExecuteActionId('');
    setShowConfirm(false);
    setAccountActionPlans([]);
  }, []);

  const handleDelete = useCallback(async (account: Account) => {
    if (!baseUrl || !window.confirm(`Delete account ${account.ID}?`)) return;
    try {
      const [t, a] = account.ID.split(':');
      await api.removeAccount(baseUrl, t, a);
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, page, fetchAccounts]);

  const handleToggleDisabled = useCallback(async () => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.setAccount(baseUrl, {
        Tenant: t, Account: a, ReloadScheduler: true,
        ExtraOptions: { Disabled: !selectedAccount.Disabled },
      });
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  const handleToggleAllowNegative = useCallback(async () => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.setAccount(baseUrl, {
        Tenant: t, Account: a, ReloadScheduler: true,
        ExtraOptions: { AllowNegative: !selectedAccount.AllowNegative },
      });
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update AllowNegative');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  const handleCreateAccount = useCallback(async () => {
    if (!baseUrl || !newAccountId.trim()) return;
    try {
      await api.setAccount(baseUrl, {
        Tenant: tenant,
        Account: newAccountId.trim(),
        ReloadScheduler: true,
      });
      setCreateOpen(false);
      setNewAccountId('');
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    }
  }, [baseUrl, tenant, newAccountId, page, fetchAccounts]);

  // 2-step confirm for execute action
  const handleExecuteActionClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmExecuteAction = useCallback(async () => {
    if (!baseUrl || !selectedAccount || !executeActionId) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.executeAction(baseUrl, t, a, executeActionId);
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to execute action');
    }
    setShowConfirm(false);
  }, [baseUrl, selectedAccount, executeActionId, fetchAccountDetails]);

  // Remove balance
  const handleRemoveBalance = useCallback(async (balance: Balance, category: string) => {
    if (!baseUrl || !selectedAccount) return;
    if (!window.confirm(`Are you sure you want to remove the balance with ID: ${balance.ID}?`)) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.removeBalances(baseUrl, {
        Tenant: t,
        Account: a,
        BalanceType: category,
        Balance: { ID: balance.ID },
        ActionExtraData: null,
        Cdrlog: true,
      });
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove balance');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  // Remove action trigger
  const handleRemoveActionTrigger = useCallback(async (trigger: ActionTriggerEntry) => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.removeAccountActionTriggers(baseUrl, t, a, trigger.UniqueID);
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove action trigger');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  // Reset action trigger
  const handleResetActionTrigger = useCallback(async (trigger: ActionTriggerEntry) => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.resetAccountActionTriggers(baseUrl, t, a, trigger.UniqueID);
      fetchAccountDetails(t, a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset action trigger');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  // Remove action plan from account
  const handleRemoveActionPlanFromAccount = useCallback(async (plan: AccountActionPlan) => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.removeAccountActionPlans(baseUrl, t, a, [plan.ActionPlanId]);
      fetchAccountDetails(t, a);
      // Refresh action plans
      try {
        const plans = await api.getAccountActionPlan(baseUrl, t, a) as AccountActionPlan[];
        setAccountActionPlans(Array.isArray(plans) ? plans : []);
      } catch {
        setAccountActionPlans([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove action plan from account');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  // Delete action plan globally
  const handleDeleteActionPlanGlobal = useCallback(async (plan: AccountActionPlan) => {
    if (!baseUrl || !selectedAccount) return;
    if (!window.confirm(`Are you sure you want to DELETE the action plan "${plan.ActionPlanId}" globally? This will remove it from all accounts.`)) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.removeActionPlan(baseUrl, plan.ActionPlanId, t);
      fetchAccountDetails(t, a);
      // Refresh action plans
      try {
        const plans = await api.getAccountActionPlan(baseUrl, t, a) as AccountActionPlan[];
        setAccountActionPlans(Array.isArray(plans) ? plans : []);
      } catch {
        setAccountActionPlans([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete action plan globally');
    }
  }, [baseUrl, selectedAccount, fetchAccountDetails]);

  // Delete account from modal
  const handleDeleteFromModal = useCallback(async () => {
    if (!baseUrl || !selectedAccount) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.removeAccount(baseUrl, t, a);
      handleCloseModal();
      fetchAccounts(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
    }
  }, [baseUrl, selectedAccount, page, fetchAccounts, handleCloseModal]);

  // Balance detail modal handlers
  const handleBalanceClick = useCallback((balance: Balance) => {
    setSelectedBalance(balance);
    setBalanceModalOpen(true);
  }, []);

  // Action trigger detail modal handlers
  const handleTriggerClick = useCallback((trigger: ActionTriggerEntry) => {
    setSelectedTrigger(trigger);
    setTriggerModalOpen(true);
  }, []);

  // Render balance table for a given category
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
                <TableRow key={i}>
                  <TableCell>{balance.ID}</TableCell>
                  <TableCell>{formatUsage(balance.Value, category)}</TableCell>
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
                        onClick={() => handleBalanceClick(balance)}>
                        View Balance
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleRemoveBalance(balance, category)}>
                        Remove Balance
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Accounts</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" label="Account" value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            placeholder="Filter by account ID"
          />
          <Button variant="contained" onClick={() => fetchAccounts(0)}>Search</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Create Account</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

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
                const [t, a] = acc.ID.split(':');
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
                      <IconButton size="small" onClick={() => handleRowClick(acc)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(acc)}>
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
          {modalLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedAccount ? (
            <Box>
              <Typography><strong>Allow Negative:</strong> {selectedAccount.AllowNegative ? 'Yes' : 'No'}</Typography>
              <Typography><strong>Disabled:</strong> {selectedAccount.Disabled ? 'Yes' : 'No'}</Typography>
              <Typography><strong>Updated:</strong> {selectedAccount.UpdateTime}</Typography>

              {/* Action Triggers */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6">Action Triggers</Typography>
                {selectedAccount.ActionTriggers && selectedAccount.ActionTriggers.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Action Trigger ID</TableCell>
                          <TableCell>Action</TableCell>
                          <TableCell>Last Execution Time</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAccount.ActionTriggers.map((trigger, i) => {
                          const { prettyDate, timeUntil } = formatExpiration(trigger.LastExecutionTime);
                          return (
                            <TableRow key={i}>
                              <TableCell>
                                {trigger.ID}
                                <br />
                                <Typography variant="caption" color="text.secondary">{trigger.UniqueID}</Typography>
                              </TableCell>
                              <TableCell>{trigger.ActionsID}</TableCell>
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
                                    onClick={() => handleTriggerClick(trigger)}>
                                    View
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
                {accountActionPlans.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    {accountActionPlans.map((plan, index) => {
                      const { prettyDate, timeUntil } = formatExpiration(plan.NextExecTime);
                      return (
                        <Card key={index} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">Action Plan ID</Typography>
                            <Typography variant="body1" fontWeight="bold">{plan.ActionPlanId}</Typography>
                            <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">UUID</Typography>
                                <Typography variant="body2">{plan.Uuid}</Typography>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Actions ID</Typography>
                                <Typography variant="body2">{plan.ActionsId}</Typography>
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
                                Remove Action from Account
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
                  <FormControl size="small" sx={{ minWidth: 250 }}>
                    <InputLabel>Action</InputLabel>
                    <Select value={executeActionId} label="Action" onChange={e => setExecuteActionId(e.target.value)}>
                      {actionsList.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={handleExecuteActionClick} disabled={!executeActionId}>
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

              {/* Balances by category */}
              {selectedAccount.BalanceMap && Object.entries(selectedAccount.BalanceMap).map(([category]) => (
                <Box key={category} sx={{ mt: 3 }}>
                  <Typography variant="h6">{category} Balances</Typography>
                  {renderBalanceTable(selectedAccount.BalanceMap, category)}
                </Box>
              ))}

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2">Raw JSON</Typography>
                <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'grey.50' }}>
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
              <Button color={selectedAccount.Disabled ? 'success' : 'warning'} onClick={handleToggleDisabled}>
                {selectedAccount.Disabled ? 'Enable Account' : 'Disable Account'}
              </Button>
              <Button
                color={selectedAccount.AllowNegative ? 'error' : 'primary'}
                onClick={handleToggleAllowNegative}
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

      {/* Balance Detail Sub-Modal */}
      <Dialog open={balanceModalOpen} onClose={() => { setBalanceModalOpen(false); setSelectedBalance(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Balance Details</DialogTitle>
        <DialogContent>
          {selectedBalance ? (
            <TableContainer>
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
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Account</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Account ID" value={newAccountId}
            onChange={e => setNewAccountId(e.target.value)} sx={{ mt: 1 }}
            placeholder="e.g. 1001" />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Tenant: {tenant}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleCreateAccount} disabled={!newAccountId.trim()}>Create</Button>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
