import { useEffect, useState, type ReactNode } from 'react';
import { Box, Button, DialogActions, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ConfirmDialog from './ConfirmDialog';

/** Dialog footer: the destructive action sits alone on the left, the rest on the right (primary last). */
export function DangerFooter({ removeLabel = 'Remove', onRemove, children }: { removeLabel?: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <DialogActions sx={{ px: 3, pb: 2 }}>
      {onRemove && <Button color="error" variant="outlined" size="small" startIcon={<DeleteOutlineIcon />} onClick={onRemove}>{removeLabel}…</Button>}
      <Box sx={{ flex: 1 }} />
      {children}
    </DialogActions>
  );
}

interface RemoveConfirmProps {
  id: string | null;
  what: string;
  where: string;
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/** Remove confirmation that only enables once the record ID has been typed exactly. */
export default function RemoveConfirm({ id, what, where, busy, children, onConfirm, onClose }: RemoveConfirmProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => { setTyped(''); }, [id]);
  return (
    <ConfirmDialog open={!!id} title={`Remove ${what}`} confirmLabel="Remove" busy={busy}
      confirmDisabled={typed !== id} onConfirm={onConfirm} onClose={onClose}>
      <Typography sx={{ mb: 2 }}>
        Remove {what} <b style={{ wordBreak: 'break-all' }}>{id}</b> from {where}? This cannot be undone.
      </Typography>
      {children}
      <TextField autoFocus fullWidth size="small" label="Type the ID to confirm" value={typed} onChange={e => setTyped(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && typed === id && !busy) onConfirm(); }}
        inputProps={{ spellCheck: false, autoComplete: 'off' }} sx={{ mt: children ? 2 : 0 }} />
    </ConfirmDialog>
  );
}
