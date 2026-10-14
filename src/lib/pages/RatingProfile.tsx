import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Tabs, Tab, Checkbox, FormControlLabel, Chip, Tooltip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect, { splitIds, joinIds } from '../components/IdMultiSelect';
import CachingSelect, { cachingOpts } from '../components/CachingSelect';

type Source = 'live' | 'tp';

interface RatingPlanActivation {
  ActivationTime: string;
  RatingPlanId: string;
  FallbackSubjects: string;
}

/** engine.RatingProfile as returned by GetRatingProfile. */
interface LiveProfile {
  Id: string;
  RatingPlanActivations: { ActivationTime: string; RatingPlanId: string; FallbackKeys: string[] | null }[] | null;
}

/** utils.TPRatingProfile. */
interface TPProfile {
  TPid: string;
  LoadId: string;
  Tenant: string;
  Category: string;
  Subject: string;
  RatingPlanActivations: RatingPlanActivation[] | null;
}

interface ProfileForm {
  LoadId: string;
  Tenant: string;
  Category: string;
  Subject: string;
  RatingPlanActivations: RatingPlanActivation[];
}

const emptyActivation = (): RatingPlanActivation => ({ ActivationTime: '', RatingPlanId: '', FallbackSubjects: '' });

/** "*out:tenant:category:subject"; the subject may itself contain ":". */
function parseLiveKey(key: string) {
  const parts = key.split(':');
  return { tenant: parts[1] || '', category: parts[2] || '', subject: parts.slice(3).join(':') };
}

/** GetRatingProfileIDs strips "*out:tenant:", leaving "category:subject". */
function splitLiveId(id: string) {
  const i = id.indexOf(':');
  return { category: id.slice(0, i), subject: id.slice(i + 1) };
}

/** TP ids are "loadid:tenant:category:subject". */
function tpProfileId(f: { LoadId: string; Tenant: string; Category: string; Subject: string }) {
  return [f.LoadId, f.Tenant, f.Category, f.Subject].join(':');
}

const fallbackSubject = (key: string) => parseLiveKey(key).subject;

function liveToForm(p: LiveProfile): ProfileForm {
  const { tenant, category, subject } = parseLiveKey(p.Id);
  const acts = p.RatingPlanActivations || [];
  return {
    LoadId: '', Tenant: tenant, Category: category, Subject: subject,
    RatingPlanActivations: acts.length ? acts.map(a => ({
      ActivationTime: a.ActivationTime,
      RatingPlanId: a.RatingPlanId,
      FallbackSubjects: joinIds((a.FallbackKeys || []).map(fallbackSubject)),
    })) : [emptyActivation()],
  };
}

function tpToForm(p: TPProfile): ProfileForm {
  const acts = p.RatingPlanActivations || [];
  return {
    LoadId: p.LoadId, Tenant: p.Tenant, Category: p.Category, Subject: p.Subject,
    RatingPlanActivations: acts.length ? acts.map(a => ({ ...a })) : [emptyActivation()],
  };
}

const isNotFound = (e: unknown) => e instanceof Error && e.message.includes('NOT_FOUND');
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

