import { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
  Chip, Checkbox, ListItemText, SelectChangeEvent, FormControlLabel, Switch,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { CDR } from '../types';

const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 30 minutes', value: 30 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 2 hours', value: 120 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 2 days', value: 2880 },
  { label: 'Past 1 week', value: 10080 },
  { label: 'Past 1 month', value: 43200 },
  { label: 'Past 3 months', value: 129600 },
  { label: 'Past 6 months', value: 259200 },
  { label: 'Past 1 year', value: 525600 },
  { label: 'Past 2 years', value: 1051200 },
];

const defaultCategoryOptions = [
  { label: 'Call', value: 'call' },
  { label: 'SMS', value: 'sms' },
  { label: 'SMS A2P', value: 'sms_a2p' },
  { label: 'Data', value: 'data' },
];

function formatNsToHMS(ns: number): string {
  const totalSeconds = Math.floor(ns / 1e9);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatUsage(usage: number, tor: string): string {
  if (tor === '*data') return `${(usage / (1024*1024)).toFixed(2)} MB (${usage} bytes)`;
  if (tor === '*voice') return `${formatNsToHMS(usage)} (${usage} ns)`;
  return String(usage);
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [subject, setSubject] = useState('');
  const [destination, setDestination] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [past, setPast] = useState('');
  const [setupTimeStart, setSetupTimeStart] = useState('');
  const [setupTimeEnd, setSetupTimeEnd] = useState('');
  const [isVerbose, setIsVerbose] = useState(true);

  const [results, setResults] = useState<CDR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [apiQuery, setApiQuery] = useState('');

  // Detail modal
  const [selectedCDR, setSelectedCDR] = useState<CDR | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedExporter, setSelectedExporter] = useState('');
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteAfterExport, setDeleteAfterExport] = useState(false);

  // Delete CDRs modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom categories
  const [customCategories, setCustomCategories] = useState<{ label: string; value: string }[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const categoryOptions = useMemo(() => {
    return [...defaultCategoryOptions, ...customCategories];
  }, [customCategories]);

  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    const exists = categoryOptions.some(opt => opt.value.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setCustomCategories(prev => [...prev, { label: trimmed, value: trimmed }]);
    }
    setNewCategoryInput('');
  };

  const handlePastChange = (value: string) => {
    const minutes = parseInt(value);
    if (!minutes) {
      setPast('');
      return;
    }
    setPast(value);
    const now = new Date();
    const start = new Date(now.getTime() - minutes * 60000);
    setSetupTimeStart(start.toISOString());
    setSetupTimeEnd(now.toISOString());
  };

  // Build query params (shared by fetch, export, delete)
  const buildQueryParams = useCallback(() => {
    const params: Record<string, unknown> = {};
    if (setupTimeStart) params.SetupTimeStart = setupTimeStart;
    if (setupTimeEnd) params.SetupTimeEnd = setupTimeEnd;
    if (tenant) params.Tenants = [tenant];
    if (account) params.Accounts = account.split(',').map(a => a.trim());
    if (subject) params.Subjects = subject.split(',').map(s => s.trim());
    if (categories.length > 0) params.Categories = categories;
    if (destination) params.DestinationPrefixes = destination.split(',').map(d => d.trim());
    return params;
  }, [setupTimeStart, setupTimeEnd, tenant, account, subject, categories, destination]);

  const fetchCDRs = useCallback(async (off = 0) => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    const params = { ...buildQueryParams(), Limit: limit, Offset: off };

    const queryObj = { method: 'CDRsV2.GetCDRs', params: [params], id: 0 };
    setApiQuery(JSON.stringify(queryObj, null, 2));

    try {
      const data = await api.getCDRs(baseUrl, params) as CDR[];
      const endTime = Date.now();
      setResponseTime(((endTime - startTime) / 1000).toFixed(2));
      setResults(data || []);
      setOffset(off);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch CDRs');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, buildQueryParams, limit]);

  const handleExport = useCallback(async () => {
    if (!baseUrl || !selectedExporter) return;
    setIsExporting(true);
    setExportResult(null);
    setDeleteResult(null);
    try {
      const params = { ...buildQueryParams(), ExporterIDs: [selectedExporter], Verbose: isVerbose };
      const result = await api.exportCDRs(baseUrl, params);
      setExportResult(JSON.stringify(result, null, 2));

      // Delete after export if requested
      if (deleteAfterExport) {
        setIsDeleting(true);
        try {
          const delResult = await api.removeCDRs(baseUrl, buildQueryParams());
          setDeleteResult(JSON.stringify(delResult, null, 2));
        } catch (e: unknown) {
          setDeleteResult(e instanceof Error ? e.message : 'Delete failed');
        } finally {
          setIsDeleting(false);
        }
      }
    } catch (e: unknown) {
      setExportResult(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [baseUrl, selectedExporter, isVerbose, deleteAfterExport, buildQueryParams]);

  const handleDeleteCDRs = useCallback(async () => {
    if (!baseUrl) return;
    if (!window.confirm('Are you sure you want to delete CDRs matching the current query? This cannot be undone.')) return;
    setIsDeleting(true);
    setDeleteResult(null);
    try {
      const result = await api.removeCDRs(baseUrl, buildQueryParams());
      setDeleteResult(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      setDeleteResult(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }, [baseUrl, buildQueryParams]);

  const categoryTotals = useMemo(() => {
    const acc: Record<string, { cost: number; count: number }> = {};
    for (const r of results) {
      const cat = r.Category || 'unknown';
      if (!acc[cat]) acc[cat] = { cost: 0, count: 0 };
      if (r.Cost >= 0) acc[cat].cost += r.Cost;
      acc[cat].count++;
    }
    return acc;
  }, [results]);

  const handleCategorySelect = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setCategories(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>CDRs</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Time Range</InputLabel>
            <Select value={past} label="Time Range" onChange={e => handlePastChange(e.target.value)}>
              <MenuItem value="">Custom</MenuItem>
              {pastOptions.map(o => <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Start Time" type="datetime-local" value={setupTimeStart ? setupTimeStart.slice(0, 16) : ''} onChange={e => { setSetupTimeStart(e.target.value ? new Date(e.target.value).toISOString() : ''); setPast(''); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
          <TextField size="small" label="End Time" type="datetime-local" value={setupTimeEnd ? setupTimeEnd.slice(0, 16) : ''} onChange={e => { setSetupTimeEnd(e.target.value ? new Date(e.target.value).toISOString() : ''); setPast(''); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end', mt: 2 }}>
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} placeholder="Comma-separated" />
          <TextField size="small" label="Subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Comma-separated" />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Prefix" />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Category</InputLabel>
            <Select multiple value={categories} label="Category" onChange={handleCategorySelect}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map(v => <Chip key={v} label={v} size="small" />)}
                </Box>
              )}>
              {categoryOptions.map(o => (
                <MenuItem key={o.value} value={o.value}>
                  <Checkbox checked={categories.indexOf(o.value) > -1} size="small" />
                  <ListItemText primary={o.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
            <TextField size="small" label="Add Category" value={newCategoryInput}
              onChange={e => setNewCategoryInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              sx={{ width: 130 }}
            />
            <Button size="small" variant="outlined" onClick={handleAddCategory}>Add</Button>
          </Box>
          <TextField size="small" label="Limit" type="number" value={limit} onChange={e => setLimit(parseInt(e.target.value) || 50)} sx={{ width: 100 }} />
          <Button variant="contained" onClick={() => fetchCDRs(0)}>Search</Button>
          <Button variant="outlined" color="secondary" onClick={() => setExportOpen(true)}>Export</Button>
          <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>Delete CDRs</Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {responseTime && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Response from CGrateS in {responseTime} seconds
        </Typography>
      )}

      {apiQuery && (
        <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary">API Query:</Typography>
          <pre style={{ fontSize: 11, margin: 0 }}>{apiQuery}</pre>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Setup Time</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Destination</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.length > 0 ? results.map((cdr, idx) => (
                  <TableRow key={idx} hover sx={{ cursor: 'pointer' }} onClick={() => { setSelectedCDR(cdr); setDetailOpen(true); }}>
                    <TableCell>{offset + idx + 1}</TableCell>
                    <TableCell>{new Date(cdr.SetupTime).toLocaleString()}</TableCell>
                    <TableCell>{cdr.Account}</TableCell>
                    <TableCell>{cdr.Subject}</TableCell>
                    <TableCell>{cdr.Category}</TableCell>
                    <TableCell>{cdr.Destination}</TableCell>
                    <TableCell>{cdr.Cost}</TableCell>
                    <TableCell>{formatUsage(cdr.Usage, cdr.ToR)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={8} align="center">No CDRs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Button disabled={offset === 0} onClick={() => fetchCDRs(Math.max(0, offset - limit))}>Previous</Button>
            <Typography sx={{ py: 1 }}>Page {Math.floor(offset / limit) + 1}</Typography>
            <Button disabled={results.length < limit} onClick={() => fetchCDRs(offset + limit)}>Next</Button>
          </Box>

          {results.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1">Totals by Category</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Count</TableCell><TableCell>Total Cost</TableCell></TableRow></TableHead>
                <TableBody>
                  {Object.entries(categoryTotals).map(([cat, v]) => (
                    <TableRow key={cat}><TableCell>{cat}</TableCell><TableCell>{v.count}</TableCell><TableCell>{v.cost.toFixed(4)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      {/* CDR Detail Modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>CDR Details</DialogTitle>
        <DialogContent>
          {selectedCDR && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {Object.entries(selectedCDR).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell><strong>{key}</strong></TableCell>
                      <TableCell>{key === 'Usage' ? formatUsage(value as number, selectedCDR.ToR) : (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Export CDRs</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField size="small" label="Exporter ID" value={selectedExporter} onChange={e => setSelectedExporter(e.target.value)} placeholder="Enter exporter ID" fullWidth />
            <FormControlLabel control={<Switch checked={isVerbose} onChange={e => setIsVerbose(e.target.checked)} />} label="Verbose" />
            <FormControlLabel control={<Switch checked={deleteAfterExport} onChange={e => setDeleteAfterExport(e.target.checked)} />} label="Delete CDRs after export" />
            {exportResult && (
              <Paper sx={{ p: 1, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                <Typography variant="caption">Export Result:</Typography>
                <pre style={{ fontSize: 11, margin: 0 }}>{exportResult}</pre>
              </Paper>
            )}
            {deleteResult && (
              <Paper sx={{ p: 1, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
                <Typography variant="caption">Delete Result:</Typography>
                <pre style={{ fontSize: 11, margin: 0 }}>{deleteResult}</pre>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleExport} disabled={isExporting || !selectedExporter}>
            {isExporting ? <CircularProgress size={20} /> : 'Export'}
          </Button>
          <Button onClick={() => setExportOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete CDRs Modal */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete CDRs</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
            This will permanently delete all CDRs matching the current search criteria. This action cannot be undone.
          </Alert>
          <Paper sx={{ p: 1, bgcolor: 'grey.50', mb: 2 }}>
            <Typography variant="caption">Query params:</Typography>
            <pre style={{ fontSize: 11, margin: 0 }}>{JSON.stringify(buildQueryParams(), null, 2)}</pre>
          </Paper>
          {deleteResult && (
            <Paper sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption">Result:</Typography>
              <pre style={{ fontSize: 11, margin: 0 }}>{deleteResult}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" onClick={handleDeleteCDRs} disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={20} /> : 'Delete CDRs'}
          </Button>
          <Button onClick={() => setDeleteOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
