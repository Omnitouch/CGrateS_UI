import { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import type { RouteResult } from '../types';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [results, setResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);
  const [apiQuery, setApiQuery] = useState('');

  // Detail modal
  const [detail, setDetail] = useState<RouteResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchRoutes = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    const startTime = Date.now();
    const params = {
      IgnoreErrors: true,
      Tenant: tenant,
      ID: 'OmniWeb',
      Event: {
        Account: account,
        Tenant: tenant,
        Subject: account,
        SetupTime: new Date().toISOString().slice(0, 19),
        Destination: destination,
        Usage: '1m',
      },
    };
    setApiQuery(JSON.stringify({ method: 'RouteSv1.GetRoutes', params: [params], id: 1 }, null, 2));
    try {
      const r = await api.getRoutes(baseUrl, params) as RouteResult[];
      const endTime = Date.now();
      setResponseTime(((endTime - startTime) / 1000).toFixed(2));
      setResults(r || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setResults([]); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, account, destination]);

  const blockRoute = useCallback(async (routeDestination: string, ratingPlanID: string) => {
    if (!baseUrl) return;
    try {
      const operatorName = ratingPlanID.split('_').pop();
      const filterId = `Filter_Operator_Route_Blacklist_${operatorName}`;

      // Fetch existing filter
      const existingFilter = await api.getFilter(baseUrl, tenant, filterId) as Record<string, unknown>;
      const existingRules = (existingFilter?.Rules || []) as Record<string, unknown>[];

      // Add new rule
      const updatedRules = [...existingRules, { Type: '*notprefix', Element: '~*req.Destination', Values: [routeDestination] }];

      await api.setFilter(baseUrl, {
        ID: filterId,
        Rules: updatedRules,
        ActivationInterval: { ActivationTime: '0001-01-01T00:00:00Z', ExpiryTime: '0001-01-01T00:00:00Z' },
      });

      alert(`Route for destination ${routeDestination} blocked for operator ${operatorName}.`);
    } catch (e: unknown) {
      alert(`Failed to block route: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [baseUrl, tenant]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Route Lookup</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenant} label="Tenant" onChange={e => setTenant(e.target.value)}>
              {tenants.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Account" value={account} onChange={e => setAccount(e.target.value)} />
          <TextField size="small" label="Destination" value={destination} onChange={e => setDestination(e.target.value)} />
          <Button variant="contained" onClick={fetchRoutes}>Search</Button>
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
          <pre style={{ fontSize: 11, margin: 0 }}>{apiQuery}</pre>
        </Paper>
      )}

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Profile ID</TableCell>
                <TableCell>Sorting</TableCell>
                <TableCell>Routes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length > 0 ? results.map((r, i) => (
                <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetail(r); setDetailOpen(true); }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.ProfileID}</TableCell>
                  <TableCell>{r.Sorting}</TableCell>
                  <TableCell>
                    {r.Routes?.map((rt, ri) => (
                      <Box key={ri} sx={{ mb: 0.5 }}>
                        <strong>{rt.RouteID}</strong> - Cost: {rt.SortingData?.Cost} | RatingPlanID: {rt.SortingData?.RatingPlanID}
                      </Box>
                    ))}
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} align="center">No results</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Route Details{detail ? `: ${detail.ProfileID}` : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            To blacklist a route for a specific operator, click the "Block" button below.
          </Typography>
          {detail && (
            <Box sx={{ mt: 1 }}>
              <Typography><strong>Profile ID:</strong> {detail.ProfileID}</Typography>
              <Typography><strong>Sorting:</strong> {detail.Sorting}</Typography>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Route ID</TableCell>
                      <TableCell>Cost</TableCell>
                      <TableCell>Rating Plan ID</TableCell>
                      <TableCell>Weight</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.Routes?.map((rt, i) => (
                      <TableRow key={i}>
                        <TableCell>{rt.RouteID}</TableCell>
                        <TableCell>{rt.SortingData?.Cost}</TableCell>
                        <TableCell>{rt.SortingData?.RatingPlanID}</TableCell>
                        <TableCell>{rt.SortingData?.Weight}</TableCell>
                        <TableCell>
                          <Button size="small" color="error" variant="outlined"
                            onClick={() => blockRoute(destination, rt.SortingData?.RatingPlanID)}>
                            Block for Destination
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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
