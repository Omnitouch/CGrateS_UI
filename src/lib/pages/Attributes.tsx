import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Accordion, AccordionSummary, AccordionDetails, Chip, Divider, Autocomplete,
  Checkbox, FormControlLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { AttributeProfile, AttributeEntry } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';

// Substitution types handled by engine.ParseAttribute; a value of *remove deletes the field instead.
const attributeTypeHints: Record<string, string> = {
  '*constant': '1 value: set the field to this text (*remove deletes the field)',
  '*variable': 'Value(s) parsed from the event and concatenated, e.g. ~*req.Account',
  '*composed': "Like *variable, but appended to the field's current value",
  '*usage_difference': '2 values: end time, start time; sets the duration between them',
  '*sum': '2+ values: their sum',
  '*difference': '2+ values: first minus the rest (numbers, durations or times)',
  '*multiply': '2+ values: their product',
  '*divide': '2+ values: first divided by the rest',
  '*value_exponent': '2 values: number, exponent; sets number * 10^exponent',
  '*unix_timestamp': '1 value: a time, converted to Unix seconds',
  '*datetime': '1 value: a time, converted to RFC3339',
  '*prefix': "1 value: put in front of the field's current value",
  '*suffix': "1 value: appended to the field's current value",
  '*cc_usage': '3 values: CC request number, used time, debit interval; sets the total usage',
  '*sipcid': '1+ values: SIP Call-ID followed by tags, joined with ";" (tags sorted)',
  '*none': 'No change to the event',
  '*http#': 'Type *http#<url>: POSTs the event to the URL and uses the reply; values unused',
};

const attributeTypes = Object.keys(attributeTypeHints).map(t => (t === '*http#' ? '*http#https://' : t));

const CONTEXTS = ['*any', '*sessions', '*cdrs', '*chargers', '*routes', '*thresholds', '*stats', '*resources'];

function typeHint(type: string): string | undefined {
  return attributeTypeHints[type.startsWith('*http#') ? '*http#' : type];
}

function nonBlank(ids: string[] | null | undefined): string[] {
  return (ids || []).map(s => s.trim()).filter(Boolean);
}

function emptyAttributeRule(): { Rules: string } {
  return { Rules: '' };
}

function emptyAttribute(): AttributeEntry {
  return { Path: '', Type: '*constant', Value: [emptyAttributeRule()], FilterIDs: [] };
}

