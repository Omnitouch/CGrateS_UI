import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  TextField, IconButton, Checkbox, FormControlLabel, Autocomplete, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

const ACTION_TYPES = [
  '*log',
  '*reset_triggers',
  '*cdrlog',
  '*set_recurrent',
  '*unset_recurrent',
  '*allow_negative',
  '*deny_negative',
  '*reset_account',
  '*topup_reset',
  '*topup',
  '*debit_reset',
  '*debit',
  '*reset_counters',
  '*enable_account',
  '*disable_account',
  '*http_post',
  '*http_post_async',
  '*mail_async',
  '*set_ddestinations',
  '*remove_account',
  '*remove_balance',
  '*set_balance',
  '*transfer_monetary_default',
  '*cgr_rpc',
  '*topup_zero_negative',
  '*set_expiry',
  '*publish_account',
  '*publish_balance',
  '*remove_session_costs',
  '*remove_expired',
  '*cdr_account',
];

interface ActionBalance {
  Uuid?: string;
  ID?: string;
  Type?: string;
  Value?: { Static: number };
  ExpirationDate?: string;
  Weight?: number;
  DestinationIDs?: string | Record<string, boolean>;
  RatingSubject?: string;
  Categories?: Record<string, unknown>;
  SharedGroups?: Record<string, unknown>;
  TimingIDs?: Record<string, unknown>;
  Timings?: unknown;
  Disabled?: boolean | null;
  Factors?: unknown;
  Blocker?: boolean;
}

interface ActionPart {
  Id?: string;
  Identifier?: string;
  ActionType?: string;
  ExtraParameters?: string;
  Filters?: string | string[];
  ExpirationString?: string;
  Weight?: number;
  Balance?: ActionBalance | null;
  BalanceBlocker?: boolean;
}

function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function normalizeActionParts(parts: ActionPart[]): ActionPart[] {
  return parts.map((part) => {
    const { Balance, ExtraParameters } = part;

    const updatedBalance: ActionBalance | null = Balance
      ? {
          ...Balance,
          DestinationIDs: Balance.DestinationIDs
            ? typeof Balance.DestinationIDs === 'object'
              ? Object.keys(Balance.DestinationIDs).join(';')
              : Balance.DestinationIDs
            : '',
        }
      : null;

    const balanceBlocker = Balance?.Blocker === true;

    let parsedExtraParameters = ExtraParameters || '';
    if (parsedExtraParameters && isValidJson(parsedExtraParameters)) {
      parsedExtraParameters = JSON.stringify(JSON.parse(parsedExtraParameters), null, 2);
    }

    return {
      ...part,
      ActionType: part.ActionType || part.Identifier || '',
      Balance: updatedBalance,
      BalanceBlocker: balanceBlocker,
      ExtraParameters: parsedExtraParameters,
    };
  });
}

