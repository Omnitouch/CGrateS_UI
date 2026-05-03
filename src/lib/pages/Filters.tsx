import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, List, ListItem, ListItemText, Divider, Chip, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { FilterProfile, FilterRule } from '../types';

const filterTypeHints: Record<string, string> = {
  '*string': 'Matches in full the Element with at least one value defined inside Values',
  '*notstring': 'Is the negation of *string',
  '*prefix': 'Matches the beginning of Element with at least one value defined inside Values',
  '*notprefix': 'Is the negation of *prefix',
  '*suffix': 'Matches the end of Element with at least one value defined inside Values',
  '*notsuffix': 'Is the negation of *suffix',
  '*empty': 'Makes sure the Element is empty or does not exist',
  '*notempty': 'Is the negation of *empty',
  '*exists': 'Makes sure the Element exists / is not missing',
  '*notexists': 'Is the negation of *exists',
  '*timings': 'Matches the Element with a TimingID from the Timings subsystem',
  '*nottimings': 'Is the negation of *timings',
  '*destinations': 'Matches the Element with a DestinationID from the Destinations subsystem',
  '*notdestinations': 'Is the negation of *destinations',
  '*rsr': 'Matches the Element using RSR (RegExp Search & Replace) rules',
  '*notrsr': 'Is the negation of *rsr',
  '*lt': 'Less than: compares Element with Values',
  '*lte': 'Less than or equal: compares Element with Values',
  '*gt': 'Greater than: compares Element with Values',
  '*gte': 'Greater than or equal: compares Element with Values',
};

const filterTypes = Object.keys(filterTypeHints);

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
      await api.setFilter(baseUrl, editData as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeFilter(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

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
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
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

                  <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={rule.Type}
                      label="Type"
                      onChange={e => updateRule(ruleIdx, 'Type', e.target.value)}
                    >
                      {filterTypes.map(ft => (
                        <MenuItem key={ft} value={ft}>{ft}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {filterTypeHints[rule.Type] && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {filterTypeHints[rule.Type]}
                    </Typography>
                  )}

                  <TextField
                    label="Element" size="small" fullWidth sx={{ mb: 1 }}
                    value={rule.Element}
                    onChange={e => updateRule(ruleIdx, 'Element', e.target.value)}
                    placeholder="e.g. ~*req.Account"
                  />

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
                    secondary={
                      (detail as FilterProfile).ActivationInterval
                        ? `${(detail as FilterProfile).ActivationInterval!.ActivationTime} - ${(detail as FilterProfile).ActivationInterval!.ExpiryTime}`
                        : 'None'
                    }
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