function FallbackChips({ keys }: { keys: string[] }) {
  if (!keys.length) return <>-</>;
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {keys.map(k => <Tooltip key={k} title={k}><Chip size="small" label={fallbackSubject(k) || k} /></Tooltip>)}
    </Box>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [source, setSource] = useState<Source>('live');
  const [tenant, setTenant] = useState(defaultTenant);
  const [tpids, setTpids] = useState<string[]>([]);
  const [tpid, setTpid] = useState('');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [listInfo, setListInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<LiveProfile | TPProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ LoadId: '', Tenant: '', Category: '', Subject: '', RatingPlanActivations: [emptyActivation()] });
  const [dialogTab, setDialogTab] = useState(0);
  const [overwrite, setOverwrite] = useState(true);
  const [caching, setCaching] = useState('');
  const [ratingPlanIds, setRatingPlanIds] = useState<string[]>([]);

  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeCaching, setRemoveCaching] = useState('');

  useEffect(() => {
    if (!baseUrl) return;
    api.getTPIds(baseUrl).then(r => setTpids(r || [])).catch(e => setError(errMsg(e, 'Failed to load tariff plans')));
  }, [baseUrl]);

  // SetRatingProfile checks plans in DataDB, SetTPRatingProfile has no check: offer what each side has.
  useEffect(() => {
    if (!baseUrl) return;
    if (source === 'live') {
      api.getRatingPlanIDs(baseUrl)
        .then(r => setRatingPlanIds(r || []))
        .catch(e => { if (isNotFound(e)) setRatingPlanIds([]); else setError(errMsg(e, 'Failed to load rating plans')); });
    } else if (tpid) {
      api.getTPRatingPlanIds(baseUrl, tpid)
        .then(r => setRatingPlanIds(r || []))
        .catch(e => setError(errMsg(e, 'Failed to load rating plans')));
    } else {
      setRatingPlanIds([]);
    }
  }, [baseUrl, source, tpid]);

  const fetchProfiles = useCallback(async () => {
    if (!baseUrl) return;
    if (source === 'tp' && !tpid) return;
    setLoading(true);
    setError(null);
    setListInfo(null);
    try {
      const result = source === 'live'
        ? await api.getRatingProfileIDs(baseUrl, tenant, search.trim() || undefined)
        : await api.getTPRatingProfileIds(baseUrl, tpid, search.trim() || undefined);
      setProfiles(result || []);
      if (!result || result.length === 0) setListInfo('No rating profiles');
    } catch (e: unknown) {
      setProfiles([]);
      if (isNotFound(e)) setListInfo('No rating profiles');
      else setError(errMsg(e, 'Failed to fetch'));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, source, tenant, tpid, search]);

  useEffect(() => { setProfiles([]); setListInfo(null); }, [source]);
  useEffect(() => { if (source === 'live') fetchProfiles(); }, [source, tenant, baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDetail = useCallback(async (id: string) => {
    if (!baseUrl) return;
    try {
      if (source === 'live') {
        const { category, subject } = splitLiveId(id);
        const result = await api.getRatingProfile(baseUrl, tenant, category, subject) as LiveProfile;
        setDetail(result);
        setForm(liveToForm(result));
      } else {
        const result = await api.getTPRatingProfile(baseUrl, tpid, id) as TPProfile;
        setDetail(result);
        setForm(tpToForm(result));
      }
      setEditing(false);
      setIsNew(false);
      setOverwrite(true);
      setCaching('');
      setDialogTab(0);
      setDetailOpen(true);
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to fetch detail'));
    }
  }, [baseUrl, source, tenant, tpid]);

  const handleSave = useCallback(async () => {
    if (!baseUrl) return;
    const acts = form.RatingPlanActivations;
    if (!form.Category || !form.Subject) { setError('Category and Subject are required'); return; }
    if (acts.some(a => !a.ActivationTime || !a.RatingPlanId)) { setError('Every activation needs an ActivationTime and a RatingPlanId'); return; }
    try {
      if (source === 'live') {
        await api.setRatingProfile(baseUrl, {
          Tenant: tenant, Category: form.Category, Subject: form.Subject,
          Overwrite: overwrite, RatingPlanActivations: acts, APIOpts: cachingOpts(caching),
        });
      } else {
        if (!form.LoadId) { setError('LoadId is required'); return; }
        await api.setTPRatingProfile(baseUrl, {
          TPid: tpid, LoadId: form.LoadId, Tenant: form.Tenant, Category: form.Category, Subject: form.Subject,
          RatingPlanActivations: acts,
        });
      }
      setDetailOpen(false);
      fetchProfiles();
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to save'));
    }
  }, [baseUrl, source, tenant, tpid, form, overwrite, caching, fetchProfiles]);

  const handleRemove = useCallback(async () => {
    if (!baseUrl || !removeTarget) return;
    try {
      if (source === 'live') {
        const { category, subject } = splitLiveId(removeTarget);
        await api.removeRatingProfile(baseUrl, tenant, category, subject, cachingOpts(removeCaching));
      } else {
        await api.removeTPRatingProfile(baseUrl, tpid, removeTarget);
      }
      setRemoveTarget(null);
      fetchProfiles();
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to delete'));
    }
  }, [baseUrl, source, tenant, tpid, removeTarget, removeCaching, fetchProfiles]);

  const handleCreate = useCallback(() => {
    setDetail(null);
    setForm({ LoadId: '', Tenant: source === 'live' ? tenant : defaultTenant, Category: '', Subject: '', RatingPlanActivations: [emptyActivation()] });
    setEditing(true);
    setIsNew(true);
    setOverwrite(true);
    setCaching('');
    setDialogTab(0);
    setDetailOpen(true);
  }, [source, tenant, defaultTenant]);

  const updateForm = (field: keyof ProfileForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const updateActivation = (index: number, field: keyof RatingPlanActivation, value: string) => {
    setForm(prev => {
      const acts = [...prev.RatingPlanActivations];
      acts[index] = { ...acts[index], [field]: value };
      return { ...prev, RatingPlanActivations: acts };
    });
  };

  const addActivation = () => setForm(prev => ({ ...prev, RatingPlanActivations: [...prev.RatingPlanActivations, emptyActivation()] }));
  const removeActivation = (index: number) => setForm(prev => ({ ...prev, RatingPlanActivations: prev.RatingPlanActivations.filter((_, i) => i !== index) }));

  const renderStructuredView = () => {
    if (!detail) return null;
    const isLive = 'Id' in detail;
    const key = isLive ? parseLiveKey(detail.Id) : null;
    const fields: [string, string][] = isLive
      ? [['Tenant', key!.tenant], ['Category', key!.category], ['Subject', key!.subject]]
      : [['TPid', detail.TPid], ['LoadId', detail.LoadId], ['Tenant', detail.Tenant], ['Category', detail.Category], ['Subject', detail.Subject]];
    const acts = detail.RatingPlanActivations || [];
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">{isLive ? 'Live DataDB profile' : 'StorDB tariff plan profile'}</Typography>
        <Table size="small">
          <TableBody>
            {fields.map(([k, v]) => <TableRow key={k}><TableCell sx={{ fontWeight: 'bold' }}>{k}</TableCell><TableCell>{v}</TableCell></TableRow>)}
          </TableBody>
        </Table>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Rating Plan Activations ({acts.length})</Typography>
        {acts.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ActivationTime</TableCell>
                  <TableCell>RatingPlanId</TableCell>
                  <TableCell>{isLive ? 'FallbackKeys' : 'FallbackSubjects'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {acts.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>{a.ActivationTime || '-'}</TableCell>
                    <TableCell>{a.RatingPlanId}</TableCell>
                    <TableCell>
                      {'FallbackKeys' in a
                        ? <FallbackChips keys={a.FallbackKeys || []} />
                        : <FallbackChips keys={splitIds((a as RatingPlanActivation).FallbackSubjects)} />}
                    </TableCell>
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
          {source === 'tp' && (
            <>
              <TextField label="LoadId" size="small" fullWidth value={form.LoadId} onChange={e => updateForm('LoadId', e.target.value)} disabled={!isNew} />
              <TextField label="Tenant" size="small" fullWidth value={form.Tenant} onChange={e => updateForm('Tenant', e.target.value)} disabled={!isNew}
                helperText="Empty uses the server's default tenant" />
            </>
          )}
          <TextField label="Category" size="small" fullWidth value={form.Category} onChange={e => updateForm('Category', e.target.value)} disabled={!isNew} />
          <TextField label="Subject" size="small" fullWidth value={form.Subject} onChange={e => updateForm('Subject', e.target.value)} disabled={!isNew} helperText="*any matches every subject" />

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
                <SearchableSelect
                  label={source === 'live' ? 'RatingPlanId (loaded in DataDB)' : `RatingPlanId (tariff plan ${tpid})`}
                  value={act.RatingPlanId} options={ratingPlanIds} onChange={v => updateActivation(idx, 'RatingPlanId', v)} fullWidth
                />
                <IdMultiSelect
                  label="Fallback subjects" value={splitIds(act.FallbackSubjects)} options={[]}
                  onChange={v => updateActivation(idx, 'FallbackSubjects', joinIds(v))}
                  helperText="Subjects tried in order when this one has no rate for the destination"
                />
              </Box>
            </Paper>
          ))}
          {source === 'live' && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />}
                label="Overwrite"
              />
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
                {overwrite
                  ? 'Replaces every activation on the profile with the list above.'
                  : 'Appends the activations above to the ones already stored (existing ones are kept, duplicates included).'}
              </Typography>
              <CachingSelect value={caching} onChange={setCaching} />
            </Box>
          )}
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_, v) => v && setSource(v)}>
            <ToggleButton value="live">Live (DataDB)</ToggleButton>
            <ToggleButton value="tp">Tariff plan (StorDB)</ToggleButton>
          </ToggleButtonGroup>
          {source === 'live'
            ? <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
            : <SearchableSelect label="TPID" value={tpid} options={tpids} onChange={setTpid} disableClearable sx={{ minWidth: 200 }} />}
          <TextField size="small" label="Search" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') fetchProfiles(); }} />
          <Button variant="contained" onClick={fetchProfiles} disabled={source === 'tp' && !tpid}>Fetch Profiles</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate} disabled={source === 'tp' && !tpid}>Create New</Button>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow><TableCell>#</TableCell><TableCell>{source === 'live' ? 'Profile ID (category:subject)' : 'Profile ID (loadid:tenant:category:subject)'}</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {profiles.length > 0 ? profiles.map((p, i) => (
                <TableRow key={p} hover sx={{ cursor: 'pointer' }} onClick={() => fetchDetail(p)}>
                  <TableCell>{i + 1}</TableCell><TableCell>{p}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); fetchDetail(p); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); setRemoveCaching(''); setRemoveTarget(p); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} align="center">{listInfo || 'No profiles loaded'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Rating Profile{source === 'tp' ? ` (tariff plan ${tpid})` : ''}</DialogTitle>
        <DialogContent>
          {editing ? renderEditForm() : renderStructuredView()}
        </DialogContent>
        <DialogActions>
          {editing ? <Button variant="contained" onClick={handleSave}>Save</Button> : <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete rating profile</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Delete <b>{removeTarget}</b> from {source === 'live' ? `DataDB (tenant ${tenant})` : `tariff plan ${tpid}`}?
          </Typography>
          {source === 'live' && <CachingSelect value={removeCaching} onChange={setRemoveCaching} />}
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="contained" onClick={handleRemove}>Delete</Button>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
