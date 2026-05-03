import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Chip, IconButton,
  Accordion, AccordionSummary, AccordionDetails, Link, Grid,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import type { AnalyzerResult } from '../types';

// --- Constants ---

const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 30 minutes', value: 30 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 2 hours', value: 120 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 2 days', value: 2880 },
  { label: 'Past 1 week', value: 10080 },
];

const commonMethods = [
  'APIerSv1.GetAccounts', 'APIerSv1.SetAccount', 'APIerSv1.RemoveAccount',
  'APIerSv1.GetAccountActionPlan', 'APIerSv1.SetActions', 'APIerSv1.SetActionPlan',
  'APIerSv1.ExecuteAction', 'APIerSv1.GetCost', 'APIerSv1.SetTPDestination',
  'APIerSv1.SetAttributeProfile', 'APIerSv1.GetAttributeProfile',
  'APIerSv1.SetChargerProfile', 'APIerSv1.GetChargerProfile',
  'APIerSv1.SetFilter', 'APIerSv1.GetFilter',
  'APIerSv1.SetStatQueueProfile', 'APIerSv1.GetStatQueueProfileIDs',
  'APIerSv1.SetThresholdProfile', 'APIerSv1.SetResourceProfile',
  'APIerSv1.SetRouteProfile', 'APIerSv1.ExportCDRs', 'APIerSv1.RemoveCDRs',
  'APIerSv2.GetAccounts',
  'AttributeSv1.ProcessEvent', 'AttributeSv1.GetAttributeForEvent',
  'CDRsV1.ProcessCDR', 'CDRsV1.ProcessEvent', 'CDRsV1.StoreSessionCost',
  'CDRsV2.GetCDRs', 'ChargerSv1.ProcessEvent',
  'ConfigSv1.GetConfigAsJSON', 'CoreSv1.Ping', 'CoreSv1.Status',
  'GuardianSv1.RemoteLock', 'GuardianSv1.RemoteUnlock',
  'Responder.GetCost', 'Responder.GetMaxSessionTime', 'Responder.Debit',
  'RouteSv1.GetRoutes',
  'SessionSv1.AuthorizeEvent', 'SessionSv1.InitiateSession',
  'SessionSv1.UpdateSession', 'SessionSv1.TerminateSession',
  'SessionSv1.ProcessCDR', 'SessionSv1.GetActiveSessions', 'SessionSv1.ForceDisconnect',
  'StatSv1.ProcessEvent', 'StatSv1.GetStatQueuesForEvent',
  'ThresholdSv1.ProcessEvent',
  'ResourceSv1.AuthorizeResources', 'ResourceSv1.AllocateResources', 'ResourceSv1.ReleaseResources',
];

const encodingOptions = [
  { label: 'Any', value: '' },
  { label: 'JSON', value: '*json' },
  { label: 'GOB', value: '*gob' },
  { label: 'Internal', value: '*internal' },
  { label: 'BIRPC JSON', value: '*birpc_json' },
];

const contentFilterTypes = [
  { label: 'String Equals', value: '*string' },
  { label: 'String Prefix', value: '*prefix' },
  { label: 'String Suffix', value: '*suffix' },
  { label: 'Not String', value: '*notstring' },
  { label: 'Greater Than', value: '*gt' },
  { label: 'Greater or Equal', value: '*gte' },
  { label: 'Less Than', value: '*lt' },
  { label: 'Less or Equal', value: '*lte' },
  { label: 'Exists', value: '*exists' },
  { label: 'Not Exists', value: '*notexists' },
];

const contentFilterPaths = [
  { label: 'Request Field', value: '*req' },
  { label: 'Reply Field', value: '*rep' },
  { label: 'API Options', value: '*opts' },
  { label: 'Header Field', value: '*hdr' },
];

// --- Types ---

interface ContentFilter {
  id: number;
  type: string;
  path: string;
  field: string;
  value: string;
}

interface SearchParams {
  timeStart: string;
  timeEnd: string;
  past: string;
  method: string;
  encoding: string;
  source: string;
  destination: string;
  limit: number;
}

// --- Helpers ---

function formatReplyForDisplay(reply: unknown): string {
  if (reply === null || reply === undefined) return '-';
  if (typeof reply === 'string') {
    if ((reply.startsWith('{') || reply.startsWith('[')) && reply.length > 50) return '{JSON...}';
    return reply;
  }
  if (typeof reply === 'object') {
    if (Array.isArray(reply)) return `[Array: ${reply.length} items]`;
    const keys = Object.keys(reply);
    if (keys.length === 0) return '{}';
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }
  return String(reply);
}

