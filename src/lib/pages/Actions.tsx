import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  TextField, Checkbox, FormControlLabel, Autocomplete, Divider, TablePagination, InputAdornment,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import ExpiryTimeInput from '../components/ExpiryTimeInput';
import { BalanceName, BalanceBucket, IdWithLabel } from '../components/ParsedId';
import { BALANCE_TYPES, BalanceValueDisplay, BalanceValueInput } from '../components/BalanceValue';
import IdMultiSelect, { splitIds, joinIds, stringMapToIds } from '../components/IdMultiSelect';
import { ACTION_TYPES, ACTION_TYPE_LABELS, EXTRA_PARAMETERS_HINTS } from '../cgrConsts';
import { useConfirm } from '../components/ConfirmDialog';
import { formatDateTime } from '../formatTime';

const BALANCE_WEIGHT_OPTIONS = ['*time_desc', '*time_asc'];

interface ActionBalance {
  Uuid?: string;
  ID?: string;
  Type?: string;
  Value?: { Static: number; Method?: string; Params?: Record<string, unknown> | null } | null;
  ExpirationDate?: string;
  Weight?: number | string | null;
  DestinationIDs?: string | Record<string, boolean> | null;
  RatingSubject?: string;
  Categories?: string | Record<string, boolean> | null;
  SharedGroups?: string | Record<string, boolean> | null;
  TimingIDs?: string | Record<string, boolean> | null;
  Timings?: unknown;
  Disabled?: boolean | null;
  Factors?: unknown;
  Blocker?: boolean | null;
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

    // StringMaps become ;-joined strings with "!" kept for excluded IDs, as SetActions parses them.
    const updatedBalance: ActionBalance | null = Balance
      ? {
          ...Balance,
          DestinationIDs: joinIds(stringMapToIds(Balance.DestinationIDs)),
          Categories: joinIds(stringMapToIds(Balance.Categories)),
          SharedGroups: joinIds(stringMapToIds(Balance.SharedGroups)),
          TimingIDs: joinIds(stringMapToIds(Balance.TimingIDs)),
          Weight: Balance.Weight ?? '',
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

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold' }}>{label}</Typography>
      {children}
    </Box>
  );
}

export function ActionTypeLabel({ type }: { type: string }) {
  if (!type) return <Typography variant="body2" color="text.secondary">No action type</Typography>;
  const label = ACTION_TYPE_LABELS[type];
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
      {label && <Typography component="span" variant="body1" sx={{ fontWeight: 500 }}>{label}</Typography>}
      <Typography component="span" variant={label ? 'caption' : 'body1'} color={label ? 'text.secondary' : undefined} sx={{ fontFamily: 'monospace' }}>{type}</Typography>
    </Box>
  );
}

