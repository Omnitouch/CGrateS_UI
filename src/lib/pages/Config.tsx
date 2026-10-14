import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, Button, TextField, MenuItem, Checkbox, FormControlLabel,
  ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { useConfirm } from '../components/ConfirmDialog';

// config/config_json.go sortedCfgSections
const CONFIG_SECTIONS = [
  'general', 'rpc_conns', 'data_db', 'stor_db', 'listen', 'tls', 'http', 'schedulers', 'caches', 'filters', 'rals', 'cdrs',
  'ers', 'sessions', 'asterisk_agent', 'freeswitch_agent', 'kamailio_agent', 'diameter_agent', 'radius_agent', 'http_agent',
  'dns_agent', 'prometheus_agent', 'attributes', 'chargers', 'resources', 'stats', 'trends', 'rankings', 'thresholds', 'routes',
  'mailer', 'suretax', 'loader', 'migrator', 'dispatchers', 'janus_agent', 'analyzers', 'apiers', 'ees', 'sip_agent',
  'registrarc', 'templates', 'configs', 'apiban', 'sentrypeer', 'cores', 'ips',
];

type EditMode = 'json' | 'map';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const [section, setSection] = useState('*all');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<EditMode>('json');
  const [editText, setEditText] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [reloadPath, setReloadPath] = useState('');
  const [reloadSection, setReloadSection] = useState('');
  const [reloadDryRun, setReloadDryRun] = useState(true);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const fetchConfig = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try { setData(await api.getConfig(baseUrl, tenant, section)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load config'); setData(null); }
    finally { setLoading(false); }
  }, [baseUrl, tenant, section]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  let parseError: string | null = null;
  let parsed: Record<string, unknown> | null = null;
  if (editText.trim()) {
    try {
      const v = JSON.parse(editText);
      if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v;
      else parseError = 'Must be a JSON object of sections, e.g. {"general": {...}}';
    } catch (e: unknown) {
      parseError = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  const apply = () => {
    if (!parsed || !baseUrl) return;
    const method = mode === 'json' ? 'ConfigSv1.SetConfigFromJSON' : 'ConfigSv1.SetConfig';
    ask({
      title: dryRun ? `${method} (dry run)` : method,
      confirmLabel: dryRun ? 'Validate' : 'Apply to running engine',
      danger: !dryRun,
      body: (
        <Typography variant="body2">
          {dryRun
            ? 'The server loads and sanity-checks these sections on a copy of the config; nothing changes.'
            : `Reloads sections ${Object.keys(parsed).join(', ')} on the running engine. Services in those sections restart with the new values.`}
        </Typography>
      ),
      run: async () => {
        const r = mode === 'json'
          ? await api.setConfigFromJSON(baseUrl, tenant, editText, dryRun)
          : await api.setConfig(baseUrl, tenant, parsed!, dryRun);
        if (!dryRun) fetchConfig();
        return r;
      },
    });
  };

  const confirmReload = () => {
    if (!baseUrl) return;
    setReloadOpen(false);
    ask({
      title: reloadDryRun ? 'ReloadConfig (dry run)' : 'ReloadConfig',
      confirmLabel: reloadDryRun ? 'Validate' : 'Reload',
      danger: !reloadDryRun,
      body: (
        <Typography variant="body2">
          Reads the config from <code>{reloadPath}</code> on the CGrateS host and
          {reloadDryRun ? ' checks it without applying.' : ` reloads ${reloadSection || 'every section'} on the running engine.`}
        </Typography>
      ),
      run: async () => {
        const r = await api.reloadConfig(baseUrl, tenant, reloadPath, reloadSection, reloadDryRun);
        if (!reloadDryRun) fetchConfig();
        return r;
      },
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>CGrateS Configuration</Typography>
        <Button variant="outlined" onClick={() => setReloadOpen(true)}>Reload from disk…</Button>
      </Box>
      {outcomeAlert}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
          <SearchableSelect label="Section" value={section} options={['*all', ...CONFIG_SECTIONS]} onChange={setSection} disableClearable sx={{ minWidth: 220 }} />
          <Button variant="contained" onClick={fetchConfig}>Get Config</Button>
          <Button disabled={!data} onClick={() => {
            const sectionData = section === '*all' ? data : { [section]: (data as Record<string, unknown>)[section] };
            setEditText(JSON.stringify(sectionData, null, 2));
          }}>Copy to editor</Button>
        </Box>
      </Paper>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && !loading && (
        <Paper variant="outlined" sx={{ p: 2, maxHeight: '60vh', overflow: 'auto', mb: 2 }}>
          <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(data, null, 2)}</pre>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Change running config</Typography>
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_e, v) => v && setMode(v)}>
            <ToggleButton value="json">SetConfigFromJSON</ToggleButton>
            <ToggleButton value="map">SetConfig</ToggleButton>
          </ToggleButtonGroup>
          <FormControlLabel control={<Checkbox checked={dryRun} onChange={e => setDryRun(e.target.checked)} />} label="DryRun" />
        </Box>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
          Only the sections and fields you include are changed. SetConfigFromJSON sends the text as-is (CGrateS JSON, comments allowed);
          SetConfig sends it as an object.
        </Typography>
        <TextField
          multiline fullWidth minRows={8} value={editText} onChange={e => setEditText(e.target.value)}
          placeholder={'{\n  "sessions": {\n    "debit_interval": "10s"\n  }\n}'}
          error={!!parseError && mode === 'map'}
          helperText={mode === 'map' ? parseError : undefined}
          sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
        />
        <Button variant="contained" color={dryRun ? 'primary' : 'error'} sx={{ mt: 1 }}
          disabled={!editText.trim() || (mode === 'map' && !parsed)} onClick={apply}>
          {dryRun ? 'Validate…' : 'Apply…'}
        </Button>
      </Paper>

      <Dialog open={reloadOpen} onClose={() => setReloadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reload config from disk</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField size="small" label="Path" value={reloadPath} onChange={e => setReloadPath(e.target.value)}
              placeholder="/etc/cgrates" helperText="File or directory on the CGrateS host (required)" />
            <TextField select size="small" label="Section" value={reloadSection} onChange={e => setReloadSection(e.target.value)}>
              <MenuItem value=""><em>All sections</em></MenuItem>
              {CONFIG_SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Checkbox checked={reloadDryRun} onChange={e => setReloadDryRun(e.target.checked)} />} label="DryRun" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReloadOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!reloadPath.trim()} onClick={confirmReload}>Reload…</Button>
        </DialogActions>
      </Dialog>
      {confirmDialog}
    </Box>
  );
}