function parseReplyForViewer(reply: unknown): unknown {
  if (reply === null || reply === undefined) return null;
  if (typeof reply === 'string') {
    const trimmed = reply.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed); } catch { return reply; }
    }
    return reply;
  }
  return reply;
}

function encodingColor(encoding: string | undefined): 'primary' | 'default' | 'info' {
  if (encoding === '*json') return 'primary';
  if (encoding === '*internal') return 'default';
  return 'info';
}

function toISOLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return toISOLocal(d).slice(0, 16);
  } catch { return ''; }
}

// --- Collapsible JSON Viewer ---

function CollapsibleJSON({ data, initialExpanded = true }: { data: unknown; initialExpanded?: boolean }) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(initialExpanded ? ['root'] : [])
  );

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    const paths = new Set<string>();
    const collect = (obj: unknown, path: string) => {
      paths.add(path);
      if (obj && typeof obj === 'object') {
        Object.keys(obj as Record<string, unknown>).forEach(key => {
          collect((obj as Record<string, unknown>)[key], `${path}.${key}`);
        });
      }
    };
    collect(data, 'root');
    setExpandedPaths(paths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['root']));
  };

  const renderValue = (value: unknown, path: string, key: string | null = null, isLast = true): JSX.Element => {
    const indent = (path.split('.').length - 1) * 16;

    if (value === null) {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
          {key !== null && ': '}
          <span style={{ color: '#1c00cf' }}>null</span>
          {!isLast && ','}
        </div>
      );
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
          {key !== null && ': '}
          <span style={{ color: '#1c00cf' }}>{String(value)}</span>
          {!isLast && ','}
        </div>
      );
    }

    if (typeof value === 'string') {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
          {key !== null && ': '}
          <span style={{ color: '#c41a16' }}>"{value}"</span>
          {!isLast && ','}
        </div>
      );
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      if (value.length === 0) {
        return (
          <div style={{ marginLeft: indent }}>
            {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
            {key !== null && ': '}[]
            {!isLast && ','}
          </div>
        );
      }
      return (
        <div style={{ marginLeft: indent }}>
          <span onClick={() => togglePath(path)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            {isExpanded ? '\u25BC' : '\u25B6'}{' '}
          </span>
          {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
          {key !== null && ': '}
          {!isExpanded ? (
            <><span style={{ color: '#666' }}>[{value.length} items]</span>{!isLast && ','}</>
          ) : (
            <>
              <span>[</span>
              {value.map((item, index) => (
                <div key={index}>{renderValue(item, `${path}[${index}]`, null, index === value.length - 1)}</div>
              ))}
              <div style={{ marginLeft: indent }}>]{!isLast && ','}</div>
            </>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      const isExpanded = expandedPaths.has(path);
      if (keys.length === 0) {
        return (
          <div style={{ marginLeft: indent }}>
            {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
            {key !== null && ': '}{'{}'}
            {!isLast && ','}
          </div>
        );
      }
      return (
        <div style={{ marginLeft: indent }}>
          <span onClick={() => togglePath(path)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            {isExpanded ? '\u25BC' : '\u25B6'}{' '}
          </span>
          {key !== null && <span style={{ color: '#881391' }}>"{key}"</span>}
          {key !== null && ': '}
          {!isExpanded ? (
            <><span style={{ color: '#666' }}>{'{'}{keys.slice(0, 3).join(', ')}{keys.length > 3 ? ', ...' : ''}{'}'}</span>{!isLast && ','}</>
          ) : (
            <>
              <span>{'{'}</span>
              {keys.map((k, index) => (
                <div key={k}>{renderValue(obj[k], `${path}.${k}`, k, index === keys.length - 1)}</div>
              ))}
              <div style={{ marginLeft: indent }}>{'}'}{!isLast && ','}</div>
            </>
          )}
        </div>
      );
    }

    return <div style={{ marginLeft: indent }}>{String(value)}</div>;
  };

  if (data === null || data === undefined) {
    return <span style={{ color: '#666' }}>null</span>;
  }

  if (typeof data !== 'object') {
    return (
      <pre style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: 4, fontSize: 12, margin: 0 }}>
        {String(data)}
      </pre>
    );
  }

  return (
    <div>
      <Box sx={{ mb: 1 }}>
        <Button size="small" variant="outlined" onClick={expandAll} sx={{ mr: 1 }}>Expand All</Button>
        <Button size="small" variant="outlined" onClick={collapseAll}>Collapse All</Button>
      </Box>
      <pre style={{
        backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: 4,
        maxHeight: 400, overflow: 'auto', fontSize: 12, margin: 0,
        fontFamily: "Monaco, Consolas, 'Courier New', monospace",
      }}>
        {renderValue(data, 'root')}
      </pre>
    </div>
  );
}

// --- Main Component ---

export function Component() {
  const baseUrl = useOcsBaseUrl();

  // Search params
  const [searchParams, setSearchParams] = useState<SearchParams>({
    timeStart: '', timeEnd: '', past: '', method: '', encoding: '',
    source: '', destination: '', limit: 50,
  });

  // Pagination
  const [offset, setOffset] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Custom methods
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [newMethodInput, setNewMethodInput] = useState('');

  // Content filters
  const [contentFilters, setContentFilters] = useState<ContentFilter[]>([]);

  // Advanced raw query mode
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawHeaderFilters, setRawHeaderFilters] = useState('');
  const [rawContentFilters, setRawContentFilters] = useState('');

  // Results
  const [results, setResults] = useState<AnalyzerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);

  // Detail modal
  const [detail, setDetail] = useState<AnalyzerResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // --- Handlers ---

  const handleParamChange = (name: keyof SearchParams, value: string | number) => {
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handlePastChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (!minutes) {
      handleParamChange('past', '');
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    setSearchParams(prev => ({
      ...prev,
      past: value,
      timeStart: start.toISOString(),
      timeEnd: end.toISOString(),
    }));
  };

  const handleAddMethod = () => {
    const trimmed = newMethodInput.trim();
    if (trimmed && !commonMethods.includes(trimmed) && !customMethods.includes(trimmed)) {
      setCustomMethods(prev => [...prev, trimmed]);
      setSearchParams(prev => ({ ...prev, method: trimmed }));
      setNewMethodInput('');
    }
  };

  // Content filter management
  const addContentFilter = () => {
    setContentFilters(prev => [
      ...prev,
      { id: Date.now(), type: '*string', path: '*req', field: '', value: '' },
    ]);
  };

  const updateContentFilter = (id: number, key: keyof ContentFilter, value: string) => {
    setContentFilters(prev => prev.map(f => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const removeContentFilter = (id: number) => {
    setContentFilters(prev => prev.filter(f => f.id !== id));
  };

  // Build query from UI
  const buildHeaderFilters = useCallback((): string => {
    if (showAdvanced && rawHeaderFilters.trim()) return rawHeaderFilters.trim();

    const filters: string[] = [];
    if (searchParams.timeStart) {
      filters.push(`+RequestStartTime:>="${new Date(searchParams.timeStart).toISOString()}"`);
    }
    if (searchParams.timeEnd) {
      filters.push(`+RequestStartTime:<="${new Date(searchParams.timeEnd).toISOString()}"`);
    }
    if (searchParams.method) {
      filters.push(`+RequestMethod:"${searchParams.method}"`);
    }
    if (searchParams.encoding) {
      const escaped = searchParams.encoding.replace('*', '\\*');
      filters.push(`+RequestEncoding:${escaped}`);
    }
    if (searchParams.source) {
      filters.push(`+RequestSource:${searchParams.source}*`);
    }
    if (searchParams.destination) {
      filters.push(`+RequestDestination:${searchParams.destination}*`);
    }
    return filters.join(' ');
  }, [showAdvanced, rawHeaderFilters, searchParams]);

  const buildContentFilters = useCallback((): string[] => {
    if (showAdvanced && rawContentFilters.trim()) {
      return rawContentFilters.split(/[\n,]/).map(f => f.trim()).filter(f => f.length > 0);
    }
    return contentFilters
      .filter(f => f.field && f.value)
      .map(f => `${f.type}:~${f.path}.${f.field}:${f.value}`);
  }, [showAdvanced, rawContentFilters, contentFilters]);

  const fetchResults = useCallback(async (off = 0) => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const headerFiltersString = buildHeaderFilters();
      const contentFiltersArray = buildContentFilters();
      const limit = Number(searchParams.limit) || 50;

      const r = await api.analyzerStringQuery(baseUrl, {
        HeaderFilters: headerFiltersString,
        Limit: limit,
        Offset: off,
        ContentFilters: contentFiltersArray,
      }) as AnalyzerResult[];

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      setResponseTime(elapsed);
      setResults(r || []);
      setOffset(off);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setResults([]);
      setResponseTime(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, buildHeaderFilters, buildContentFilters, searchParams.limit]);

  const handleSearch = () => {
    setOffset(0);
    setCurrentPage(1);
    fetchResults(0);
  };

  const limit = Number(searchParams.limit) || 50;

  const handlePrev = () => {
    const newOff = Math.max(0, offset - limit);
    setOffset(newOff);
    setCurrentPage(p => Math.max(1, p - 1));
    fetchResults(newOff);
  };

  const handleNext = () => {
    const newOff = offset + limit;
    setOffset(newOff);
    setCurrentPage(p => p + 1);
    fetchResults(newOff);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Analyzer</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Search captured API calls. Click any row for full details.
      </Typography>

      {/* Time Range */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Time Range</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              size="small" fullWidth label="Start" type="datetime-local"
              value={toDatetimeLocalValue(searchParams.timeStart)}
              onChange={e => {
                const v = e.target.value;
                handleParamChange('timeStart', v ? new Date(v).toISOString() : '');
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              size="small" fullWidth label="End" type="datetime-local"
              value={toDatetimeLocalValue(searchParams.timeEnd)}
              onChange={e => {
                const v = e.target.value;
                handleParamChange('timeEnd', v ? new Date(v).toISOString() : '');
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Quick Select</InputLabel>
              <Select
                label="Quick Select"
                value={searchParams.past}
                onChange={e => handlePastChange(e.target.value as string)}
              >
                <MenuItem value="">None</MenuItem>
                {pastOptions.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              size="small" fullWidth label="Results/Page" type="number"
              value={searchParams.limit}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                handleParamChange('limit', Number.isFinite(v) && v > 0 ? v : 50);
              }}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Request Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Request Filters</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                label="Method"
                value={searchParams.method}
                onChange={e => handleParamChange('method', e.target.value)}
              >
                <MenuItem value="">Any Method</MenuItem>
                {customMethods.length > 0 && (
                  [
                    <MenuItem key="__custom_header" disabled sx={{ fontWeight: 'bold', fontSize: '0.8rem', opacity: 1 }}>
                      -- Custom Methods --
                    </MenuItem>,
                    ...customMethods.map(m => <MenuItem key={`c-${m}`} value={m}>{m}</MenuItem>),
                  ]
                )}
                <MenuItem disabled sx={{ fontWeight: 'bold', fontSize: '0.8rem', opacity: 1 }}>
                  -- Common Methods --
                </MenuItem>
                {commonMethods.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Add custom method..."
                value={newMethodInput}
                onChange={e => setNewMethodInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMethod(); } }}
              />
              <Button size="small" variant="outlined" onClick={handleAddMethod}>+</Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Encoding</InputLabel>
              <Select
                label="Encoding"
                value={searchParams.encoding}
                onChange={e => handleParamChange('encoding', e.target.value)}
              >
                {encodingOptions.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              size="small" fullWidth label="Source (IP)"
              placeholder="e.g., 127.0.0.1"
              value={searchParams.source}
              onChange={e => handleParamChange('source', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              size="small" fullWidth label="Destination"
              placeholder="e.g., local, CoreS"
              value={searchParams.destination}
              onChange={e => handleParamChange('destination', e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Content Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Content Filters</Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addContentFilter}>
            Add Filter
          </Button>
        </Box>
        {contentFilters.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No content filters. Click "Add Filter" to filter by request/reply fields.
          </Typography>
        ) : (
          contentFilters.map(filter => (
            <Grid container spacing={1} key={filter.id} sx={{ mb: 1, alignItems: 'center' }}>
              <Grid item xs={12} md={2}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filter.type}
                    onChange={e => updateContentFilter(filter.id, 'type', e.target.value)}
                  >
                    {contentFilterTypes.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filter.path}
                    onChange={e => updateContentFilter(filter.id, 'path', e.target.value)}
                  >
                    {contentFilterPaths.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  size="small" fullWidth placeholder="Field (e.g., Event.Account)"
                  value={filter.field}
                  onChange={e => updateContentFilter(filter.id, 'field', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small" fullWidth placeholder="Value"
                  value={filter.value}
                  onChange={e => updateContentFilter(filter.id, 'value', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={1}>
                <IconButton size="small" color="error" onClick={() => removeContentFilter(filter.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))
        )}
        <Typography variant="caption" color="text.secondary">
          Examples: Field "Event.Account" = "1001", Field "APIOpts.EventSource" = "*attributes"
        </Typography>
      </Paper>

      {/* Advanced Raw Query Mode */}
      <Box sx={{ mb: 2 }}>
        <Button
          size="small" variant="text"
          onClick={() => setShowAdvanced(!showAdvanced)}
          sx={{ textTransform: 'none', p: 0 }}
        >
          {showAdvanced ? '- Hide' : '+ Show'} Raw Query Mode
        </Button>
      </Box>

      {showAdvanced && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Raw Query Mode</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                size="small" fullWidth multiline rows={2}
                label="Header Filters (Bleve syntax)"
                placeholder='+RequestMethod:"CoreSv1.Ping" +RequestEncoding:\*json'
                value={rawHeaderFilters}
                onChange={e => setRawHeaderFilters(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                size="small" fullWidth multiline rows={2}
                label="Content Filters (one per line)"
                placeholder="*string:~*req.Event.Account:1001"
                value={rawContentFilters}
                onChange={e => setRawContentFilters(e.target.value)}
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary">
            Raw mode overrides the visual filters above. See{' '}
            <Link href="http://blevesearch.com/docs/Query-String-Query/" target="_blank" rel="noopener noreferrer">
              Bleve docs
            </Link>{' '}
            for header filter syntax.
          </Typography>
        </Paper>
      )}

      {/* Search button */}
      <Button variant="contained" fullWidth sx={{ mb: 2 }} onClick={handleSearch}>Search</Button>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Response info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2">
          Response from <strong>{baseUrl}</strong>
          {responseTime && !loading && ` in ${responseTime}s`}
        </Typography>
        {results.length > 0 && (
          <Chip
            size="small"
            label={`${results.length} results (page ${currentPage})`}
            color="default"
          />
        )}
      </Box>

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>Searching analyzer data...</Typography>
        </Box>
      ) : (
        /* Results Table */
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Encoding</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Reply</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length > 0 ? results.map((r, i) => (
                <TableRow
                  key={i} hover sx={{ cursor: 'pointer' }}
                  onClick={() => { setDetail(r); setDetailOpen(true); }}
                >
                  <TableCell>{offset + i + 1}</TableCell>
                  <TableCell>
                    {r.RequestStartTime
                      ? new Date(r.RequestStartTime).toLocaleString(undefined, {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          hour12: false,
                        })
                      : '-'}
                  </TableCell>
                  <TableCell><code style={{ fontSize: 12 }}>{r.RequestMethod || '-'}</code></TableCell>
                  <TableCell>{r.RequestDuration || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.RequestEncoding?.replace('*', '') || '-'}
                      color={encodingColor(r.RequestEncoding)}
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{r.RequestSource || '-'}</TableCell>
                  <TableCell>
                    {r.ReplyError ? (
                      <Chip size="small" label={formatReplyForDisplay(r.ReplyError)} color="error" />
                    ) : (
                      <Chip size="small" label={formatReplyForDisplay(r.Reply)} color="success" />
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">No results available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 2 }}>
        <Button disabled={offset === 0 || loading} onClick={handlePrev}>Previous</Button>
        <Typography variant="body2">
          Page {currentPage} {results.length > 0 && `(${results.length} results)`}
        </Typography>
        <Button disabled={results.length < limit || loading} onClick={handleNext}>Next</Button>
      </Box>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{detail?.RequestMethod || 'Request Details'}</DialogTitle>
        <DialogContent>
          {detail && (
            <Box>
              {/* Structured detail tables */}
              <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Method</TableCell>
                          <TableCell><code>{detail.RequestMethod}</code></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Request ID</TableCell>
                          <TableCell>{detail.RequestID}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Start Time</TableCell>
                          <TableCell>
                            {detail.RequestStartTime
                              ? new Date(detail.RequestStartTime).toLocaleString(undefined, {
                                  year: 'numeric', month: '2-digit', day: '2-digit',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                                  fractionalSecondDigits: 3, hour12: false,
                                })
                              : '-'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                          <TableCell>{detail.RequestDuration}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Encoding</TableCell>
                          <TableCell>{detail.RequestEncoding}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Source</TableCell>
                          <TableCell>{detail.RequestSource || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Destination</TableCell>
                          <TableCell>{detail.RequestDestination}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Reply Status</TableCell>
                          <TableCell>
                            {detail.ReplyError ? (
                              <Chip size="small" label={formatReplyForDisplay(detail.ReplyError)} color="error" />
                            ) : (
                              <Chip size="small" label="OK" color="success" />
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>

              {/* Request Parameters */}
              <Accordion defaultExpanded={false}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Request Parameters</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <CollapsibleJSON data={parseReplyForViewer(detail.RequestParams)} initialExpanded={false} />
                </AccordionDetails>
              </Accordion>

              {/* Reply */}
              <Accordion defaultExpanded={false}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2">Reply</Typography>
                    {detail.ReplyError && <Chip size="small" label="Error" color="error" />}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    bgcolor: detail.ReplyError ? '#fff5f5' : '#f0fff0',
                    p: 2, borderRadius: 1,
                  }}>
                    <CollapsibleJSON
                      data={parseReplyForViewer(detail.ReplyError || detail.Reply)}
                      initialExpanded={false}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
