import { useState, useCallback, type MouseEvent } from 'react';
import {
  Box, Typography, Paper, Button, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, IconButton,
  TextField, Chip, List, ListItem, ListItemText, Divider, Checkbox, FormControlLabel, Tabs, Tab,
  Menu, ListItemIcon, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import ClearIcon from '@mui/icons-material/Clear';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TypedConfirmDialog from '../components/TypedConfirmDialog';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { DurationInput, formatDuration } from '../components/BalanceValue';
import IdMultiSelect from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';
import ActivationIntervalInput, { formatActivationInterval, type ActivationInterval } from '../components/ActivationIntervalInput';
import EventTester from '../components/EventTester';
import { useIdOptions } from '../components/useIdOptions';

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
  Stored: boolean;
  Blocker: boolean;
  Weight: number;
  ThresholdIDs: string[];
  ActivationInterval: ActivationInterval | null;
  [key: string]: unknown;
}

const emptyProfile = (tenant: string): EditProfileData => ({
  Tenant: tenant, ID: '', QueueLength: 0, TTL: -1, MinItems: 0, FilterIDs: [], Metrics: [],
  Stored: false, Blocker: false, Weight: 0, ThresholdIDs: [], ActivationInterval: null,
});

function formatTTL(ttl: number): string {
  return ttl > 0 ? `${formatDuration(ttl)} (${ttl} ns)` : `No expiry (${ttl})`;
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
  { value: '*highest', label: 'Generic highest' },
  { value: '*lowest', label: 'Generic lowest' },
  { value: '*repsc', label: 'Successful requests count' },
  { value: '*repfc', label: 'Failed requests count' },
];

const metricParams: Record<string, { label: string; placeholder: string }> = {
  '*sum': { label: 'Input Value', placeholder: 'Enter value (e.g., ~*req.Cost)' },
  '*average': { label: 'Input Value', placeholder: 'Enter value (e.g., ~*req.Cost)' },
  '*distinct': { label: 'Input Value', placeholder: 'Enter value (e.g., ~*req.Destination)' },
  '*highest': { label: 'Input Value', placeholder: 'Enter value (e.g., ~*req.Cost)' },
  '*lowest': { label: 'Input Value', placeholder: 'Enter value (e.g., ~*req.Cost)' },
  '*repfc': { label: 'Error Type (optional)', placeholder: 'e.g. ERR_TERMINATE; empty counts all failures' },
};

function getMetricLabel(metricID: string): string {
  const [metricType] = metricID.split('#');
  const metric = metricsOptions.find((option) => option.value === metricType);
  return metric ? metric.label : metricID;
}

function describeField(param: string): string {
  const req = /^~\*req\.(.+)$/.exec(param);
  if (req) return `each event's ${req[1]} field`;
  if (param.startsWith('~')) return `the value of ${param} in each event`;
  return `the constant ${param} for each event`;
}

/** Plain-language hint for a metric ID, from engine/statmetrics.go; null when the type isn't known. */
function metricHelp(metricID: string): string | null {
  const hash = metricID.indexOf('#');
  const type = hash < 0 ? metricID : metricID.slice(0, hash);
  const param = hash < 0 ? '' : metricID.slice(hash + 1);
  const constant = param !== '' && !param.startsWith('~') && Number.isFinite(Number(param));
  switch (type) {
    case '*asr': return 'Answer-seizure ratio: % of events with a non-empty AnswerTime.';
    case '*acd': return "Average of each event's Usage field, shown as a duration.";
    case '*tcd': return "Total of each event's Usage field, shown as a duration.";
    case '*acc': return "Average of each event's Cost field.";
    case '*tcc': return "Total of each event's Cost field.";
    case '*pdd': return "Average of each event's PDD (post dial delay) field.";
    case '*ddc': return 'Number of distinct Destination values.';
    case '*sum':
      if (!param) return null;
      return constant ? `Adds ${param} per event${param === '1' ? ', i.e. a count of events' : ''}.` : `Total of ${describeField(param)}.`;
    case '*average': return param ? `Average of ${describeField(param)}.` : null;
    case '*highest': return param ? `Highest value of ${describeField(param)}.` : null;
    case '*lowest': return param ? `Lowest value of ${describeField(param)}.` : null;
    case '*distinct': {
      const req = /^~\*req\.(.+)$/.exec(param);
      return param ? `Number of distinct ${req ? `${req[1]} values` : `values of ${param}`}.` : null;
    }
    case '*repsc': return 'Count of events whose ReplyState is OK.';
    case '*repfc': return param ? `Count of events whose ReplyState contains ${param}.` : 'Count of events whose ReplyState is not OK.';
    default: return null;
  }
}

