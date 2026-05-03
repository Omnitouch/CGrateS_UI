import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, Chip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { ScheduledAction } from '../types';

function getRelativeTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  try {
    const diffMs = new Date(dateTimeStr).getTime() - Date.now();
    if (diffMs < 0) return 'Overdue';
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMinutes < 60) return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
  } catch { return ''; }
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [results, setResults] = useState<ScheduledAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScheduledAction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const pageSize = 10;

  const fetchResults = useCallback(async (p = 0) => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try {
      const r = await api.getScheduledActions(baseUrl, p * pageSize, pageSize) as ScheduledAction[];
      setResults(r || []);
      setPage(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const handleDelete = useCallback(async (actionPlanId: string) => {
    if (!baseUrl || !window.confirm(`Are you sure you want to delete the action plan: ${actionPlanId}?`)) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await api.removeActionPlan(baseUrl, actionPlanId, tenant);
      setDetailOpen(false);
      fetchResults(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }, [baseUrl, tenant, page, fetchResults]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Upcoming Action Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={() => fetchResults(0)}>Fetch Scheduled Actions</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Action Plan ID</TableCell>
                <TableCell>Actions ID</TableCell>
                <TableCell>Next Run Time</TableCell>
                <TableCell>Accounts</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length > 0 ? results.map((item, i) => {
                const relative = getRelativeTime(item.NextRunTime);
                return (
                  <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(item); setDetailOpen(true); }}>
                    <TableCell>{page * pageSize + i + 1}</TableCell>
                    <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.ActionPlanID}>{item.ActionPlanID}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.ActionsID}>{item.ActionsID}</TableCell>
                    <TableCell>
                      {new Date(item.NextRunTime).toLocaleString()}
                      {relative && <Typography variant="caption" color="text.secondary" display="block">({relative})</Typography>}
                    </TableCell>
                    <TableCell><Chip label={item.Accounts} size="small" color={item.Accounts > 0 ? 'success' : 'default'} /></TableCell>
                  </TableRow>
                );
              }) : <TableRow><TableCell colSpan={5} align="center">No upcoming action plans</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
        <Button disabled={page === 0} onClick={() => fetchResults(page - 1)}>Previous</Button>
        <Typography sx={{ py: 1 }}>Page {page + 1}</Typography>
        <Button disabled={results.length < pageSize} onClick={() => fetchResults(page + 1)}>Next</Button>
      </Box>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Scheduled Action Details</DialogTitle>
        <DialogContent>
          {detail && (
            <Box sx={{ mt: 1 }}>
              <Typography><strong>Action Plan ID:</strong> {detail.ActionPlanID}</Typography>
              <Typography><strong>Actions ID:</strong> {detail.ActionsID}</Typography>
              <Typography><strong>Action Timing UUID:</strong> {detail.ActionTimingUUID}</Typography>
              <Typography>
                <strong>Next Run Time:</strong> {new Date(detail.NextRunTime).toLocaleString()}
                {getRelativeTime(detail.NextRunTime) && <Chip label={getRelativeTime(detail.NextRunTime)} size="small" sx={{ ml: 1 }} color="info" />}
              </Typography>
              <Typography>
                <strong>Accounts:</strong> <Chip label={detail.Accounts} size="small" color={detail.Accounts > 0 ? 'success' : 'default'} />
              </Typography>
              {detail.Accounts === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>This action plan has 0 accounts associated with it and may not execute.</Alert>
              )}
              <Typography variant="subtitle2" sx={{ mt: 2 }}>Raw Data</Typography>
              <Paper sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
                <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => detail && handleDelete(detail.ActionPlanID)} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting...' : 'Delete Action Plan'}
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