function emptyProfile(tenant: string): AttributeProfile {
  return {
    Tenant: tenant,
    ID: '',
    Contexts: ['*any'],
    FilterIDs: [],
    ActivationInterval: null,
    Attributes: [emptyAttribute()],
    Blocker: false,
    Weight: 0,
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
  const [detail, setDetail] = useState<AttributeProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<AttributeProfile>(emptyProfile(defaultTenant));
  const [caching, setCaching] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const idOptions = useIdOptions(['filters'], tenant, detailOpen && editing);
  const testerOptions = useIdOptions(['attributes'], tenant, true);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const [result, total] = await Promise.all([
        api.getAttributeProfileIDs(baseUrl, tenant),
        api.getAttributeProfileCount(baseUrl, tenant),
      ]);
      setIds(result || []);
      setCount(total);
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
      const result = await api.getAttributeProfile(baseUrl, tenant, id) as AttributeProfile;
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
      await api.setAttributeProfile(baseUrl, {
        ...editData,
        FilterIDs: nonBlank(editData.FilterIDs),
        Attributes: editData.Attributes.map(a => ({ ...a, FilterIDs: nonBlank(a.FilterIDs) })),
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
      await api.removeAttributeProfile(baseUrl, tenant, id, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setSelectedId(null);
    setEditData(emptyProfile(tenant));
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  // --- Edit helpers for Attributes ---
  const updateAttr = (idx: number, field: keyof AttributeEntry, value: unknown) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      attrs[idx] = { ...attrs[idx], [field]: value };
      return { ...prev, Attributes: attrs };
    });
  };

  const addAttr = () => {
    setEditData(prev => ({ ...prev, Attributes: [...prev.Attributes, emptyAttribute()] }));
  };

  const removeAttr = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      Attributes: prev.Attributes.filter((_, i) => i !== idx),
    }));
  };

  // Rules within an attribute
  const addAttrRule = (attrIdx: number) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      attrs[attrIdx] = {
        ...attrs[attrIdx],
        Value: [...attrs[attrIdx].Value, emptyAttributeRule()],
      };
      return { ...prev, Attributes: attrs };
    });
  };

  const removeAttrRule = (attrIdx: number, ruleIdx: number) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      attrs[attrIdx] = {
        ...attrs[attrIdx],
        Value: attrs[attrIdx].Value.filter((_, i) => i !== ruleIdx),
      };
      return { ...prev, Attributes: attrs };
    });
  };

  const updateAttrRule = (attrIdx: number, ruleIdx: number, value: string) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      const rules = [...attrs[attrIdx].Value];
      rules[ruleIdx] = { Rules: value };
      attrs[attrIdx] = { ...attrs[attrIdx], Value: rules };
      return { ...prev, Attributes: attrs };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Attribute Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
          <CachingSelect value={caching} onChange={setCaching} />
          {count !== null && <Typography variant="body2" color="text.secondary">{count} profiles</Typography>}
        </Box>
      </Paper>

      <EventTester
        tenant={tenant}
        methods={['AttributeSv1.ProcessEvent', 'AttributeSv1.GetAttributeForEvent']}
        opts={[
          { key: '*context', label: 'Context', kind: 'text', options: CONTEXTS },
          { key: '*attrProfileIDs', label: 'Profile IDs', kind: 'ids', options: testerOptions.get('attributes') },
          { key: '*attrProcessRuns', label: 'Process runs', kind: 'number' },
          { key: '*attrProfileRuns', label: 'Profile runs', kind: 'number' },
          { key: '*attrProfileIgnoreFilters', label: 'Ignore profile filters', kind: 'bool' },
        ]}
        initialFields={[['Account', ''], ['Destination', '']]}
        run={(method, args) => api.attributeSEvent(baseUrl!, method, args)}
      />

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
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New Attribute Profile'}</DialogTitle>
        <DialogContent dividers>
          {editing && idOptions.error && <Alert severity="warning" sx={{ mb: 1 }}>{idOptions.error}</Alert>}
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
              />
              <TextField
                label="Weight" size="small" fullWidth type="number"
                value={editData.Weight}
                onChange={e => setEditData(prev => ({ ...prev, Weight: Number(e.target.value) }))}
              />
              <IdMultiSelect
                label="Contexts" value={editData.Contexts || []} options={CONTEXTS}
                onChange={v => setEditData(prev => ({ ...prev, Contexts: v }))}
                helperText="*any matches every context; custom contexts can be typed"
              />
              <IdMultiSelect
                label="Filter IDs" value={editData.FilterIDs || []} options={idOptions.get('filters')}
                onChange={v => setEditData(prev => ({ ...prev, FilterIDs: v }))}
                placeholder="Filter ID or inline *string:~*req.Account:1001"
              />
              <ActivationIntervalInput
                value={editData.ActivationInterval}
                onChange={v => setEditData(prev => ({ ...prev, ActivationInterval: v }))}
              />
              <FormControlLabel
                label="Blocker (stop processing further profiles after this one)"
                control={<Checkbox checked={!!editData.Blocker} onChange={e => setEditData(prev => ({ ...prev, Blocker: e.target.checked }))} />}
              />

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Attributes</Typography>

              {editData.Attributes.map((attr, attrIdx) => (
                <Paper key={attrIdx} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Attribute {attrIdx + 1}</Typography>
                    <IconButton size="small" color="error" onClick={() => removeAttr(attrIdx)} disabled={editData.Attributes.length <= 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <TextField
                    label="Path" size="small" fullWidth sx={{ mb: 1 }}
                    value={attr.Path}
                    onChange={e => updateAttr(attrIdx, 'Path', e.target.value)}
                    placeholder="e.g. *req.Subject"
                  />

                  <Autocomplete<string, false, false, true>
                    freeSolo size="small" sx={{ mb: 1 }}
                    options={attributeTypes}
                    value={attr.Type}
                    onInputChange={(_e, v) => updateAttr(attrIdx, 'Type', v)}
                    renderInput={p => <TextField {...p} label="Type" />}
                  />
                  {typeHint(attr.Type) ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {typeHint(attr.Type)}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
                      Not a substitution type CGrateS knows; processing will fail with "unsupported type"
                    </Typography>
                  )}

                  {/* Rules */}
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Rules</Typography>
                  {attr.Value.map((rule, ruleIdx) => (
                    <Box key={ruleIdx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                      <TextField
                        size="small" fullWidth
                        value={rule.Rules}
                        onChange={e => updateAttrRule(attrIdx, ruleIdx, e.target.value)}
                        placeholder="Rule value"
                      />
                      <IconButton size="small" color="error" onClick={() => removeAttrRule(attrIdx, ruleIdx)} disabled={attr.Value.length <= 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<AddIcon />} onClick={() => addAttrRule(attrIdx)}>Add Rule</Button>

                  <IdMultiSelect
                    label="Filter IDs" value={attr.FilterIDs || []} options={idOptions.get('filters')}
                    onChange={v => updateAttr(attrIdx, 'FilterIDs', v)} sx={{ mt: 1.5 }}
                  />
                </Paper>
              ))}

              <Button variant="outlined" startIcon={<AddIcon />} onClick={addAttr}>Add Attribute</Button>
            </Box>
          ) : (
            /* --- View mode --- */
            detail && (
              <Box sx={{ mt: 1 }}>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="body2"><strong>Tenant:</strong> {detail.Tenant}</Typography>
                  <Typography variant="body2"><strong>ID:</strong> {detail.ID}</Typography>
                  <Typography variant="body2"><strong>Weight:</strong> {detail.Weight}</Typography>
                  <Typography variant="body2"><strong>Blocker:</strong> {detail.Blocker ? 'Yes' : 'No'}</Typography>
                  <Typography variant="body2"><strong>Contexts:</strong> {(detail.Contexts || []).join(', ') || 'None'}</Typography>
                  <Typography variant="body2">
                    <strong>Activation Interval:</strong>{' '}
                    {formatActivationInterval(detail.ActivationInterval)}
                  </Typography>
                  {detail.FilterIDs && detail.FilterIDs.length > 0 && (
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" fontWeight={500}>Profile FilterIDs:</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {detail.FilterIDs.map((fid, i) => <Chip key={i} label={fid} size="small" variant="outlined" />)}
                      </Box>
                    </Box>
                  )}
                </Paper>

                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Attributes ({detail.Attributes?.length || 0})
                </Typography>

                {detail.Attributes?.map((attr, idx) => (
                  <Accordion key={idx} defaultExpanded={detail.Attributes.length <= 5}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip label={attr.Type} size="small" color="primary" variant="outlined" />
                        <Typography variant="body2">{attr.Path}</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2"><strong>Path:</strong> {attr.Path}</Typography>
                      <Typography variant="body2"><strong>Type:</strong> {attr.Type}</Typography>

                      <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>Rules:</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 1 }}>
                        {attr.Value?.map((v, vi) => (
                          <Chip key={vi} label={v.Rules} size="small" variant="outlined" />
                        ))}
                      </Box>

                      {attr.FilterIDs && attr.FilterIDs.length > 0 && (
                        <>
                          <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>FilterIDs:</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 1 }}>
                            {attr.FilterIDs.map((fid, fi) => (
                              <Chip key={fi} label={fid} size="small" color="secondary" variant="outlined" />
                            ))}
                          </Box>
                        </>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
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
