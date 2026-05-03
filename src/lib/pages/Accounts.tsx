import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { Account } from '../types';

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

  // Create account modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');

  // Execute action
  const [executeActionId, setExecuteActionId] = useState('');
  const [actionsList, setActionsList] = useState<string[]>([]);

  // Action plans for selected account
  const [accountActionPlans, setAccountActionPlans] = useState<unknown[]>([]);

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

  const handleRowClick = useCallback(async (account: Account) => {
    if (!baseUrl) return;
    try {
      const [t, a] = account.ID.split(':');
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      setSelectedAccount(details?.[0] || account);

      // Fetch action plans for the account
      try {
        const plans = await api.getAccountActionPlan(baseUrl, t, a);
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
    } catch {
      setSelectedAccount(account);
    }
    setDetailOpen(true);
  }, [baseUrl, tenant]);

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
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      setSelectedAccount(details?.[0] || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  }, [baseUrl, selectedAccount]);

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

  const handleExecuteAction = useCallback(async () => {
    if (!baseUrl || !selectedAccount || !executeActionId) return;
    const [t, a] = selectedAccount.ID.split(':');
    try {
      await api.executeAction(baseUrl, t, a, executeActionId);
      alert('Action executed successfully!');
      // Refresh account details
      const details = await api.getAccounts(baseUrl, t, 0, 1, [a]) as Account[];
      setSelectedAccount(details?.[0] || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to execute action');
    }
  }, [baseUrl, selectedAccount, executeActionId]);

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
                          {cat}: {(balances as Array<{ Value: number }>).map(b => b.Value).join(', ')}
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
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Account Details - {selectedAccount?.ID}</DialogTitle>
        <DialogContent>
          {selectedAccount && (
            <Box>
              <Typography><strong>Allow Negative:</strong> {selectedAccount.AllowNegative ? 'Yes' : 'No'}</Typography>
              <Typography><strong>Disabled:</strong> {selectedAccount.Disabled ? 'Yes' : 'No'}</Typography>
              <Typography><strong>Updated:</strong> {selectedAccount.UpdateTime}</Typography>

              {selectedAccount.BalanceMap && Object.entries(selectedAccount.BalanceMap).map(([cat, balances]) => (
                <Box key={cat} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">{cat} Balances</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell>Weight</TableCell>
                          <TableCell>Expiration</TableCell>
                          <TableCell>Blocker</TableCell>
                          <TableCell>Disabled</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(balances as Array<{ ID: string; Value: number; Weight: number; ExpirationDate: string; Blocker: boolean; Disabled: boolean | null }>).map((b, i) => (
                          <TableRow key={i}>
                            <TableCell>{b.ID}</TableCell>
                            <TableCell>{b.Value}</TableCell>
                            <TableCell>{b.Weight}</TableCell>
                            <TableCell>{b.ExpirationDate || 'N/A'}</TableCell>
                            <TableCell>{b.Blocker ? 'Yes' : 'No'}</TableCell>
                            <TableCell>{b.Disabled ? 'Yes' : 'No'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ))}

              {selectedAccount.ActionTriggers && selectedAccount.ActionTriggers.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Action Triggers</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Threshold Type</TableCell>
                          <TableCell>Threshold Value</TableCell>
                          <TableCell>Actions ID</TableCell>
                          <TableCell>Executed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAccount.ActionTriggers.map((at, i) => (
                          <TableRow key={i}>
                            <TableCell>{at.ID}</TableCell>
                            <TableCell>{at.ThresholdType}</TableCell>
                            <TableCell>{at.ThresholdValue}</TableCell>
                            <TableCell>{at.ActionsID}</TableCell>
                            <TableCell>{at.Executed ? 'Yes' : 'No'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {accountActionPlans.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Action Plans</Typography>
                  <Paper sx={{ p: 1, maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50' }}>
                    <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(accountActionPlans, null, 2)}</pre>
                  </Paper>
                </Box>
              )}

              {/* Execute Action */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1">Execute Action</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mt: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 250 }}>
                    <InputLabel>Action</InputLabel>
                    <Select value={executeActionId} label="Action" onChange={e => setExecuteActionId(e.target.value)}>
                      {actionsList.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={handleExecuteAction} disabled={!executeActionId}>Execute</Button>
                </Box>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Raw JSON</Typography>
                <Paper sx={{ p: 1, maxHeight: 300, overflow: 'auto', bgcolor: 'grey.50' }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(selectedAccount, null, 2)}</pre>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button color={selectedAccount?.Disabled ? 'success' : 'warning'} onClick={handleToggleDisabled}>
            {selectedAccount?.Disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
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
