import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, MenuItem, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, List, ListItem, ListItemText, Divider, Chip, Autocomplete, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { FilterProfile, FilterRule } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import { useIdOptions, type IdSource } from '../components/useIdOptions';
import { ALL_FILTER_TYPES, VALUELESS_FILTER_TYPES, negateFilterType } from '../cgrConsts';

const filterTypeHints: Record<string, string> = {
  '*string': 'Element equals one of the Values',
  '*contains': 'Element contains one of the Values',
  '*prefix': 'Element starts with one of the Values',
  '*suffix': 'Element ends with one of the Values',
  '*empty': 'Element is empty or missing (no Values)',
  '*exists': 'Element is present (no Values)',
  '*lt': 'Element is less than a Value (numbers, durations or times)',
  '*lte': 'Element is less than or equal to a Value',
  '*gt': 'Element is greater than a Value',
  '*gte': 'Element is greater than or equal to a Value',
  '*eq': 'Element equals a Value numerically',
  '*timings': 'Element (a time) falls in one of the Timing IDs in Values',
  '*destinations': 'Element matches a prefix of one of the Destination IDs in Values',
  '*rsr': 'Element passes one of the RSR filter expressions in Values',
  '*regex': 'Element matches one of the regular expressions in Values',
  '*ipnet': 'Element (an IP) is inside one of the CIDR networks in Values',
  '*ai': 'Element (a time) falls in the activation interval in Values (start;end)',
  '*apiban': 'Element (an IP) is listed by APIBan; Values *single or *all',
  '*sentrypeer': 'Element (a number or IP) is listed by SentryPeer; Values *number or *ip',
  '*http#': 'Type *http#<url>: POSTs the event to the URL, which answers true or false; Values optional',
};

const filterTypes = [...ALL_FILTER_TYPES, '*http#https://'];

