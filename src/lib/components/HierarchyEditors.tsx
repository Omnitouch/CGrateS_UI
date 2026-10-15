import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, DialogActions, DialogContent, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import IdMultiSelect from './IdMultiSelect';
import { parseGoDuration } from '../expiryTime';

interface EditorProps<T> {
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
  /** Shown above the form, e.g. where the change lands and what applies it. */
  note: string;
  noteSeverity?: 'info' | 'warning';
  onClose: (saved: boolean) => void;
}

function useLoaded<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    load().then(setValue).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { value, setValue, error, setError };
}

function Frame({ note, noteSeverity = 'info', error, saving, canSave, onSave, onClose, children }: {
  note: string; noteSeverity?: 'info' | 'warning'; error: string | null; saving: boolean; canSave: boolean;
  onSave: () => void; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <DialogContent>
        <Alert severity={noteSeverity} sx={{ mb: 2 }}>{note}</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </>
  );
}

export function PrefixEditor({ load, save, note, noteSeverity, onClose }: EditorProps<string[]>) {
  const { value, setValue, error, setError } = useLoaded(load);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await save(value!); onClose(true); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setSaving(false); }
  };
  return (
    <Frame note={note} noteSeverity={noteSeverity} error={error} saving={saving} canSave={!!value?.length} onSave={submit} onClose={() => onClose(false)}>
      {value === null ? <CircularProgress size={24} /> : (
        <IdMultiSelect label="Prefixes" value={value} options={[]} onChange={setValue} placeholder="Type a prefix and press Enter"
          helperText={`${value.length} prefix${value.length === 1 ? '' : 'es'}`} />
      )}
    </Frame>
  );
}

export interface RateSlot { ConnectFee: number; Rate: number; RateUnit: string; RateIncrement: string; GroupIntervalStart: string }

const validDuration = (s: string) => parseGoDuration(s) !== null;

export function RateSlotsEditor({ load, save, note, noteSeverity, onClose }: EditorProps<RateSlot[]>) {
  const { value, setValue, error, setError } = useLoaded(load);
  const [saving, setSaving] = useState(false);
  const set = (i: number, k: keyof RateSlot, v: string) =>
    setValue(slots => slots!.map((s, j) => (j === i ? { ...s, [k]: k === 'ConnectFee' || k === 'Rate' ? Number(v) : v } : s)));
  const valid = !!value?.length && value.every(s => validDuration(s.RateUnit) && validDuration(s.RateIncrement) && validDuration(s.GroupIntervalStart));
  const submit = async () => {
    setSaving(true);
    try { await save(value!); onClose(true); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setSaving(false); }
  };
  return (
    <Frame note={note} noteSeverity={noteSeverity} error={error} saving={saving} canSave={valid} onSave={submit} onClose={() => onClose(false)}>
      {value === null ? <CircularProgress size={24} /> : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell><TableCell>Connect fee</TableCell><TableCell>Rate</TableCell>
                <TableCell>per (unit)</TableCell><TableCell>in steps of</TableCell><TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {value.map((s, i) => (
                <TableRow key={i}>
                  {(['GroupIntervalStart', 'ConnectFee', 'Rate', 'RateUnit', 'RateIncrement'] as (keyof RateSlot)[]).map(k => {
                    const numeric = k === 'ConnectFee' || k === 'Rate';
                    return (
                      <TableCell key={k} sx={{ minWidth: 100 }}>
                        <TextField size="small" type={numeric ? 'number' : 'text'} value={s[k]} onChange={e => set(i, k, e.target.value)}
                          error={!numeric && !validDuration(String(s[k]))} slotProps={{ htmlInput: numeric ? { step: 'any' } : undefined }} />
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <IconButton size="small" disabled={value.length === 1} onClick={() => setValue(v => v!.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }}
            onClick={() => setValue(v => [...v!, { ...v![v!.length - 1], GroupIntervalStart: v![v!.length - 1].RateUnit }])}>
            Add slot
          </Button>
        </Box>
      )}
    </Frame>
  );
}
