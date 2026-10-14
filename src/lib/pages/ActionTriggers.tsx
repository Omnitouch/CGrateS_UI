import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';
import type { ActionTriggerEntry } from '../types';
import { CompositeId } from '../components/ParsedId';
import { formatBalanceValue } from '../components/BalanceValue';
import ActionTriggerFormFields, {
  type TriggerForm, emptyTriggerForm, triggerToForm, formToActionTrigger, triggerFormErrors, clearedBalanceFields,
} from '../components/ActionTriggerForm';

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [triggers, setTriggers] = useState<ActionTriggerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActionTriggerEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TriggerForm>(emptyTriggerForm());
  const [saving, setSaving] = useState(false);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [destinationIds, setDestinationIds] = useState<string[]>([]);

  const fetchTriggers = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true); setError(null);
    try { setTriggers(await api.getActionTriggers(baseUrl) || []); }
    catch (e: unknown) {
      if (!api.isNotFound(e)) setError(e instanceof Error ? e.message : 'Failed');
      setTriggers([]);
    }
    finally { setLoading(false); }
  }, [baseUrl]);

  const loadOptions = useCallback(async () => {
    if (!baseUrl) return;
    api.getActions(baseUrl, '').then(r => setActionIds(Object.keys(r || {}).sort())).catch(() => setActionIds([]));
    api.getAllTPDestinationIds(baseUrl).then(setDestinationIds).catch(() => setDestinationIds([]));
  }, [baseUrl]);

  const openDetail = (t: ActionTriggerEntry) => {
    setDetail(t); setForm(triggerToForm(t)); setEditing(false); setDetailOpen(true);
  };

  const openCreate = () => {
    setDetail(null); setForm(emptyTriggerForm()); setEditing(true); setDetailOpen(true); loadOptions();
  };

  const cleared = detail ? clearedBalanceFields(triggerToForm(detail), form) : [];
  const formErrors = triggerFormErrors(form);

  const handleSave = useCallback(async () => {
    if (!baseUrl || formErrors.length) return;
    setSaving(true); setError(null);
    try {
      const groupId = form.GroupID.trim();
      if (detail && cleared.length) await api.removeActionTrigger(baseUrl, detail.ID, detail.UniqueID);
      await api.setActionTrigger(baseUrl, {
        GroupID: groupId,
        UniqueID: form.UniqueID.trim(),
        ActionTrigger: formToActionTrigger(form, false),
      });
      setDetailOpen(false); fetchTriggers();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }, [baseUrl, form, detail, cleared.length, formErrors.length, fetchTriggers]);

  const handleDelete = useCallback(async (wholeGroup: boolean) => {
    if (!baseUrl || !detail) return;
    const what = wholeGroup ? `every trigger in group ${detail.ID}` : `trigger ${detail.UniqueID} of group ${detail.ID}`;
    if (!window.confirm(`Delete ${what}? Accounts keep their own copies.`)) return;
    try {
      await api.removeActionTrigger(baseUrl, detail.ID, wholeGroup ? '' : detail.UniqueID);
      setDetailOpen(false); fetchTriggers();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [baseUrl, detail, fetchTriggers]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Action Triggers</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={fetchTriggers}>Fetch</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate}>Add Trigger</Button>
          <Typography variant="caption" color="text.secondary">
            Action triggers are not tenant-scoped. Accounts get a copy when a group is attached, so edits here apply only to accounts attached afterwards.
          </Typography>
        </Box>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
        <TableContainer component={Paper}><Table size="small"><TableHead><TableRow>
          <TableCell>#</TableCell>
          <TableCell>Group ID</TableCell>
          <TableCell>Unique ID</TableCell>
          <TableCell>Threshold</TableCell>
          <TableCell>Balance Type</TableCell>
          <TableCell>Actions ID</TableCell>
        </TableRow></TableHead><TableBody>
          {triggers.length > 0 ? triggers.map((t, i) => (
            <TableRow key={`${t.ID}/${t.UniqueID}/${i}`} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(t)}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{t.ID}</TableCell>
              <TableCell><Typography variant="caption">{t.UniqueID}</Typography></TableCell>
              <TableCell>
                {t.ThresholdType}
                {t.ThresholdType !== '*balance_expired' && ` ${formatBalanceValue(t.ThresholdValue, t.ThresholdType.includes('event') ? undefined : t.Balance?.Type)}`}
                {t.Recurrent && ' (recurrent)'}
              </TableCell>
              <TableCell>{t.Balance?.Type || ''}</TableCell>
              <TableCell><CompositeId id={t.ActionsID || ''} compact /></TableCell>
            </TableRow>
          )) : <TableRow><TableCell colSpan={6} align="center">No triggers found</TableCell></TableRow>}
        </TableBody></Table></TableContainer>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? (detail ? 'Edit Action Trigger' : 'Create Action Trigger') : 'Action Trigger'}</DialogTitle>
        <DialogContent>
          {editing ? (
            <>
              <ActionTriggerFormFields form={form} onChange={setForm} actionIds={actionIds} destinationIds={destinationIds} locked={!!detail} />
              {cleared.length > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  CGrateS can't unset balance filter fields ({cleared.join(', ')}), so saving removes this trigger and adds it back with the same Unique ID.
                </Alert>
              )}
              {formErrors.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>{formErrors.join('. ')}</Alert>}
            </>
          ) : (
            <Paper sx={{ p: 1, maxHeight: 500, overflow: 'auto', bgcolor: 'action.hover', mt: 1 }}>
              <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(detail, null, 2)}</pre>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {editing
            ? <Button variant="contained" onClick={handleSave} disabled={saving || formErrors.length > 0}>Save</Button>
            : <Button onClick={() => { setEditing(true); loadOptions(); }}>Edit</Button>}
          {detail && !editing && <Button color="error" onClick={() => handleDelete(false)}>Delete Trigger</Button>}
          {detail && !editing && <Button color="error" onClick={() => handleDelete(true)}>Delete Group</Button>}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