function typeHint(type: string): string | undefined {
  if (type.startsWith('*http#')) return filterTypeHints['*http#'];
  if (type.startsWith('*not')) {
    const base = filterTypeHints[negateFilterType(type)];
    return base && `Negation: ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  }
  return filterTypeHints[type];
}

function isValueless(type: string) {
  return VALUELESS_FILTER_TYPES.includes(type) || VALUELESS_FILTER_TYPES.map(negateFilterType).includes(type);
}

function emptyRule(): FilterRule {
  return { Type: '*string', Element: '', Values: [''] };
}

function emptyFilter(tenant: string): FilterProfile {
  return {
    Tenant: tenant,
    ID: '',
    Rules: [emptyRule()],
    ActivationInterval: null,
  };
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FilterProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<FilterProfile>(emptyFilter(defaultTenant));
  const [caching, setCaching] = useState('');

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getFilterIDs(baseUrl, tenant) as string[];
      setIds(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      const result = await api.getFilter(baseUrl, tenant, id) as FilterProfile;
      setDetail(result);
      setEditData(JSON.parse(JSON.stringify(result)));
      setSelectedId(id);
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setFilter(baseUrl, {
        ...editData,
        Rules: editData.Rules.map(r => ({
          ...r,
          Values: isValueless(r.Type) ? [] : r.Values.map(v => v.trim()).filter(Boolean),
        })),
        APIOpts: cachingOpts(caching),
      });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, caching, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeFilter(baseUrl, tenant, id, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditData(emptyFilter(tenant));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  // --- Edit helpers ---
  const updateRule = (ruleIdx: number, field: keyof FilterRule, value: unknown) => {
    setEditData(prev => {
      const rules = [...prev.Rules];
      rules[ruleIdx] = { ...rules[ruleIdx], [field]: value };
      return { ...prev, Rules: rules };
    });
  };

  const addRule = () => {
    setEditData(prev => ({ ...prev, Rules: [...prev.Rules, emptyRule()] }));
  };

  const removeRule = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      Rules: prev.Rules.filter((_, i) => i !== idx),
    }));
  };

  const addValue = (ruleIdx: number) => {
    setEditData(prev => {
      const rules = [...prev.Rules];
      rules[ruleIdx] = { ...rules[ruleIdx], Values: [...rules[ruleIdx].Values, ''] };
      return { ...prev, Rules: rules };
    });
  };

  const removeValue = (ruleIdx: number, valIdx: number) => {
    setEditData(prev => {
      const rules = [...prev.Rules];
      rules[ruleIdx] = {
        ...rules[ruleIdx],
        Values: rules[ruleIdx].Values.filter((_, i) => i !== valIdx),
      };
      return { ...prev, Rules: rules };
    });
  };

  const updateValue = (ruleIdx: number, valIdx: number, value: string) => {
    setEditData(prev => {
      const rules = [...prev.Rules];
      const values = [...rules[ruleIdx].Values];
      values[valIdx] = value;
      rules[ruleIdx] = { ...rules[ruleIdx], Values: values };
      return { ...prev, Rules: rules };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Filter Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
          <CachingSelect value={caching} onChange={setCaching} />
        </Box>
      </Paper>

      <FilterIndexTools tenant={tenant} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>ID</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ids.length > 0 ? ids.map((id, idx) => (
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(id)}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{id}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); fetchDetail(id); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(id); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No items found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New Filter'}</DialogTitle>
        <DialogContent dividers>
          {editing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Tenant" size="small" fullWidth
                value={editData.Tenant}
                onChange={e => setEditData(prev => ({ ...prev, Tenant: e.target.value }))}
              />
              <TextField
                label="ID" size="small" fullWidth
                value={editData.ID}
                onChange={e => setEditData(prev => ({ ...prev, ID: e.target.value }))}
                disabled={!!selectedId}
              />
              <ActivationIntervalInput
                value={editData.ActivationInterval}
                onChange={v => setEditData(prev => ({ ...prev, ActivationInterval: v }))}
              />

              <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>Rules</Typography>

              {editData.Rules.map((rule, ruleIdx) => (
                <Paper key={ruleIdx} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Rule {ruleIdx + 1}</Typography>
                    <IconButton size="small" color="error" onClick={() => removeRule(ruleIdx)} disabled={editData.Rules.length <= 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Autocomplete<string, false, false, true>
                    freeSolo size="small" sx={{ mb: 1 }}
                    options={filterTypes}
                    value={rule.Type}
                    onInputChange={(_e, v) => updateRule(ruleIdx, 'Type', v)}
                    renderInput={p => <TextField {...p} label="Type" />}
                  />
                  {typeHint(rule.Type) ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {typeHint(rule.Type)}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
                      Not a filter type CGrateS supports; saving will fail
                    </Typography>
                  )}

                  <TextField
                    label="Element" size="small" fullWidth sx={{ mb: 1 }}
                    value={rule.Element}
                    onChange={e => updateRule(ruleIdx, 'Element', e.target.value)}
                    placeholder="e.g. ~*req.Account"
                  />

                  {!isValueless(rule.Type) && (
                    <>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Values</Typography>
                      {rule.Values.map((val, valIdx) => (
                        <Box key={valIdx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                          <TextField
                            size="small" fullWidth
                            value={val}
                            onChange={e => updateValue(ruleIdx, valIdx, e.target.value)}
                            placeholder="Value"
                          />
                          <IconButton size="small" color="error" onClick={() => removeValue(ruleIdx, valIdx)} disabled={rule.Values.length <= 1}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addValue(ruleIdx)}>Add Value</Button>
                    </>
                  )}
                </Paper>
              ))}

              <Button variant="outlined" startIcon={<AddIcon />} onClick={addRule}>Add Rule</Button>
            </Box>
          ) : (
            /* --- View mode --- */
            detail && (
              <List dense>
                <ListItem>
                  <ListItemText primary="Tenant" secondary={(detail as FilterProfile).Tenant} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="ID" secondary={(detail as FilterProfile).ID} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Activation Interval"
                    secondary={formatActivationInterval((detail as FilterProfile).ActivationInterval)}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Rules ({(detail as FilterProfile).Rules?.length || 0})</Typography>
                  {(detail as FilterProfile).Rules?.map((rule, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5, mb: 1, width: '100%' }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Chip label={rule.Type} size="small" color="primary" variant="outlined" />
                        <Typography variant="body2"><strong>Element:</strong> {rule.Element}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">Values:</Typography>
                        {rule.Values?.map((v, vi) => (
                          <Chip key={vi} label={v} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Paper>
                  ))}
                </ListItem>
              </List>
            )
          )}
        </DialogContent>
        <DialogActions>
          {editing ? (
            <Button variant="contained" onClick={handleSave}>Save</Button>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          )}
          {selectedId && <Button color="error" onClick={() => handleDelete(selectedId)}>Delete</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface IndexItemType {
  value: string;
  label: string;
  computeFlag: string;
  idsKey: string;
  source: IdSource | null;
  needsContext: boolean;
}

// Argument names from APIerSv1 Get/Compute/RemoveFilterIndexes (apier/v1/filter_indexes.go).
const INDEX_ITEM_TYPES: IndexItemType[] = [
  { value: '*attributes', label: 'Attributes', computeFlag: 'AttributeS', idsKey: 'AttributeIDs', source: 'attributes', needsContext: true },
  { value: '*chargers', label: 'Chargers', computeFlag: 'ChargerS', idsKey: 'ChargerIDs', source: 'chargers', needsContext: false },
  { value: '*resources', label: 'Resources', computeFlag: 'ResourceS', idsKey: 'ResourceIDs', source: 'resources', needsContext: false },
  { value: '*stats', label: 'Stats', computeFlag: 'StatS', idsKey: 'StatIDs', source: 'stats', needsContext: false },
  { value: '*thresholds', label: 'Thresholds', computeFlag: 'ThresholdS', idsKey: 'ThresholdIDs', source: 'thresholds', needsContext: false },
  { value: '*routes', label: 'Routes', computeFlag: 'RouteS', idsKey: 'RouteIDs', source: 'routes', needsContext: false },
  { value: '*dispatchers', label: 'Dispatchers', computeFlag: 'DispatcherS', idsKey: 'DispatcherIDs', source: null, needsContext: true },
];

type IndexAction = 'compute' | 'computeIDs' | 'remove';

function FilterIndexTools({ tenant }: { tenant: string }) {
  const baseUrl = useOcsBaseUrl();
  const [itemType, setItemType] = useState(INDEX_ITEM_TYPES[0].value);
  const [context, setContext] = useState('*any');
  const [filterType, setFilterType] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [indexes, setIndexes] = useState<string[] | null>(null);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [caching, setCaching] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<IndexAction | null>(null);
  const [expanded, setExpanded] = useState(false);
  const it = INDEX_ITEM_TYPES.find(t => t.value === itemType)!;
  const idOptions = useIdOptions(it.source ? [it.source] : [], tenant, expanded);
  const ctx = it.needsContext ? { Context: context.trim() } : {};
  const contextMissing = it.needsContext && !context.trim();

  useEffect(() => { setIndexes(null); setProfileIds([]); }, [itemType, tenant]);

  const fetchIndexes = async () => {
    if (!baseUrl) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const params: Record<string, unknown> = { Tenant: tenant, ItemType: itemType, ...ctx };
      if (filterType.trim()) params.FilterType = filterType.trim();
      if (filterField.trim()) params.FilterField = filterField.trim();
      if (filterValue.trim()) params.FilterValue = filterValue.trim();
      setIndexes(await api.getFilterIndexes(baseUrl, params));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'NOT_FOUND') setIndexes([]);
      else setError(e instanceof Error ? e.message : 'Failed to fetch indexes');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: IndexAction) => {
    if (!baseUrl) return;
    setConfirm(null);
    setBusy(true);
    setError(null);
    setMessage(null);
    const base = { Tenant: tenant, ...ctx, APIOpts: cachingOpts(caching) };
    try {
      if (action === 'compute') await api.computeFilterIndexes(baseUrl, { ...base, [it.computeFlag]: true });
      else if (action === 'computeIDs') await api.computeFilterIndexIDs(baseUrl, { ...base, [it.idsKey]: profileIds });
      else await api.removeFilterIndexes(baseUrl, { ...base, ItemType: itemType });
      setMessage(`${action === 'remove' ? 'Removed' : 'Computed'} ${it.label} indexes`);
      if (indexes) fetchIndexes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmText: Record<IndexAction, string> = {
    compute: `Rebuild the filter indexes of every ${it.label} profile in ${tenant}${it.needsContext ? ` (context ${context})` : ''}. Existing index entries are kept; this can take a while on large data sets.`,
    computeIDs: `Rebuild the filter indexes of ${profileIds.join(', ')}.`,
    remove: `Delete ALL ${it.label} filter indexes in ${tenant}${it.needsContext ? ` (context ${context})` : ''}. Until they are computed again, indexed lookups (indexed_selects) will not find these profiles.`,
  };

  return (
    <Accordion sx={{ mb: 2 }} expanded={expanded} onChange={(_e, v) => setExpanded(v)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Filter indexes</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label="Subsystem" value={itemType} onChange={e => setItemType(e.target.value)} sx={{ minWidth: 180 }}>
              {INDEX_ITEM_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label} ({t.value})</MenuItem>)}
            </TextField>
            {it.needsContext && (
              <TextField size="small" label="Context" value={context} onChange={e => setContext(e.target.value)} required
                helperText="Indexes are kept per context" />
            )}
            <TextField size="small" label="Filter type" value={filterType} onChange={e => setFilterType(e.target.value)} placeholder="*string" />
            <TextField size="small" label="Field contains" value={filterField} onChange={e => setFilterField(e.target.value)} placeholder="*req.Account" />
            <TextField size="small" label="Value contains" value={filterValue} onChange={e => setFilterValue(e.target.value)} />
            <Button variant="contained" onClick={fetchIndexes} disabled={busy || contextMissing}>Show indexes</Button>
          </Box>

          {indexes && (
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="caption" color="text.secondary">{indexes.length} entries (type:field:value:profile)</Typography>
              <pre style={{ fontSize: 12, margin: 0 }}>{[...indexes].sort().join('\n')}</pre>
            </Paper>
          )}

          <Divider />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <CachingSelect value={caching} onChange={setCaching} />
            <Button variant="outlined" onClick={() => setConfirm('compute')} disabled={busy || contextMissing}>Compute all {it.label}</Button>
            <Button variant="outlined" color="error" onClick={() => setConfirm('remove')} disabled={busy || contextMissing}>Remove {it.label} indexes</Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <IdMultiSelect label={`${it.label} profile IDs`} value={profileIds} options={it.source ? idOptions.get(it.source) : []}
              onChange={setProfileIds} sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => setConfirm('computeIDs')} disabled={busy || contextMissing || !profileIds.length}>
              Compute for these IDs
            </Button>
          </Box>
          {idOptions.error && <Alert severity="warning">{idOptions.error}</Alert>}
          {busy && <CircularProgress size={24} />}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
        </Box>
      </AccordionDetails>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{confirm === 'remove' ? 'Remove filter indexes?' : 'Compute filter indexes?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirm && confirmText[confirm]}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" color={confirm === 'remove' ? 'error' : 'primary'} onClick={() => confirm && runAction(confirm)}>
            {confirm === 'remove' ? 'Remove' : 'Compute'}
          </Button>
        </DialogActions>
      </Dialog>
    </Accordion>
  );
}
