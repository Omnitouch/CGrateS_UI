import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Select, MenuItem, FormControl, InputLabel, Tabs, Tab,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';

interface RatingPlanActivation {
  ActivationTime: string;
  RatingPlanId: string;
  FallbackSubjects: string;
}

interface RatingProfileForm {
  Category: string;
  Subject: string;
  RatingPlanActivations: RatingPlanActivation[];
}

const emptyActivation = (): RatingPlanActivation => ({
  ActivationTime: '',
  RatingPlanId: '',
  FallbackSubjects: '',
});

const emptyForm = (): RatingProfileForm => ({
  Category: '',
  Subject: '',
  RatingPlanActivations: [emptyActivation()],
});

const toForm = (data: Record<string, unknown>): RatingProfileForm => ({
  Category: (data.Category as string) || '',
  Subject: (data.Subject as string) || '',
  RatingPlanActivations: Array.isArray(data.RatingPlanActivations)
    ? (data.RatingPlanActivations as RatingPlanActivation[]).map(a => ({
        ActivationTime: a.ActivationTime || '',
        RatingPlanId: a.RatingPlanId || '',
        FallbackSubjects: a.FallbackSubjects || '',
      }))
    : [emptyActivation()],
});

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RatingProfileForm>(emptyForm());
  const [dialogTab, setDialogTab] = useState(0);
  const [tpids, setTpids] = useState<string[]>([]);
  const [selectedTpid, setSelectedTpid] = useState('');
  const [ratingPlanIds, setRatingPlanIds] = useState<string[]>([]);

  const fetchTpids = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const result = await api.getTPIds(baseUrl);
      setTpids(result || []);
      if (result && result.length > 0) setSelectedTpid(result[0]);
    } catch { setTpids([]); }
  }, [baseUrl]);

  const fetchRatingPlanIds = useCallback(async (tpid: string) => {
    if (!baseUrl || !tpid) return;
    try {
      const result = await api.getTPRatingPlanIds(baseUrl, tpid);
      setRatingPlanIds(result || []);
    } catch { setRatingPlanIds([]); }
  }, [baseUrl]);

  useEffect(() => { fetchTpids(); }, [fetchTpids]);

  useEffect(() => {
    if (selectedTpid) fetchRatingPlanIds(selectedTpid);
  }, [selectedTpid, fetchRatingPlanIds]);

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

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const fetchDetail = useCallback(async (profileStr: string) => {
    if (!baseUrl) return;
    const [category, subject] = profileStr.split(':');
    try {
      const result = await api.getRatingProfile(baseUrl, category, subject);
      setDetail(result);
      setForm(toForm(result as Record<string, unknown>));
      setEditing(false);
      setDialogTab(0);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch detail');
    }
  }, [baseUrl]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    try {
      await api.setRatingProfile(baseUrl, { Overwrite: true, ...form } as unknown as Record<string, unknown>);
      setDetailOpen(false);
      fetchProfiles();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }, [baseUrl, form, fetchProfiles]);

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
    setForm(emptyForm());
    setEditing(true);
    setDialogTab(0);
    setDetailOpen(true);
  }, []);

  const updateForm = (field: keyof RatingProfileForm, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateActivation = (index: number, field: keyof RatingPlanActivation, value: string) => {
    setForm(prev => {
      const acts = [...prev.RatingPlanActivations];
      acts[index] = { ...acts[index], [field]: value };
      return { ...prev, RatingPlanActivations: acts };
    });
  };

  const addActivation = () => {
    setForm(prev => ({ ...prev, RatingPlanActivations: [...prev.RatingPlanActivations, emptyActivation()] }));
  };

  const removeActivation = (index: number) => {
    setForm(prev => ({ ...prev, RatingPlanActivations: prev.RatingPlanActivations.filter((_, i) => i !== index) }));
  };

  const renderStructuredView = () => {
    const d = detail as Record<string, unknown> | null;
    if (!d) return null;
    const activations = (d.RatingPlanActivations as RatingPlanActivation[]) || [];
    return (
      <Box sx={{ mt: 1 }}>
        <Table size="small">
          <TableBody>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell><TableCell>{d.Category as string}</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontWeight: 'bold' }}>Subject</TableCell><TableCell>{d.Subject as string}</TableCell></TableRow>
          </TableBody>
        </Table>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Rating Plan Activations ({activations.length})</Typography>
        {activations.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ActivationTime</TableCell>
                  <TableCell>RatingPlanId</TableCell>
                  <TableCell>FallbackSubjects</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activations.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>{a.ActivationTime || '-'}</TableCell>
                    <TableCell>{a.RatingPlanId}</TableCell>
                    <TableCell>{a.FallbackSubjects || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">No activations</Typography>
        )}
      </Box>
    );
  };

  const renderEditForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Tabs value={dialogTab} onChange={(_, v) => setDialogTab(v)}>
        <Tab label="Fields" />
        <Tab label="Raw Data" />
      </Tabs>
      {dialogTab === 0 ? (
        <>
          <TextField label="Category" size="small" fullWidth value={form.Category} onChange={e => updateForm('Category', e.target.value)} />
          <TextField label="Subject" size="small" fullWidth value={form.Subject} onChange={e => updateForm('Subject', e.target.value)} />

          {tpids.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>Tariff Plan (for Rating Plan lookup)</InputLabel>
              <Select value={selectedTpid} label="Tariff Plan (for Rating Plan lookup)" onChange={e => setSelectedTpid(e.target.value)}>
                {tpids.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">Rating Plan Activations</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addActivation}>Add Activation</Button>
          </Box>
          {form.RatingPlanActivations.map((act, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight="bold">Activation {idx + 1}</Typography>
                <IconButton size="small" color="error" onClick={() => removeActivation(idx)} disabled={form.RatingPlanActivations.length <= 1}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField label="ActivationTime" size="small" fullWidth value={act.ActivationTime} onChange={e => updateActivation(idx, 'ActivationTime', e.target.value)} helperText="e.g. 2024-01-01T00:00:00Z" />
                {ratingPlanIds.length > 0 ? (
                  <FormControl size="small" fullWidth>
                    <InputLabel>RatingPlanId</InputLabel>
                    <Select value={act.RatingPlanId} label="RatingPlanId" onChange={e => updateActivation(idx, 'RatingPlanId', e.target.value as string)}>
                      <MenuItem value="">-- Select --</MenuItem>
                      {ratingPlanIds.map(rp => <MenuItem key={rp} value={rp}>{rp}</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField label="RatingPlanId" size="small" fullWidth value={act.RatingPlanId} onChange={e => updateActivation(idx, 'RatingPlanId', e.target.value)} />
                )}
                <TextField label="FallbackSubjects" size="small" fullWidth value={act.FallbackSubjects} onChange={e => updateActivation(idx, 'FallbackSubjects', e.target.value)} />
              </Box>
            </Paper>
          ))}
        </>
      ) : (
        <Paper sx={{ p: 1, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(form, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );

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
                    <IconButton size="small" onClick={e => { e.stopPropagation(); fetchDetail(p); }}><EditIcon fontSize="small" /></IconButton>
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
          {editing ? renderEditForm() : renderStructuredView()}
        </DialogContent>
        <DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave}>Save</Button> : <Button onClick={() => { setForm(toForm(detail as Record<string, unknown>)); setEditing(true); }}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