const NA_HELP = 'N/A: the queue holds fewer matching events than this metric needs (none yet, or under the profile\'s Min Items). The float API reports it as -1.';

function nonBlank(ids: string[] | null | undefined): string[] {
  return (ids || []).map(s => s.trim()).filter(Boolean);
}

function isGenericMetric(metricID: string): boolean {
  return metricID.split('#')[0] in metricParams;
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
  const [editProfile, setEditProfile] = useState<EditProfileData>(emptyProfile(''));
  const [genericMetricInput, setGenericMetricInput] = useState<Record<number, string>>({});
  const [caching, setCaching] = useState('');
  const idOptions = useIdOptions(['filters', 'thresholds'], tenant, detailOpen && editing);
  const testerOptions = useIdOptions(['stats'], tenant, true);

  // Metrics
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsId, setMetricsId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, string> | null>(null);
  const [floatMetrics, setFloatMetrics] = useState<Record<string, number> | null>(null);
  const [rawQueue, setRawQueue] = useState<unknown>(null);
  const [metricsTab, setMetricsTab] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
        ...emptyProfile(tenant),
        ...(result as unknown as EditProfileData),
        Metrics: parsedMetrics,
        FilterIDs: (result.FilterIDs as string[]) || [],
        ThresholdIDs: (result.ThresholdIDs as string[]) || [],
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
        FilterIDs: nonBlank(editProfile.FilterIDs),
        Metrics: (editProfile.Metrics || []).map((metric, index) => {
          let metricID = metric.MetricID;
          if (isGenericMetric(metricID) && genericMetricInput[index]) {
            metricID = `${metricID}#${genericMetricInput[index]}`;
          }
          return {
            ...metric,
            MetricID: metricID,
            FilterIDs: nonBlank(metric.FilterIDs),
            genericValue: undefined,
          };
        }),
      };
      await api.setStatQueueProfile(baseUrl, { ...sanitizedProfile, APIOpts: cachingOpts(caching) });
      setDetailOpen(false);
      fetchIds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editProfile, genericMetricInput, caching, fetchIds]);

  const handleDelete = useCallback(async () => {
    if (!baseUrl || !deleteId) return;
    setBusy(true);
    try {
      await api.removeStatQueueProfile(baseUrl, tenant, deleteId, cachingOpts(caching));
      fetchIds();
      setDetailOpen(false);
      if (metricsId === deleteId) setMetricsOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  }, [baseUrl, tenant, deleteId, metricsId, caching, fetchIds]);

  const handleCreate = useCallback(() => {
    setSelectedProfile(null);
    setEditProfile(emptyProfile(tenant));
    setGenericMetricInput({});
    setEditing(true);
    setDetailOpen(true);
  }, [tenant]);

  const fetchMetrics = useCallback(async (id: string) => {
    if (!baseUrl) return;
    setMetricsLoading(true);
    setMetrics(null);
    setFloatMetrics(null);
    setRawQueue(null);
    setMetricsId(id);
    setMetricsOpen(true);
    try {
      const [str, flt, queue] = await Promise.all([
        api.getQueueStringMetrics(baseUrl, tenant, id),
        api.getQueueFloatMetrics(baseUrl, tenant, id),
        api.getStatQueue(baseUrl, tenant, id),
      ]);
      setMetrics(str);
      setFloatMetrics(flt);
      setRawQueue(queue);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [baseUrl, tenant]);

  const handleResetQueue = useCallback(async () => {
    if (!baseUrl || !resetId) return;
    setBusy(true);
    try {
      await api.resetStatQueue(baseUrl, tenant, resetId);
      if (metricsOpen && metricsId === resetId) fetchMetrics(resetId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    } finally {
      setBusy(false);
      setResetId(null);
    }
  }, [baseUrl, tenant, resetId, metricsOpen, metricsId, fetchMetrics]);

  const handleClearAllStats = useCallback(async () => {
    if (!baseUrl || ids.length === 0) return;
    setBusy(true);
    let failCount = 0;
    for (const id of ids) {
      try {
        await api.resetStatQueue(baseUrl, tenant, id);
      } catch {
        failCount++;
      }
    }
    setBusy(false);
    setClearAllOpen(false);
    if (failCount > 0) setError(`Reset ${ids.length - failCount} of ${ids.length} stat queues; ${failCount} failed.`);
  }, [baseUrl, tenant, ids]);

  const openMenu = (e: MouseEvent<HTMLElement>, id: string) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, id }); };
  const menuAction = (fn: (id: string) => void) => () => { if (menu) fn(menu.id); setMenu(null); };

  // Edit form handlers
  const handleEditChange = (name: string, value: unknown) => {
    setEditProfile(prev => ({ ...prev, [name]: value }));
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

  const handleMetricFiltersChange = (metricIndex: number, value: string[]) => {
    setEditProfile(prev => {
      const updatedMetrics = [...prev.Metrics];
      updatedMetrics[metricIndex] = { ...updatedMetrics[metricIndex], FilterIDs: value };
      return { ...prev, Metrics: updatedMetrics };
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Stat Queue Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={fetchIds}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
          <CachingSelect value={caching} onChange={setCaching} />
          <Button
            variant="outlined"
            color="warning"
            startIcon={<ClearAllIcon />}
            onClick={() => setClearAllOpen(true)}
            disabled={ids.length === 0 || loading}
          >
            Reset all counters…
          </Button>
        </Box>
      </Paper>

      <EventTester
        tenant={tenant}
        methods={['StatSv1.GetStatQueuesForEvent', 'StatSv1.ProcessEvent']}
        opts={[
          { key: '*stsProfileIDs', label: 'Profile IDs', kind: 'ids', options: testerOptions.get('stats') },
          { key: '*stsProfileIgnoreFilters', label: 'Ignore filters', kind: 'bool' },
        ]}
        initialFields={[['Account', ''], ['Usage', '60s'], ['Cost', '']]}
        warning="ProcessEvent adds the event to every matching queue and changes its metrics. Use GetStatQueuesForEvent to only see what matches."
        run={(method, args) => api.statSEvent(baseUrl!, method, args)}
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
                <TableRow key={id} hover sx={{ cursor: 'pointer' }} onClick={() => fetchMetrics(id)}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all' }}>{id}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Actions">
                      <IconButton size="small" aria-label={`Actions for ${id}`} aria-haspopup="menu" onClick={e => openMenu(e, id)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No items found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)} onClick={e => e.stopPropagation()}>
        <MenuItem onClick={menuAction(id => fetchMetrics(id))}>
          <ListItemIcon><BarChartIcon fontSize="small" /></ListItemIcon>View metrics
        </MenuItem>
        <MenuItem onClick={menuAction(id => fetchDetail(id))}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>View profile
        </MenuItem>
        <MenuItem onClick={menuAction(id => fetchDetail(id, true))}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit…
        </MenuItem>
        <Divider />
        <MenuItem onClick={menuAction(setResetId)} sx={{ color: 'warning.main' }}>
          <ListItemIcon><ClearIcon fontSize="small" color="warning" /></ListItemIcon>Reset counters…
        </MenuItem>
        <MenuItem onClick={menuAction(setDeleteId)} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>Delete…
        </MenuItem>
      </Menu>

      {/* Profile Detail / Edit Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (editProfile.ID ? `Edit: ${editProfile.ID}` : 'Create New') : (selectedProfile ? `${(selectedProfile as Record<string, unknown>).ID}` : '')}</DialogTitle>
        <DialogContent>
          {editing && idOptions.error && <Alert severity="warning" sx={{ mt: 1 }}>{idOptions.error}</Alert>}
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
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>TTL (0 or -1 = items never expire)</Typography>
                <DurationInput
                  value={editProfile.TTL}
                  onChange={raw => handleEditChange('TTL', raw < 0 ? -1 : raw)}
                />
              </Box>

              <TextField
                label="Min Items"
                type="number"
                value={editProfile.MinItems}
                onChange={e => handleEditChange('MinItems', parseInt(e.target.value, 10) || 0)}
                helperText="Metrics report N/A until the queue holds this many items"
                fullWidth
                size="small"
              />

              <TextField
                label="Weight"
                type="number"
                value={editProfile.Weight}
                onChange={e => handleEditChange('Weight', parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={<Checkbox checked={!!editProfile.Stored} onChange={e => handleEditChange('Stored', e.target.checked)} />}
                  label="Stored"
                />
                <FormControlLabel
                  control={<Checkbox checked={!!editProfile.Blocker} onChange={e => handleEditChange('Blocker', e.target.checked)} />}
                  label="Blocker"
                />
              </Box>

              <ActivationIntervalInput
                value={editProfile.ActivationInterval}
                onChange={v => handleEditChange('ActivationInterval', v)}
              />

              <IdMultiSelect
                label="Threshold IDs" value={editProfile.ThresholdIDs} options={['*none', ...idOptions.get('thresholds')]}
                onChange={v => handleEditChange('ThresholdIDs', v)}
                helperText="Empty checks every matching threshold; *none checks none"
              />

              <IdMultiSelect
                label="Filter IDs" value={editProfile.FilterIDs} options={idOptions.get('filters')}
                onChange={v => handleEditChange('FilterIDs', v)}
                placeholder="Filter ID or inline *string:~*req.Account:1001"
              />

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
                        label={metricParams[metric.MetricID].label}
                        value={genericMetricInput[index] || ''}
                        onChange={e => handleGenericInputChange(index, e.target.value)}
                        fullWidth
                        size="small"
                        placeholder={metricParams[metric.MetricID].placeholder}
                        sx={{ mb: 1 }}
                      />
                    )}

                    <IdMultiSelect
                      label="Metric Filter IDs" value={metric.FilterIDs || []} options={idOptions.get('filters')}
                      onChange={v => handleMetricFiltersChange(index, v)}
                    />
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
                  <ListItemText primary="TTL" secondary={formatTTL(Number(selectedProfile.TTL))} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Min Items" secondary={String(selectedProfile.MinItems ?? 0)} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Weight" secondary={String(selectedProfile.Weight ?? 0)} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Stored" secondary={selectedProfile.Stored ? 'Yes' : 'No'} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Blocker" secondary={selectedProfile.Blocker ? 'Yes' : 'No'} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Activation Interval"
                    secondary={formatActivationInterval(selectedProfile.ActivationInterval as ActivationInterval | null)}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ display: 'block' }}>
                  <ListItemText primary="Threshold IDs" />
                  {((selectedProfile.ThresholdIDs as string[]) || []).length > 0
                    ? (selectedProfile.ThresholdIDs as string[]).map(t => <Chip key={t} label={t} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
                    : <Typography variant="body2" color="text.secondary">None</Typography>}
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
                      {metricHelp(metric.MetricID) && <Typography variant="caption" color="text.secondary">{metricHelp(metric.MetricID)}</Typography>}
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
          {selectedProfile && <Button color="error" onClick={() => setDeleteId(String(selectedProfile.ID))}>Delete…</Button>}
          {selectedProfile && <Button onClick={() => fetchMetrics(String(selectedProfile.ID))}>View Metrics</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsOpen} onClose={() => setMetricsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Metrics: {metricsId}</DialogTitle>
        <DialogContent>
          <Tabs value={metricsTab} onChange={(_, v) => setMetricsTab(v)} sx={{ mb: 1 }}>
            <Tab label="Metrics" />
            <Tab label="Raw queue" />
          </Tabs>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : metricsTab === 1 ? (
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'action.hover' }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(rawQueue, null, 2)}</pre>
            </Paper>
          ) : metrics ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Float value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics).map(([k, v]) => {
                    const help = metricHelp(k);
                    return (
                      <TableRow key={k}>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: 13, wordBreak: 'break-all' }}>{k}</Box>
                          {help && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{help}</Typography>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {v === 'N/A' ? (
                            <Tooltip title={NA_HELP}>
                              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'help' }} tabIndex={0} aria-label={`N/A. ${NA_HELP}`}>
                                N/A <HelpOutlineIcon sx={{ fontSize: 14 }} color="action" />
                              </Box>
                            </Tooltip>
                          ) : v}
                        </TableCell>
                        <TableCell>{floatMetrics?.[k] ?? '-'}</TableCell>
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
          {metricsId && <Button color="error" onClick={() => setResetId(metricsId)} sx={{ mr: 'auto' }}>Reset counters…</Button>}
          {metricsId && <Button onClick={() => fetchDetail(metricsId)}>View profile</Button>}
          <Button variant="contained" onClick={() => setMetricsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <TypedConfirmDialog open={!!resetId} title="Reset counters" expected={resetId ?? ''}
        confirmLabel="Reset counters" busy={busy} onConfirm={handleResetQueue} onClose={() => setResetId(null)}>
        <Typography variant="body2">
          Sends StatSv1.ResetStatQueue for <strong>{resetId}</strong> on tenant {tenant}. Every metric in the queue goes back to empty; the profile is kept.
        </Typography>
      </TypedConfirmDialog>

      <TypedConfirmDialog open={!!deleteId} title="Delete stat queue profile" expected={deleteId ?? ''}
        confirmLabel="Delete" busy={busy} onConfirm={handleDelete} onClose={() => setDeleteId(null)}>
        <Typography variant="body2">
          Sends APIerSv1.RemoveStatQueueProfile for <strong>{deleteId}</strong> on tenant {tenant}. The profile and its queue are removed.
        </Typography>
      </TypedConfirmDialog>

      <TypedConfirmDialog open={clearAllOpen} title="Reset all counters" expected={String(ids.length)}
        confirmLabel={`Reset ${ids.length} queues`} busy={busy} onConfirm={handleClearAllStats} onClose={() => setClearAllOpen(false)}>
        <Typography variant="body2">
          Sends StatSv1.ResetStatQueue once for each of the <strong>{ids.length}</strong> stat queues listed on tenant {tenant}. Every metric goes back to empty.
        </Typography>
      </TypedConfirmDialog>
    </Box>
  );
}
