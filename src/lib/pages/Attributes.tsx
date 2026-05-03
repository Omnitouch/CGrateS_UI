import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Accordion, AccordionSummary, AccordionDetails, Chip, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { AttributeProfile, AttributeEntry } from '../types';

const attributeTypeHints: Record<string, string> = {
  '*constant': 'Sets the attribute to a fixed constant value',
  '*variable': 'Sets the attribute to a dynamic value from another field (e.g. ~*req.Account)',
  '*composed': 'Appends/composes values together from multiple sources',
  '*usage_difference': 'Calculates the difference between two usage timestamps',
  '*sum': 'Sums up numeric values',
  '*value_exponent': 'Applies exponent to the value (value * 10^exponent)',
  '*none': 'No transformation, used for filtering only',
};

const attributeTypes = Object.keys(attributeTypeHints);

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

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAttributeProfileIDs(baseUrl, tenant) as string[];
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
      await api.setAttributeProfile(baseUrl, editData as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editData, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeAttributeProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

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

  // FilterIDs on attribute level
  const addAttrFilterId = (attrIdx: number) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      attrs[attrIdx] = {
        ...attrs[attrIdx],
        FilterIDs: [...(attrs[attrIdx].FilterIDs || []), ''],
      };
      return { ...prev, Attributes: attrs };
    });
  };

  const removeAttrFilterId = (attrIdx: number, fIdx: number) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      attrs[attrIdx] = {
        ...attrs[attrIdx],
        FilterIDs: attrs[attrIdx].FilterIDs.filter((_, i) => i !== fIdx),
      };
      return { ...prev, Attributes: attrs };
    });
  };

  const updateAttrFilterId = (attrIdx: number, fIdx: number, value: string) => {
    setEditData(prev => {
      const attrs = [...prev.Attributes];
      const fids = [...(attrs[attrIdx].FilterIDs || [])];
      fids[fIdx] = value;
      attrs[attrIdx] = { ...attrs[attrIdx], FilterIDs: fids };
      return { ...prev, Attributes: attrs };
    });
  };

  // Profile-level FilterIDs
  const addProfileFilterId = () => {
    setEditData(prev => ({ ...prev, FilterIDs: [...(prev.FilterIDs || []), ''] }));
  };

  const removeProfileFilterId = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      FilterIDs: (prev.FilterIDs || []).filter((_, i) => i !== idx),
    }));
  };

  const updateProfileFilterId = (idx: number, value: string) => {
    setEditData(prev => {
      const fids = [...(prev.FilterIDs || [])];
      fids[idx] = value;
      return { ...prev, FilterIDs: fids };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Attribute Profiles</Typography>
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
        <DialogTitle>{selectedId ? `${selectedId}` : 'Create New Attribute Profile'}</DialogTitle>
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
              <TextField
                label="Weight" size="small" fullWidth type="number"
                value={editData.Weight}
                onChange={e => setEditData(prev => ({ ...prev, Weight: Number(e.target.value) }))}
              />
              <TextField
                label="Contexts (comma-separated)" size="small" fullWidth
                value={(editData.Contexts || []).join(', ')}
                onChange={e => setEditData(prev => ({ ...prev, Contexts: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              />

              {/* Profile-level FilterIDs */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Profile FilterIDs</Typography>
              {(editData.FilterIDs || []).map((fid, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small" fullWidth value={fid}
                    onChange={e => updateProfileFilterId(idx, e.target.value)}
                    placeholder="Filter ID"
                  />
                  <IconButton size="small" color="error" onClick={() => removeProfileFilterId(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addProfileFilterId}>Add FilterID</Button>

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

                  <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={attr.Type}
                      label="Type"
                      onChange={e => updateAttr(attrIdx, 'Type', e.target.value)}
                    >
                      {attributeTypes.map(at => (
                        <MenuItem key={at} value={at}>{at}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {attributeTypeHints[attr.Type] && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {attributeTypeHints[attr.Type]}
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

                  {/* Attribute-level FilterIDs */}
                  <Typography variant="body2" sx={{ mt: 1, mb: 0.5, fontWeight: 500 }}>FilterIDs</Typography>
                  {(attr.FilterIDs || []).map((fid, fIdx) => (
                    <Box key={fIdx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                      <TextField
                        size="small" fullWidth value={fid}
                        onChange={e => updateAttrFilterId(attrIdx, fIdx, e.target.value)}
                        placeholder="Filter ID"
                      />
                      <IconButton size="small" color="error" onClick={() => removeAttrFilterId(attrIdx, fIdx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<AddIcon />} onClick={() => addAttrFilterId(attrIdx)}>Add FilterID</Button>
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
                    {detail.ActivationInterval
                      ? `${detail.ActivationInterval.ActivationTime} - ${detail.ActivationInterval.ExpiryTime}`
                      : 'None'}
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
