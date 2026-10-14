import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Checkbox, FormControlLabel, Chip,
  Table, TableBody, TableCell, TableRow,
} from '@mui/material';
import { useOcsBaseUrl, useOcsTenants } from '../OcsContext';
import * as api from '../api';
import SearchableSelect from '../components/SearchableSelect';
import IdMultiSelect from '../components/IdMultiSelect';
import { DurationInput } from '../components/BalanceValue';
import { useConfirm } from '../components/ConfirmDialog';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const { tenants, defaultTenant } = useOcsTenants();
  const [tenant, setTenant] = useState(defaultTenant);
  const { ask, dialog: confirmDialog, outcomeAlert } = useConfirm();

  const [debug, setDebug] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [cpuDir, setCpuDir] = useState('');
  const [memDir, setMemDir] = useState('');
  const [memInterval, setMemInterval] = useState(15e9);
  const [memMaxFiles, setMemMaxFiles] = useState(1);
  const [memTimestamp, setMemTimestamp] = useState(false);
  const [sleepNs, setSleepNs] = useState(1e9);

  const [schedulerStatus, setSchedulerStatus] = useState<string | null>(null);

  const [lockRef, setLockRef] = useState('');
  const [lockIds, setLockIds] = useState<string[]>([]);
  const [lockTimeout, setLockTimeout] = useState(10e9);
  const [unlockRef, setUnlockRef] = useState('');

  const loadStatus = useCallback(async () => {
    if (!baseUrl) return;
    setStatusLoading(true); setStatusError(null);
    try { setStatus(await api.coreStatus(baseUrl, tenant, debug, timezone)); }
    catch (e: unknown) { setStatusError(errText(e)); setStatus(null); }
    finally { setStatusLoading(false); }
  }, [baseUrl, tenant, debug, timezone]);

  const loadScheduler = useCallback(async () => {
    if (!baseUrl) return;
    try { setSchedulerStatus(await api.serviceManager(baseUrl, 'ServiceStatus', tenant, '*scheduler')); }
    catch (e: unknown) { setSchedulerStatus(errText(e)); }
  }, [baseUrl, tenant]);

  useEffect(() => { loadStatus(); loadScheduler(); }, [loadStatus, loadScheduler]);

  const confirm = (title: string, body: string, run: () => Promise<unknown>, danger = true) =>
    ask({ title, confirmLabel: title, danger, body: <Typography variant="body2">{body}</Typography>, run });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Core</Typography>
        <SearchableSelect label="Tenant" value={tenant} options={tenants} onChange={setTenant} disableClearable sx={{ minWidth: 200 }} />
      </Box>
      {outcomeAlert}

      <Section title="Status (CoreSv1.Status)">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
          <FormControlLabel control={<Checkbox checked={debug} onChange={e => setDebug(e.target.checked)} />} label="Debug (raw values)" />
          <TextField size="small" label="Timezone" value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="e.g. UTC, Local, Europe/London" />
          <Button variant="contained" onClick={loadStatus} disabled={statusLoading}>Refresh</Button>
        </Box>
        {statusError && <Alert severity="error">{statusError}</Alert>}
        {statusLoading && !status && <CircularProgress size={24} />}
        {status && (
          <Table size="small">
            <TableBody>
              {Object.entries(status).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600, width: 240 }}>{k}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Scheduler (ServiceManagerV1)">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2">*scheduler:</Typography>
          {schedulerStatus && <Chip size="small" label={schedulerStatus} color={schedulerStatus === 'RUNNING' ? 'success' : 'default'} />}
          <Button onClick={loadScheduler}>Refresh</Button>
          <Button variant="outlined" onClick={() => confirm('Start scheduler',
            'ServiceManagerV1.StartService enables the scheduler and starts running ActionPlans on this node.',
            async () => { const r = await api.serviceManager(baseUrl!, 'StartService', tenant, '*scheduler'); loadScheduler(); return r; }, false)}>Start…</Button>
          <Button variant="outlined" color="error" onClick={() => confirm('Stop scheduler',
            'ServiceManagerV1.StopService stops the scheduler: no ActionPlans (top-ups, renewals) run on this node until it is started again.',
            async () => { const r = await api.serviceManager(baseUrl!, 'StopService', tenant, '*scheduler'); loadScheduler(); return r; })}>Stop…</Button>
        </Box>
      </Section>

      <Section title="CPU profiling">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" label="DirPath" value={cpuDir} onChange={e => setCpuDir(e.target.value)} placeholder="/tmp" helperText="Directory on the CGrateS host; cpu.prof is written there" />
          <Button variant="outlined" disabled={!cpuDir} onClick={() => confirm('Start CPU profiling',
            `CoreSv1.StartCPUProfiling writes a CPU profile to ${cpuDir} on the CGrateS host until stopped. Profiling adds CPU overhead.`,
            () => api.startCPUProfiling(baseUrl!, tenant, cpuDir), false)}>Start…</Button>
          <Button variant="outlined" onClick={() => confirm('Stop CPU profiling', 'CoreSv1.StopCPUProfiling stops and flushes the running CPU profile.',
            () => api.stopCPUProfiling(baseUrl!, tenant), false)}>Stop…</Button>
        </Box>
      </Section>

      <Section title="Memory profiling">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField size="small" label="DirPath" value={memDir} onChange={e => setMemDir(e.target.value)} placeholder="/tmp" helperText="Required" />
          <Box sx={{ width: 240 }}>
            <Typography variant="caption" color="text.secondary">Interval</Typography>
            <DurationInput value={memInterval} onChange={setMemInterval} />
          </Box>
          <TextField size="small" label="MaxFiles" type="number" value={memMaxFiles} onChange={e => setMemMaxFiles(Number(e.target.value))} sx={{ width: 110 }} helperText="0: unlimited" />
          <FormControlLabel control={<Checkbox checked={memTimestamp} onChange={e => setMemTimestamp(e.target.checked)} />} label="UseTimestamp" />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Button variant="outlined" disabled={!memDir} onClick={() => confirm('Start memory profiling',
            `CoreSv1.StartMemoryProfiling writes heap profiles to ${memDir} every ${memInterval / 1e9}s, keeping ${memMaxFiles} file(s).`,
            () => api.startMemoryProfiling(baseUrl!, { Tenant: tenant, DirPath: memDir, Interval: memInterval, MaxFiles: memMaxFiles, UseTimestamp: memTimestamp }), false)}>Start…</Button>
          <Button variant="outlined" onClick={() => confirm('Stop memory profiling', 'CoreSv1.StopMemoryProfiling stops writing heap profiles.',
            () => api.stopMemoryProfiling(baseUrl!, tenant), false)}>Stop…</Button>
        </Box>
      </Section>

      <Section title="Sleep (CoreSv1.Sleep)">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box sx={{ width: 240 }}><DurationInput value={sleepNs} onChange={setSleepNs} /></Box>
          <Button variant="outlined" onClick={() => confirm('Sleep',
            `CoreSv1.Sleep holds this API request for ${sleepNs / 1e9}s before replying (useful to test client timeouts).`,
            () => api.coreSleep(baseUrl!, tenant, sleepNs), false)}>Sleep…</Button>
        </Box>
      </Section>

      <Section title="Guardian locks (GuardianSv1)">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <TextField size="small" label="ReferenceID" value={lockRef} onChange={e => setLockRef(e.target.value)} helperText="Empty: server generates one" />
          <IdMultiSelect label="LockIDs" value={lockIds} options={[]} onChange={setLockIds} fullWidth={false} sx={{ minWidth: 300 }} />
          <Box sx={{ width: 240 }}>
            <Typography variant="caption" color="text.secondary">Timeout (auto-unlock)</Typography>
            <DurationInput value={lockTimeout} onChange={setLockTimeout} />
          </Box>
          <Button variant="outlined" color="error" disabled={!lockIds.length} onClick={() => confirm('Remote lock',
            `GuardianSv1.RemoteLock locks ${lockIds.join(', ')} for up to ${lockTimeout / 1e9}s. Anything in CGrateS waiting on these IDs (e.g. account debits) blocks until unlocked.`,
            () => api.remoteLock(baseUrl!, tenant, lockRef, lockIds, lockTimeout))}>Lock…</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" label="RefID" value={unlockRef} onChange={e => setUnlockRef(e.target.value)} sx={{ minWidth: 300 }} />
          <Button variant="outlined" disabled={!unlockRef} onClick={() => confirm('Remote unlock',
            `GuardianSv1.RemoteUnlock releases the locks held by reference ${unlockRef}.`,
            () => api.remoteUnlock(baseUrl!, tenant, unlockRef), false)}>Unlock…</Button>
        </Box>
      </Section>
      {confirmDialog}
    </Box>
  );
}
