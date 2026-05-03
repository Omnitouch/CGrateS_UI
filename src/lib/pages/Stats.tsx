import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Chip, List, ListItem, ListItemText, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import ClearIcon from '@mui/icons-material/Clear';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

interface MetricEntry {
  MetricID: string;
  FilterIDs: string[];
  genericValue?: string;
}

interface EditProfileData {
  Tenant: string;
  ID: string;
  QueueLength: number;
  TTL: number;
  MinItems: number;
  FilterIDs: string[];
  Metrics: MetricEntry[];
  [key: string]: unknown;
}

const metricsOptions = [
  { value: '*asr', label: 'Answer-seizure ratio' },
  { value: '*acd', label: 'Average call duration' },
  { value: '*tcd', label: 'Total call duration' },
  { value: '*acc', label: 'Average call cost' },
  { value: '*tcc', label: 'Total call cost' },
  { value: '*pdd', label: 'Post dial delay' },
  { value: '*ddc', label: 'Distinct destination count' },
  { value: '*sum', label: 'Generic sum' },
  { value: '*average', label: 'Generic average' },
  { value: '*distinct', label: 'Generic distinct' },
];

function getMetricLabel(metricID: string): string {
  const [metricType] = metricID.split('#');
  const metric = metricsOptions.find((option) => option.value === metricType);
  return metric ? metric.label : metricID;
}