const mono = { fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' } as const;
const json = (v: unknown) => <Box component="pre" sx={{ ...mono, m: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(v, null, 2)}</Box>;
const yesNo = (v: boolean | null | undefined) => v == null ? null : v ? 'Yes' : 'No';

/** Read-only part: fields with a value first, the empty/default ones behind a toggle so nothing is hidden. */
function PartFields({ part }: { part: ActionPart }) {
  const [showAll, setShowAll] = useState(false);
  const b = part.Balance;
  const filters = Array.isArray(part.Filters) ? part.Filters.join(';') : part.Filters || '';
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const fields: { label: string; set: boolean; value: ReactNode }[] = [
    { label: 'Balance ID', set: !!b?.ID, value: b?.ID && <><BalanceName id={b.ID} /><BalanceBucket id={b.ID} balanceType={b.Type} /></> },
    { label: 'Balance Type', set: !!b?.Type, value: b?.Type },
    {
      label: 'Balance Value', set: !!b?.Value && (!!b.Value.Static || !!b.Value.Method),
      value: <>
        <BalanceValueDisplay value={b?.Value?.Static ?? 0} balanceType={b?.Type} />
        {b?.Value?.Method && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Value formula {b.Value.Method} {JSON.stringify(b.Value.Params)}</Typography>}
      </>,
    },
    { label: 'Destination IDs', set: !!str(b?.DestinationIDs), value: str(b?.DestinationIDs) },
    { label: 'Filters', set: !!filters, value: filters },
    { label: 'Expiration', set: !!part.ExpirationString, value: part.ExpirationString },
    { label: 'Weight', set: !!part.Weight, value: String(part.Weight ?? 0) },
    { label: 'Balance Weight', set: b?.Weight != null && b.Weight !== '' && Number(b.Weight) !== 0, value: String(b?.Weight ?? '') },
    { label: 'Balance Categories', set: !!str(b?.Categories), value: str(b?.Categories) },
    { label: 'Balance Shared Groups', set: !!str(b?.SharedGroups), value: str(b?.SharedGroups) },
    { label: 'Balance Timing IDs', set: !!str(b?.TimingIDs), value: str(b?.TimingIDs) },
    { label: 'Rating Subject', set: !!b?.RatingSubject, value: b?.RatingSubject },
    { label: 'Extra Parameters', set: !!part.ExtraParameters, value: part.ExtraParameters && <Box component="pre" sx={{ ...mono, m: 0, whiteSpace: 'pre-wrap' }}>{part.ExtraParameters}</Box> },
    { label: 'Balance Blocker', set: !!b?.Blocker, value: yesNo(b?.Blocker) },
    { label: 'Balance Disabled', set: !!b?.Disabled, value: yesNo(b?.Disabled) },
    { label: 'Balance UUID', set: !!b?.Uuid, value: b?.Uuid && <Box component="span" sx={mono}>{b.Uuid}</Box> },
    {
      label: 'Balance Expiration Date', set: formatDateTime(b?.ExpirationDate) !== '—',
      value: b?.ExpirationDate && <span title={b.ExpirationDate}>{formatDateTime(b.ExpirationDate)}</span>,
    },
    { label: 'Balance Timings', set: b?.Timings != null, value: b?.Timings != null && json(b.Timings) },
    { label: 'Balance Factors', set: b?.Factors != null, value: b?.Factors != null && json(b.Factors) },
  ];
  const setFields = fields.filter(f => f.set);
  const emptyFields = fields.filter(f => !f.set);
  const row = (f: (typeof fields)[number]) => [
    <Typography key={`${f.label}-l`} variant="body2" color="text.secondary">{f.label}</Typography>,
    <Box key={`${f.label}-v`} sx={{ minWidth: 0, typography: 'body2' }}>
      {f.set ? f.value : <Typography variant="body2" color="text.disabled">{f.value || '—'}</Typography>}
    </Box>,
  ];
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, columnGap: 2, rowGap: 1, alignItems: 'baseline' }}>
        {setFields.length ? setFields.flatMap(row) : <Typography variant="body2" color="text.secondary">No fields set</Typography>}
        {showAll && emptyFields.flatMap(row)}
      </Box>
      {emptyFields.length > 0 && (
        <Button size="small" sx={{ mt: 1, ml: -0.5 }} onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Hide empty fields' : `Show all fields (${emptyFields.length} empty or default)`}
        </Button>
      )}
    </>
  );
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
      Weight: '',
      DestinationIDs: '',
      RatingSubject: '',
      Categories: '',
      SharedGroups: '',
      TimingIDs: '',
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
  const [isNew, setIsNew] = useState(false);
  const [newActionId, setNewActionId] = useState('');

  // Execute action state
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [destinationIds, setDestinationIds] = useState<string[]>([]);
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? actions.filter(a => a.id.toLowerCase().includes(q)) : actions;
  }, [actions, search]);
  useEffect(() => setPage(0), [search, actions]);

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
        // Account ID format is "tenant:account"; strip the tenant prefix so the
        // bare account is sent to ExecuteAction (not "tenant:account" as the Account).
        setAccounts(result.map((acc: { ID?: string }) => {
          const id = acc.ID || '';
          const parts = id.split(':');
          return parts.length > 1 ? parts[1] : id;
        }).filter(Boolean));
      } else {
        setAccounts([]);
      }
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [baseUrl, tenant]);

  const fetchDestinationIds = useCallback(async () => {
    if (!baseUrl) return;
    setDestinationIds(await api.getAllTPDestinationIds(baseUrl));
    api.getFilterIDs(baseUrl, tenant).then(r => setFilterIds((r || []).sort())).catch(() => setFilterIds([]));
  }, [baseUrl, tenant]);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (detailOpen) {
      fetchAccounts();
    }
  }, [detailOpen, fetchAccounts]);

  useEffect(() => {
    if (detailOpen && editing) {
      fetchDestinationIds();
    }
  }, [detailOpen, editing, fetchDestinationIds]);

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
      setIsNew(false);
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
      const actionsId = isNew ? newActionId.trim() : selectedAction[0]?.Id || '';
      if (!actionsId) {
        setError('Action ID is required.');
        return;
      }

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
          const value = part.Balance.Value;
          // A value formula (e.g. *incremental) has to go back as JSON or it would collapse to its Static 0.
          action.Units = value?.Method ? JSON.stringify(value) : String(value?.Static || 0);
          action.DestinationIds = String(part.Balance.DestinationIDs || '');
          action.RatingSubject = part.Balance.RatingSubject || '';
          action.Categories = String(part.Balance.Categories || '');
          action.SharedGroups = String(part.Balance.SharedGroups || '');
          action.TimingTags = String(part.Balance.TimingIDs || '');
          const balanceWeight = String(part.Balance.Weight ?? '').trim();
          if (balanceWeight) action.BalanceWeight = balanceWeight;
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
        Overwrite: !isNew,
        Actions: updatedActions,
      });
      setDetailOpen(false);
      fetchActions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, selectedAction, tenant, fetchActions, isNew, newActionId]);

  const handleDelete = useCallback((actionId: string) => {
    if (!baseUrl) return;
    ask({
      title: 'Delete action',
      confirmLabel: 'Delete',
      body: <Typography>Remove action <strong style={{ wordBreak: 'break-all' }}>{actionId}</strong> from tenant {tenant}? CGrateS does not check references, so action plans and triggers that still use it will fail to find it.</Typography>,
      run: async () => {
        await api.removeActions(baseUrl, [actionId], tenant);
        setDetailOpen(false);
        fetchActions();
        return `${actionId} deleted`;
      },
    });
  }, [baseUrl, tenant, fetchActions, ask]);

  const handleCreate = useCallback(() => {
    setSelectedAction([makeEmptyPart()]);
    setEditing(true);
    setIsNew(true);
    setNewActionId('');
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
    ask({
      title: 'Execute action',
      confirmLabel: 'Execute',
      body: <Typography>Run every part of <strong style={{ wordBreak: 'break-all' }}>{actionsId}</strong> on account <strong>{selectedAccount}</strong> now? This changes the live account.</Typography>,
      run: () => api.executeAction(baseUrl, tenant, selectedAccount, actionsId),
    });
  }, [baseUrl, selectedAccount, selectedAction, tenant, ask]);

  const actionId = selectedAction?.[0]?.Id;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Actions</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchActions}>Fetch Actions</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {!detailOpen && outcomeAlert}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <Paper>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Search action ID" value={search} onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 280 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <Typography variant="body2" color="text.secondary">
              {search.trim() ? `${filtered.length} of ${actions.length} actions` : `${actions.length} action${actions.length === 1 ? '' : 's'}`}
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell>Action ID</TableCell>
                  <TableCell align="right" sx={{ width: 80 }}>Parts</TableCell>
                  <TableCell sx={{ width: 48, px: 1 }} align="center" />
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length > 0 ? filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map(a => (
                  <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleRowClick(a.id)}>
                    <TableCell sx={{ maxWidth: 0 }}><IdWithLabel id={a.id} /></TableCell>
                    <TableCell align="right">{a.count}</TableCell>
                    <TableCell sx={{ width: 48, px: 1 }} align="center"><ChevronRightIcon fontSize="small" color="action" /></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center">{actions.length ? 'No actions match' : 'No actions found'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtered.length > 0 && (
            <TablePagination
              component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage} rowsPerPageOptions={[25, 50, 100]}
              onPageChange={(_e, p) => setPage(p)} onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          )}
        </Paper>
      )}

      <Dialog open={detailOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle sx={{ wordBreak: 'break-all' }}>
          {isNew ? 'Create Action' : editing ? 'Edit Action' : 'Action'}
          {actionId && <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{actionId}</Typography>}
        </DialogTitle>
        <DialogContent>
          {detailOpen && outcomeAlert}
          {isNew && (
            <TextField
              label="Action ID" required fullWidth size="small" sx={{ mt: 1, mb: 2 }}
              value={newActionId}
              onChange={e => setNewActionId(e.target.value)}
            />
          )}
          {selectedAction && selectedAction.map((part, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, mt: index === 0 ? 1 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Part {index + 1}</Typography>
                {!editing && <ActionTypeLabel type={part.ActionType || ''} />}
              </Box>

              {editing ? (
                <>
                  <EditField label="ActionType">
                    <SearchableSelect
                      label="ActionType" placeholder="Select action type" value={part.ActionType || ''}
                      options={ACTION_TYPES}
                      onChange={v => handleEditChange(index, 'ActionType', v)} fullWidth sx={{ mt: 0.5 }}
                    />
                  </EditField>
                  <EditField label="DestinationIDs">
                    <IdMultiSelect
                      label="DestinationIDs" sx={{ mt: 0.5 }}
                      options={['*any', ...destinationIds]}
                      value={splitIds(part.Balance?.DestinationIDs as string)}
                      onChange={v => handleEditChange(index, 'Balance.DestinationIDs', joinIds(v))}
                      placeholder="Select or type, prefix ! to exclude"
                    />
                  </EditField>
                  <EditField label="Filters">
                    <IdMultiSelect
                      label="Filters" sx={{ mt: 0.5 }} options={filterIds}
                      value={Array.isArray(part.Filters) ? part.Filters : splitIds(part.Filters)}
                      onChange={v => handleEditChange(index, 'Filters', joinIds(v))}
                      helperText="Checked against each balance before the action applies to it"
                    />
                  </EditField>
                  <EditField label="Expiration">
                    <ExpiryTimeInput value={part.ExpirationString || ''} onChange={v => handleEditChange(index, 'ExpirationString', v)} sx={{ mt: 0.5 }} />
                  </EditField>
                  <EditField label="Weight">
                    <TextField fullWidth size="small" type="number" sx={{ mt: 0.5 }} value={part.Weight ?? 0}
                      onChange={e => handleEditChange(index, 'Weight', e.target.value)} />
                  </EditField>
                  <EditField label="Balance ID">
                    <TextField fullWidth size="small" sx={{ mt: 0.5 }} value={part.Balance?.ID || ''}
                      onChange={e => handleEditChange(index, 'Balance.ID', e.target.value)} />
                  </EditField>
                  <EditField label="Balance Type">
                    <SearchableSelect label="Balance Type" value={part.Balance?.Type || ''} options={BALANCE_TYPES}
                      onChange={v => handleEditChange(index, 'Balance.Type', v)} fullWidth sx={{ mt: 0.5 }} />
                  </EditField>
                  <EditField label="Balance Value">
                    <BalanceValueInput
                      key={part.Balance?.Type || ''}
                      value={part.Balance?.Value?.Static ?? 0}
                      balanceType={part.Balance?.Type}
                      onChange={raw => handleEditChange(index, 'Balance.Value.Static', String(raw))}
                      sx={{ mt: 0.5 }}
                    />
                    {part.Balance?.Value?.Method && (
                      <Typography variant="caption" color="text.secondary">
                        Value formula {part.Balance.Value.Method} {JSON.stringify(part.Balance.Value.Params)}; kept unless you change the value
                      </Typography>
                    )}
                  </EditField>
                  <EditField label="Balance Weight">
                    <Autocomplete<string, false, false, true>
                      freeSolo fullWidth size="small" sx={{ mt: 0.5 }}
                      options={BALANCE_WEIGHT_OPTIONS}
                      value={String(part.Balance?.Weight ?? '')}
                      onInputChange={(_e, v) => handleEditChange(index, 'Balance.Weight', v)}
                      renderInput={params => <TextField {...params} placeholder="Number, or *time_desc / *time_asc to order by when the action is set" />}
                    />
                  </EditField>
                  {(['Categories', 'SharedGroups', 'TimingIDs'] as const).map(field => (
                    <EditField key={field} label={`Balance ${field}`}>
                      <IdMultiSelect
                        label={field} sx={{ mt: 0.5 }} options={[]}
                        value={splitIds(part.Balance?.[field] as string)}
                        onChange={v => handleEditChange(index, `Balance.${field}`, joinIds(v))}
                        placeholder="Type and press Enter, prefix ! to exclude"
                      />
                    </EditField>
                  ))}
                  <EditField label="Rating Subject">
                    <TextField fullWidth size="small" sx={{ mt: 0.5 }} value={part.Balance?.RatingSubject || ''}
                      onChange={e => handleEditChange(index, 'Balance.RatingSubject', e.target.value)} />
                  </EditField>
                  <EditField label="Extra Parameters">
                    <TextField
                      fullWidth multiline minRows={2} size="small" sx={{ mt: 0.5, fontFamily: 'monospace' }}
                      helperText={EXTRA_PARAMETERS_HINTS[part.ActionType || '']}
                      value={typeof part.ExtraParameters === 'string' ? part.ExtraParameters : JSON.stringify(part.ExtraParameters, null, 2)}
                      onChange={e => handleEditChange(index, 'ExtraParameters', e.target.value)}
                    />
                  </EditField>
                  <Box sx={{ mb: 1 }}>
                    <FormControlLabel label="BalanceBlocker" control={
                      <Checkbox checked={!!part.BalanceBlocker} onChange={e => handleEditChange(index, 'BalanceBlocker', e.target.checked)} />
                    } />
                    <FormControlLabel label="BalanceDisabled" control={
                      <Checkbox checked={!!part.Balance?.Disabled} onChange={e => handleEditChange(index, 'Balance.Disabled', e.target.checked)} />
                    } />
                  </Box>
                </>
              ) : <PartFields part={part} />}
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
          {actionId && !isNew && !editing && (
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(actionId)} sx={{ mr: 'auto' }}>
              Delete…
            </Button>
          )}
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save Changes</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          <Box sx={{ width: 16 }} />
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
      {confirmDialog}
    </Box>
  );
}
