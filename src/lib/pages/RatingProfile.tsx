import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState('');

  const fetchProfiles = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const result = await api.getRatingProfileIDs(baseUrl);
      setProfiles(result || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const fetchDetail = useCallback(async (profileStr: string) => {
    if (!baseUrl) return;
    const [category, subject] = profileStr.split(':');
    try {
      const result = await api.getRatingProfile(baseUrl, category, subject);
      setDetail(result);
      setEditJson(JSON.stringify(result, null, 2));
      setEditing(false);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch detail');
    }
  }, [baseUrl]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const parsed = JSON.parse(editJson);
      await api.setRatingProfile(baseUrl, { Overwrite: true, ...parsed });
      setDetailOpen(false);
      fetchProfiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, editJson, fetchProfiles]);

  const handleDelete = useCallback(async (profileStr: string) => {
    if (!baseUrl || !window.confirm(`Delete ${profileStr}?`)) return;
    const [category, subject] = profileStr.split(':');
    try {
      await api.removeRatingProfile(baseUrl, category, subject);
      fetchProfiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }, [baseUrl, fetchProfiles]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setEditJson(JSON.stringify({ Category: '', Subject: '', RatingPlanActivations: [{ ActivationTime: '', RatingPlanId: '', FallbackSubjects: '' }] }, null, 2));
    setEditing(true);
    setDetailOpen(true);
  }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Rating Profiles</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={fetchProfiles}>Fetch Profiles</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate}>Create New</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>Profile ID</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {profiles.length > 0 ? profiles.map((p, i) => (
                <TableRow key={p} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(p)}>
                  <TableCell>{i + 1}</TableCell><TableCell>{p}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(p); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} align="center">No profiles found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Rating Profile</DialogTitle>
        <DialogContent>
          {editing ? (
            <TextField multiline fullWidth minRows={15} value={editJson} onChange={e => setEditJson(e.target.value)} sx={{ fontFamily: 'monospace', mt: 1 }} />
          ) : (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'grey.50', mt: 1 }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