function isGenericMetric(metricID: string): boolean {
  return metricID.startsWith('*sum') || metricID.startsWith('*average') || metricID.startsWith('*distinct');
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Record<string, unknown> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Structured edit form state
  const [editProfile, setEditProfile] = useState<EditProfileData>({
    Tenant: '', ID: '', QueueLength: 0, TTL: -1, MinItems: 0, FilterIDs: [], Metrics: [],
  });
  const [genericMetricInput, setGenericMetricInput] = useState<Record<number, string>>({});

  // Metrics
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsId, setMetricsId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, string> | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchIds = useCallback(async () => {
    if (!baseUrl || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStatQueueProfileIDs(baseUrl, tenant) as string[];
      const sorted = (result || []).sort((a, b) => a.localeCompare(b));
      setIds(sorted);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tenant]);

  const fetchDetail = useCallback(async (id: string, openInEditMode = false) => {
    if (!baseUrl) return;
    try {
      const result = await api.getStatQueueProfile(baseUrl, tenant, id) as Record<string, unknown>;
      setSelectedProfile(result);

      // Parse metrics to separate metric type and generic value
      const rawMetrics = (result.Metrics as Array<{ MetricID: string; FilterIDs?: string[] }>) || [];
      const parsedMetrics: MetricEntry[] = rawMetrics.map((metric) => {
        const [metricType, genericValue] = metric.MetricID.split('#');
        return {
          ...metric,
          MetricID: metricType,
          FilterIDs: metric.FilterIDs || [],
          genericValue: genericValue || '',
        };
      });

      const profile: EditProfileData = {
        ...(result as unknown as EditProfileData),
        Metrics: parsedMetrics,
        FilterIDs: (result.FilterIDs as string[]) || [],
      };
      setEditProfile(profile);

      // Set generic metric input values
      const genericInputs: Record<number, string> = {};
      parsedMetrics.forEach((metric, index) => {
        if (metric.genericValue) {
          genericInputs[index] = metric.genericValue;
        }
      });
      setGenericMetricInput(genericInputs);

      setEditing(openInEditMode);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch details');
    }
  }, [baseUrl, tenant]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const sanitizedProfile = {
        ...editProfile,
        TTL: typeof editProfile.TTL === 'string' ? parseInt(editProfile.TTL, 10) : editProfile.TTL,
        QueueLength: typeof editProfile.QueueLength === 'string' ? parseInt(editProfile.QueueLength as string, 10) : editProfile.QueueLength,
        FilterIDs: editProfile.FilterIDs || [],
        Metrics: (editProfile.Metrics || []).map((metric, index) => {
          let metricID = metric.MetricID;
          if (isGenericMetric(metricID) && genericMetricInput[index]) {
            metricID = `${metricID}#${genericMetricInput[index]}`;
          }
          return {
            ...metric,
            MetricID: metricID,
            FilterIDs: metric.FilterIDs || [],
            genericValue: undefined,
          };
        }),
      };
      await api.setStatQueueProfile(baseUrl, sanitizedProfile);
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editProfile, genericMetricInput, fetchIds]);

  const handleDelete = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Delete ${id}?`)) return;
    try {
      await api.removeStatQueueProfile(baseUrl, tenant, id);
      fetchIds();
      setDetailOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, tenant, fetchIds]);

  const handleCreate = useCallback(() => {
    setSelectedProfile(null);
    setEditProfile({
      Tenant: tenant,
      ID: '',
      QueueLength: 0,
      TTL: -1,
      MinItems: 0,
      FilterIDs: [],
      Metrics: [],
    });
    setGenericMetricInput({});
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  const fetchMetrics = useCallback(async (id: string) => {
    if (!baseUrl) return;
    setMetricsLoading(true);
    setMetrics(null);
    setMetricsId(id);
    setMetricsOpen(true);
    try {
      const result = await api.getQueueStringMetrics(baseUrl, tenant, id);
      setMetrics(result as Record<string, string>);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [baseUrl, tenant]);

  const handleClearStat = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      await api.resetStatQueue(baseUrl, tenant, id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to clear stat');
    }
  }, [baseUrl, tenant]);

  const handleClearAllStats = useCallback(async () => {
    if (!baseUrl || ids.length === 0) return;
    if (!window.confirm('Are you sure you want to clear ALL stats? This will reset all stat queues.')) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await api.resetStatQueue(baseUrl, tenant, id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setLoading(false);
    alert(`Cleared ${successCount} stats successfully.${failCount > 0 ? ` Failed to clear ${failCount} stats.` : ''}`);
  }, [baseUrl, tenant, ids]);

  const handleResetQueue = useCallback(async (id: string) => {
    if (!baseUrl || !window.confirm(`Reset stat queue ${id}?`)) return;
    try {
      await api.resetStatQueue(baseUrl, tenant, id);
      if (metricsOpen && metricsId === id) fetchMetrics(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    }
  }, [baseUrl, tenant, metricsOpen, metricsId, fetchMetrics]);

  // Edit form handlers
  const handleEditChange = (name: string, value: string | number) => {
    setEditProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (index: number, value: string) => {
    setEditProfile(prev => {
      const updatedFilters = [...prev.FilterIDs];
      updatedFilters[index] = value;
      return { ...prev, FilterIDs: updatedFilters };
    });
  };

  const addFilter = () => {
    setEditProfile(prev => ({ ...prev, FilterIDs: [...(prev.FilterIDs || []), ''] }));
  };

  const removeFilter = (index: number) => {
    setEditProfile(prev => {
      const updatedFilters = [...prev.FilterIDs];
      updatedFilters.splice(index, 1);
      return { ...prev, FilterIDs: updatedFilters };
    });
  };

  const handleMetricChange = (index: number, newValue: string) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      updatedMetrics[index] = { ...updatedMetrics[index], MetricID: newValue };
      return { ...prev, Metrics: updatedMetrics };
    });
    if (!isGenericMetric(newValue)) {
      setGenericMetricInput(prev => ({ ...prev, [index]: '' }));
    }
  };

  const handleGenericInputChange = (index: number, value: string) => {
    setGenericMetricInput(prev => ({ ...prev, [index]: value }));
  };

  const addMetric = () => {
    setEditProfile(prev => ({
      ...prev,
      Metrics: [...(prev.Metrics || []), { MetricID: metricsOptions[0].value, FilterIDs: [] }],
    }));
  };

  const removeMetric = (index: number) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      updatedMetrics.splice(index, 1);
      return { ...prev, Metrics: updatedMetrics };
    });
  };

  const handleMetricFilterChange = (metricIndex: number, filterIndex: number, value: string) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      const updatedFilterIDs = [...(updatedMetrics[metricIndex].FilterIDs || [])];
      updatedFilterIDs[filterIndex] = value;
      updatedMetrics[metricIndex] = { ...updatedMetrics[metricIndex], FilterIDs: updatedFilterIDs };
      return { ...prev, Metrics: updatedMetrics };
    });
  };

  const addMetricFilter = (metricIndex: number) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      updatedMetrics[metricIndex] = {
        ...updatedMetrics[metricIndex],
        FilterIDs: [...(updatedMetrics[metricIndex].FilterIDs || []), ''],
      };
      return { ...prev, Metrics: updatedMetrics };
    });
  };

  const removeMetricFilter = (metricIndex: number, filterIndex: number) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      const updatedFilterIDs = [...(updatedMetrics[metricIndex].FilterIDs || [])];
      updatedFilterIDs.splice(filterIndex, 1);
      updatedMetrics[metricIndex] = { ...updatedMetrics[metricIndex], FilterIDs: updatedFilterIDs };
      return { ...prev, Metrics: updatedMetrics };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Stat Queue Profiles</Typography>
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
          <Button
            variant="outlined"
            color="warning"
            startIcon={<ClearAllIcon />}
            onClick={handleClearAllStats}
            disabled={ids.length === 0 || loading}
          >
            Clear All Stats
          </Button>
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
                    <IconButton size="small" title="View Metrics" onClick={e => { e.stopPropagation(); fetchMetrics(id); }}>
                      <BarChartIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Edit Stats" onClick={e => { e.stopPropagation(); fetchDetail(id, true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Clear Stat" color="warning" onClick={e => { e.stopPropagation(); handleClearStat(id); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" title="Remove" onClick={e => { e.stopPropagation(); handleDelete(id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No items found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Profile Detail / Edit Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (editProfile.ID ? `Edit: ${editProfile.ID}` : 'Create New') : (selectedProfile ? `${(selectedProfile as Record<string, unknown>).ID}` : '')}</DialogTitle>
        <DialogContent>
          {editing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {/* ID */}
              <TextField
                label="ID"
                value={editProfile.ID}
                onChange={e => handleEditChange('ID', e.target.value)}
                fullWidth
                size="small"
              />

              {/* Queue Length */}
              <TextField
                label="Queue Length"
                type="number"
                value={editProfile.QueueLength}
                onChange={e => handleEditChange('QueueLength', parseInt(e.target.value, 10) || 0)}
                fullWidth
                size="small"
              />

              {/* TTL */}
              <TextField
                label="TTL"
                type="number"
                value={editProfile.TTL}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  handleEditChange('TTL', isNaN(val) ? -1 : val);
                }}
                fullWidth
                size="small"
              />

              {/* Filters */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Filters</Typography>
                {(editProfile.FilterIDs || []).map((filter, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TextField
                      value={filter}
                      onChange={e => handleFilterChange(index, e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Filter ID"
                    />
                    <IconButton size="small" color="error" onClick={() => removeFilter(index)}>
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={addFilter}>Add Filter</Button>
              </Box>

              {/* Metrics */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Metrics</Typography>
                {(editProfile.Metrics || []).map((metric, index) => (
                  <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Metric</InputLabel>
                        <Select
                          value={metric.MetricID}
                          label="Metric"
                          onChange={e => handleMetricChange(index, e.target.value)}
                        >
                          {metricsOptions.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label} ({option.value})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton size="small" color="error" onClick={() => removeMetric(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {/* Generic metric input value */}
                    {isGenericMetric(metric.MetricID) && (
                      <TextField
                        label="Input Value"
                        value={genericMetricInput[index] || ''}
                        onChange={e => handleGenericInputChange(index, e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="Enter value (e.g., ~*req.Cost)"
                        sx={{ mb: 1 }}
                      />
                    )}

                    {/* Per-metric FilterIDs */}
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Metric Filters</Typography>
                    {(metric.FilterIDs || []).map((filter, filterIndex) => (
                      <Box key={filterIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TextField
                          value={filter}
                          onChange={e => handleMetricFilterChange(index, filterIndex, e.target.value)}
                          fullWidth
                          size="small"
                          placeholder="Filter ID"
                        />
                        <IconButton size="small" color="error" onClick={() => removeMetricFilter(index, filterIndex)}>
                          <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                    <Button size="small" startIcon={<AddIcon />} onClick={() => addMetricFilter(index)}>
                      Add Filter
                    </Button>
                  </Paper>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={addMetric}>Add Metric</Button>
              </Box>
            </Box>
          ) : (
            selectedProfile && (
              <List dense sx={{ mt: 1 }}>
                <ListItem>
                  <ListItemText primary="ID" secondary={String(selectedProfile.ID)} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Queue Length" secondary={String(selectedProfile.QueueLength)} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="TTL" secondary={String(selectedProfile.TTL)} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Filters"
                    secondary={
                      ((selectedProfile.FilterIDs as string[]) || []).length > 0
                        ? ((selectedProfile.FilterIDs as string[]) || []).join(', ')
                        : 'No filters'
                    }
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ display: 'block' }}>
                  <ListItemText primary="Metrics" />
                  {((selectedProfile.Metrics as Array<{ MetricID: string; FilterIDs?: string[] }>) || []).map((metric, index) => (
                    <Box key={index} sx={{ ml: 2, mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{getMetricLabel(metric.MetricID)}</strong> ({metric.MetricID})
                      </Typography>
                      {(metric.FilterIDs || []).length > 0 && (
                        <Box sx={{ ml: 2 }}>
                          {metric.FilterIDs!.map((f, i) => (
                            <Chip key={i} label={f} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                          ))}
                        </Box>
                      )}
                    </Box>
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
          {selectedProfile && <Button color="error" onClick={() => handleDelete(String(selectedProfile.ID))}>Delete</Button>}
          {selectedProfile && <Button onClick={() => fetchMetrics(String(selectedProfile.ID))}>View Metrics</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsOpen} onClose={() => setMetricsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Metrics: {metricsId}</DialogTitle>
        <DialogContent>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : metrics ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics).map(([k, v]) => {
                    const [metricType, metricValue] = k.split('#');
                    const metricLabel = getMetricLabel(metricType);
                    const displayText = metricValue ? `${metricLabel} of field #${metricValue}` : metricLabel;
                    return (
                      <TableRow key={k}>
                        <TableCell><Chip label={displayText} size="small" /></TableCell>
                        <TableCell>{v}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">No metrics available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {metricsId && <Button color="warning" onClick={() => handleResetQueue(metricsId)}>Reset Queue</Button>}
          <Button onClick={() => setMetricsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