function makeEmptyPart(): ActionPart {
  return {
    Id: '',
    ActionType: '',
    ExtraParameters: '',
    Filters: '',
    ExpirationString: '',
    Weight: 0,
    Balance: {
      Uuid: '',
      ID: '',
      Type: '',
      Value: { Static: 0 },
      ExpirationDate: '',
      Weight: 0,
      DestinationIDs: '',
      RatingSubject: '',
      Categories: {},
      SharedGroups: {},
      TimingIDs: {},
      Timings: null,
      Disabled: null,
      Factors: null,
    },
    BalanceBlocker: false,
  };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [actions, setActions] = useState<{ id: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionPart[] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Execute action state
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const fetchActions = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getActions(baseUrl, tenant);
      if (result) {
        setActions(Object.entries(result).map(([id, details]) => ({
          id,
          count: Array.isArray(details) ? (details as unknown[]).length : 0,
        })));
      } else {
        setActions([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  // Fetch accounts for execute action dropdown
  const fetchAccounts = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setAccountsLoading(true);
    try {
      const result = await api.getAccounts(baseUrl, tenant, 0, 500);
      if (result && Array.isArray(result)) {
        setAccounts(result.map((acc: { ID?: string }) => acc.ID || '').filter(Boolean));
      } else {
        setAccounts([]);
      }
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [baseUrl, tenant]);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (detailOpen) {
      fetchAccounts();
    }
  }, [detailOpen, fetchAccounts]);

  // Clear selected account when tenant changes
  useEffect(() => {
    setSelectedAccount(null);
  }, [tenant]);

  const handleRowClick = useCallback(async (actionId: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getActions(baseUrl, tenant);
      const details = result?.[actionId];
      if (Array.isArray(details)) {
        setSelectedAction(normalizeActionParts(details as ActionPart[]));
      } else {
        setSelectedAction(null);
      }
      setEditing(false);
      setSelectedAccount(null);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    }
  }, [baseUrl, tenant]);

  const handleEditChange = useCallback((index: number, field: string, value: unknown) => {
    setSelectedAction(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      const part = { ...updated[index] };
      const fieldParts = field.split('.');

      if (fieldParts[0] === 'Balance' && fieldParts[1] === 'Value' && fieldParts[2] === 'Static') {
        part.Balance = {
          ...part.Balance,
          Value: { Static: parseFloat(value as string) || 0 },
        };
      } else if (field === 'Weight') {
        part.Weight = parseFloat(value as string) || 0;
      } else if (field === 'BalanceBlocker') {
        part.BalanceBlocker = value as boolean;
      } else if (fieldParts.length === 2 && fieldParts[0] === 'Balance') {
        part.Balance = {
          ...part.Balance,
          [fieldParts[1]]: value,
        };
      } else {
        (part as Record<string, unknown>)[field] = value;
      }

      updated[index] = part;
      return updated;
    });
  }, []);

  const handleAddPart = useCallback(() => {
    setSelectedAction(prev => prev ? [...prev, makeEmptyPart()] : [makeEmptyPart()]);
  }, []);

  const handleRemovePart = useCallback((index: number) => {
    setSelectedAction(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!baseUrl || !selectedAction || selectedAction.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const actionsId = selectedAction[0]?.Id || '';

      const updatedActions = selectedAction.map((part) => {
        const action: Record<string, unknown> = {
          Identifier: part.Identifier || part.ActionType,
          ExtraParameters: part.ExtraParameters || '',
          ExpiryTime: part.ExpirationString || '',
          Weight: part.Weight || 0,
        };

        if (part.Balance) {
          if (part.Balance.ID) action.BalanceId = part.Balance.ID;
          if (part.Balance.Uuid) action.BalanceUuid = part.Balance.Uuid;
          if (part.Balance.Type) action.BalanceType = part.Balance.Type;
          if (typeof part.BalanceBlocker === 'boolean') {
            action.BalanceBlocker = part.BalanceBlocker ? 'true' : 'false';
          }
          if (typeof part.Balance.Disabled === 'boolean') {
            action.BalanceDisabled = part.Balance.Disabled ? 'true' : 'false';
          }
          action.Directions = '*out';
          action.Units = part.Balance.Value?.Static || 0;
          action.DestinationIds =
            typeof part.Balance.DestinationIDs === 'object' && part.Balance.DestinationIDs
              ? Object.keys(part.Balance.DestinationIDs as Record<string, boolean>).join(';')
              : part.Balance.DestinationIDs || '';
          action.RatingSubject = part.Balance.RatingSubject || '';
          action.Categories = '';
          action.SharedGroups = '';
          action.TimingTags = '';
          action.TimingIDs = '';
          action.BalanceWeight = part.Balance.Weight || 0;
        }

        if (part.Filters) {
          action.Filters = Array.isArray(part.Filters)
            ? part.Filters.join(';')
            : part.Filters || '';
        }

        return action;
      });

      await api.setActions(baseUrl, {
        ActionsId: actionsId,
        Tenant: tenant,
        Overwrite: true,
        Actions: updatedActions,
      });
      setDetailOpen(false);
      fetchActions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, selectedAction, tenant, fetchActions]);

  const handleDelete = useCallback(async (actionId: string) => {
    if (!baseUrl || !window.confirm(`Delete action ${actionId}?`)) return;
    try {
      await api.removeActions(baseUrl, [actionId], tenant);
      fetchActions();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchActions]);

  const handleCreate = useCallback(() => {
    setSelectedAction([makeEmptyPart()]);
    setEditing(true);
    setSelectedAccount(null);
    setDetailOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setDetailOpen(false);
    setSelectedAction(null);
    setSelectedAccount(null);
    setError(null);
  }, []);

  const handleExecuteAction = useCallback(async () => {
    if (!baseUrl || !selectedAccount || !selectedAction) {
      setError('Please select an action and an account.');
      return;
    }
    const actionsId = selectedAction[0]?.Id;
    if (!actionsId) {
      setError('Action has no ID.');
      return;
    }
    try {
      const result = await api.executeAction(baseUrl, tenant, selectedAccount, actionsId);
      if (result) {
        setError(null);
        alert('Action executed successfully!');
      } else {
        setError('Failed to execute action.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to execute action');
    }
  }, [baseUrl, selectedAccount, selectedAction, tenant]);

  const actionId = selectedAction?.[0]?.Id;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Actions</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchActions}>Fetch Actions</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Action ID</TableCell>
                <TableCell>Parts</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.length > 0 ? actions.map((a, i) => (
                <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(a.id)}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{a.id}</TableCell>
                  <TableCell>{a.count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(a.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">No actions found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {editing ? 'Edit Action' : 'Action Details'}
          {actionId ? ` for ${actionId}` : ''}
        </DialogTitle>
        <DialogContent>
          {selectedAction && selectedAction.map((part, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, mt: index === 0 ? 1 : 0 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                Part {index + 1}
              </Typography>

              {/* ActionType */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>ActionType</Typography>
                {editing ? (
                  <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                    <Select
                      value={part.ActionType || ''}
                      onChange={e => handleEditChange(index, 'ActionType', e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="" disabled><em>Select action type</em></MenuItem>
                      {ACTION_TYPES.map(type => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography variant="body1">{part.ActionType || 'N/A'}</Typography>
                )}
              </Box>

              {/* DestinationIDs */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>DestinationIDs</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" sx={{ mt: 0.5 }}
                    value={part.Balance?.DestinationIDs || ''}
                    onChange={e => handleEditChange(index, 'Balance.DestinationIDs', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{(part.Balance?.DestinationIDs as string) || 'N/A'}</Typography>
                )}
              </Box>

              {/* Filters */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Filters</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" sx={{ mt: 0.5 }}
                    value={Array.isArray(part.Filters) ? part.Filters.join(';') : (part.Filters || '')}
                    onChange={e => handleEditChange(index, 'Filters', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">
                    {Array.isArray(part.Filters) ? part.Filters.join(';') : (part.Filters || 'N/A')}
                  </Typography>
                )}
              </Box>

              {/* Expiration */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Expiration</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" sx={{ mt: 0.5 }}
                    value={part.ExpirationString || ''}
                    onChange={e => handleEditChange(index, 'ExpirationString', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{part.ExpirationString || 'N/A'}</Typography>
                )}
              </Box>

              {/* Weight */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Weight</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" type="number" sx={{ mt: 0.5 }}
                    value={part.Weight ?? 0}
                    onChange={e => handleEditChange(index, 'Weight', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{part.Weight ?? 0}</Typography>
                )}
              </Box>

              {/* Balance ID */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Balance ID</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" sx={{ mt: 0.5 }}
                    value={part.Balance?.ID || ''}
                    onChange={e => handleEditChange(index, 'Balance.ID', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{part.Balance?.ID || 'N/A'}</Typography>
                )}
              </Box>

              {/* Balance Type */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Balance Type</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" sx={{ mt: 0.5 }}
                    value={part.Balance?.Type || ''}
                    onChange={e => handleEditChange(index, 'Balance.Type', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{part.Balance?.Type || 'N/A'}</Typography>
                )}
              </Box>

              {/* Balance Value */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Balance Value</Typography>
                {editing ? (
                  <TextField
                    fullWidth size="small" type="text" sx={{ mt: 0.5 }}
                    value={part.Balance?.Value?.Static?.toString() || '0'}
                    onChange={e => handleEditChange(index, 'Balance.Value.Static', e.target.value)}
                  />
                ) : (
                  <Typography variant="body1">{part.Balance?.Value?.Static ?? 0}</Typography>
                )}
              </Box>

              {/* ExtraParameters */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Extra Parameters</Typography>
                {editing ? (
                  <TextField
                    fullWidth multiline minRows={2} size="small" sx={{ mt: 0.5, fontFamily: 'monospace' }}
                    value={typeof part.ExtraParameters === 'string'
                      ? part.ExtraParameters
                      : JSON.stringify(part.ExtraParameters, null, 2)}
                    onChange={e => handleEditChange(index, 'ExtraParameters', e.target.value)}
                  />
                ) : (
                  <Box component="pre" sx={{ fontSize: 12, m: 0, whiteSpace: 'pre-wrap' }}>
                    {typeof part.ExtraParameters === 'string'
                      ? part.ExtraParameters || 'N/A'
                      : JSON.stringify(part.ExtraParameters, null, 2)}
                  </Box>
                )}
              </Box>

              {/* BalanceBlocker */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>BalanceBlocker</Typography>
                {editing ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!part.BalanceBlocker}
                        onChange={e => handleEditChange(index, 'BalanceBlocker', e.target.checked)}
                      />
                    }
                    label="BalanceBlocker"
                  />
                ) : (
                  <Typography variant="body1">{part.BalanceBlocker ? 'Yes' : 'No'}</Typography>
                )}
              </Box>

              {/* Remove Part button */}
              {editing && selectedAction.length > 1 && (
                <Button
                  variant="outlined" color="error" size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleRemovePart(index)}
                >
                  Remove Part
                </Button>
              )}
            </Paper>
          ))}

          {/* Add Part button */}
          {editing && (
            <Button
              variant="outlined" startIcon={<AddIcon />}
              onClick={handleAddPart} sx={{ mb: 2 }}
            >
              Add New Part
            </Button>
          )}

          {/* Execute Action section */}
          {actionId && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Execute Action
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Autocomplete
                  sx={{ minWidth: 300, flexGrow: 1 }}
                  size="small"
                  options={accounts}
                  value={selectedAccount}
                  onChange={(_e, value) => setSelectedAccount(value)}
                  loading={accountsLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Account"
                      placeholder="Select account"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {accountsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleExecuteAction}
                  disabled={!selectedAccount}
                >
                  Execute
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save Changes</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          {actionId && (
            <Button color="error" onClick={() => handleDelete(actionId)}>Delete</Button>
          )}
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
