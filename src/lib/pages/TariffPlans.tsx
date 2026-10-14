import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Checkbox, MenuItem,
} from '@mui/material';
import { useOcsBaseUrl } from '../OcsContext';
import { useTPIds, useRemoveTP } from '../hooks';
import * as api from '../api';
import CachingSelect from '../components/CachingSelect';

type DialogKind = 'loadStorDb' | 'loadFolder' | 'import' | 'export' | null;

// engine/tpexporter.go only knows "csv".
const FILE_FORMATS = ['csv'];

function downloadBase64(b64: string, filename: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { data: tpids, isLoading, error: fetchError, refetch } = useTPIds();
  const removeTP = useRemoveTP();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [tpid, setTpid] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [validate, setValidate] = useState(false);
  const [caching, setCaching] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [runId, setRunId] = useState('');
  const [csvSeparator, setCsvSeparator] = useState(',');
  const [exportPath, setExportPath] = useState('');
  const [fileFormat, setFileFormat] = useState('csv');
  const [fieldSeparator, setFieldSeparator] = useState(',');
  const [compress, setCompress] = useState(false);

  const open = (kind: DialogKind, forTpid = '') => {
    setTpid(forTpid);
    setDryRun(true);
    setValidate(false);
    setCaching('');
    setError(null);
    setDialog(kind);
  };

  const run = useCallback(async (fn: () => Promise<string>) => {
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      setDialog(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    if (!window.confirm(`Remove tariff plan ${id} from StorDB? Data already loaded into DataDB is not affected.`)) return;
    try { await removeTP.mutateAsync(id); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [removeTP]);

  const loadOpts = () => ({
    DryRun: dryRun,
    Validate: validate,
    ...(caching ? { Caching: caching } : {}),
  });

  const submit = () => {
    if (!baseUrl) return;
    switch (dialog) {
      case 'loadStorDb':
        return run(async () => {
          await api.loadTariffPlanFromStorDb(baseUrl, { TPid: tpid, ...loadOpts() });
          return dryRun ? `Dry run of ${tpid} passed; nothing was written` : `Loaded ${tpid} into DataDB`;
        });
      case 'loadFolder':
        if (!folderPath) { setError('FolderPath is required'); return; }
        return run(async () => {
          await api.loadTariffPlanFromFolder(baseUrl, { FolderPath: folderPath, ...loadOpts() });
          return dryRun ? `Dry run of ${folderPath} passed; nothing was written` : `Loaded ${folderPath} into DataDB`;
        });
      case 'import':
        if (!tpid || !folderPath) { setError('TPid and FolderPath are required'); return; }
        return run(async () => {
          await api.importTariffPlanFromFolder(baseUrl, {
            TPid: tpid, FolderPath: folderPath, CsvSeparator: csvSeparator, ...(runId ? { RunId: runId } : {}),
          });
          refetch();
          return `Imported ${folderPath} into StorDB as ${tpid}`;
        });
      case 'export':
        return run(async () => {
          const r = await api.exportTPToFolder(baseUrl, {
            TPid: tpid, FileFormat: fileFormat, FieldSeparator: fieldSeparator, Compress: compress,
            ...(exportPath ? { ExportPath: exportPath } : {}),
          });
          return `Exported ${tpid} to ${r.ExportPath}${r.Compressed ? ' (compressed)' : ''}: ${(r.ExportedFiles || []).join(', ')}`;
        });
    }
  };

  const handleDownload = useCallback((id: string) => {
    if (!baseUrl) return;
    run(async () => {
      const b64 = await api.exportTPToZipString(baseUrl, { TPid: id });
      downloadBase64(b64, `${id}.zip`);
      return `Downloaded ${id}.zip`;
    });
  }, [baseUrl, run]);

  const loadFields = (
    <>
      <FormControlLabel control={<Checkbox checked={dryRun} onChange={e => setDryRun(e.target.checked)} />}
        label="Dry run (parse only, write nothing)" />
      <FormControlLabel control={<Checkbox checked={validate} onChange={e => setValidate(e.target.checked)} />}
        label="Validate (structural checks)" />
      {dialog === 'loadFolder' && dryRun && validate && (
        <Alert severity="info">For folder loads the server returns after a dry run before validating.</Alert>
      )}
      <CachingSelect value={caching} onChange={setCaching} />
      {!dryRun && <Alert severity="warning">This writes the tariff plan into the live DataDB and reloads caches.</Alert>}
    </>
  );

  const titles: Record<Exclude<DialogKind, null>, string> = {
    loadStorDb: `Load ${tpid} from StorDB into DataDB`,
    loadFolder: 'Load tariff plan from folder into DataDB',
    import: 'Import CSV folder into StorDB',
    export: `Export ${tpid} to folder`,
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Tariff Plans</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => open('loadFolder')}>Load from folder…</Button>
          <Button variant="outlined" onClick={() => open('import')}>Import folder to StorDB…</Button>
        </Box>
      </Paper>
      {error && !dialog && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError instanceof Error ? fetchError.message : 'Failed to load'}</Alert>}
      {(isLoading || (actionLoading && !dialog)) && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {tpids && tpids.length > 0 && (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>TPID</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
          {tpids.map((id, i) => (<TableRow key={id}><TableCell>{i + 1}</TableCell><TableCell>{id}</TableCell><TableCell>
            <Button size="small" color="error" onClick={() => handleRemove(id)} sx={{ mr: 1 }}>Remove</Button>
            <Button size="small" onClick={() => open('loadStorDb', id)} sx={{ mr: 1 }}>Load to DataDB…</Button>
            <Button size="small" onClick={() => open('export', id)} sx={{ mr: 1 }}>Export to Folder…</Button>
            <Button size="small" onClick={() => handleDownload(id)}>Download zip</Button>
          </TableCell></TableRow>))}
        </TableBody></Table></TableContainer>
      )}
      {tpids && tpids.length === 0 && <Typography color="text.secondary">No tariff plans found</Typography>}

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog ? titles[dialog] : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {dialog === 'loadStorDb' && loadFields}
            {dialog === 'loadFolder' && (
              <>
                <TextField size="small" label="FolderPath" value={folderPath} onChange={e => setFolderPath(e.target.value)} helperText="Directory on the CGrateS host" />
                {loadFields}
              </>
            )}
            {dialog === 'import' && (
              <>
                <TextField size="small" label="TPid" value={tpid} onChange={e => setTpid(e.target.value)} />
                <TextField size="small" label="FolderPath" value={folderPath} onChange={e => setFolderPath(e.target.value)} helperText="Directory on the CGrateS host" />
                <TextField size="small" label="CsvSeparator" value={csvSeparator} onChange={e => setCsvSeparator(e.target.value)} />
                <TextField size="small" label="RunId" value={runId} onChange={e => setRunId(e.target.value)} helperText="Optional import id" />
              </>
            )}
            {dialog === 'export' && (
              <>
                <TextField size="small" label="ExportPath" value={exportPath} onChange={e => setExportPath(e.target.value)}
                  helperText="Existing directory on the CGrateS host; empty uses general.tpexport_dir" />
                <TextField select size="small" label="FileFormat" value={fileFormat} onChange={e => setFileFormat(e.target.value)}>
                  {FILE_FORMATS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </TextField>
                <TextField size="small" label="FieldSeparator" value={fieldSeparator} onChange={e => setFieldSeparator(e.target.value)} />
                <FormControlLabel control={<Checkbox checked={compress} onChange={e => setCompress(e.target.checked)} />} label="Compress into a zip" />
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={submit} disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} /> : dialog === 'export' ? 'Export' : dialog === 'import' ? 'Import' : dryRun ? 'Dry run' : 'Load'}
          </Button>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
