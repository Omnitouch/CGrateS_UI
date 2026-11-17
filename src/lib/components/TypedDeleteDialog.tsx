import { useEffect, useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import ConfirmDialog from './ConfirmDialog';
import { CachingAdvanced } from './CachingSelect';

interface TypedDeleteDialogProps {
  /** ID to delete; null closes the dialog. */
  id: string | null;
  kind: string;
  busy?: boolean;
  caching?: string;
  onCaching?: (v: string) => void;
  onConfirm: (id: string) => void;
  onClose: () => void;
}

/** Delete confirmation that only enables once the exact ID is typed. */
export default function TypedDeleteDialog({ id, kind, busy, caching, onCaching, onConfirm, onClose }: TypedDeleteDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => { setTyped(''); }, [id]);
  return (
    <ConfirmDialog open={id !== null} title={`Delete ${kind}?`} confirmLabel="Delete" busy={busy}
      confirmDisabled={typed !== id} onConfirm={() => id && onConfirm(id)} onClose={onClose}>
      <Typography variant="body2" sx={{ mb: 2 }}>
        This removes <strong style={{ wordBreak: 'break-all' }}>{id}</strong> from the live data and cannot be undone.
        Type the ID to confirm.
      </Typography>
      <TextField autoFocus fullWidth size="small" label="ID" value={typed} onChange={e => setTyped(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && id && typed === id) onConfirm(id); }} />
      {onCaching && <Box sx={{ mt: 1 }}><CachingAdvanced value={caching || ''} onChange={onCaching} action="deleting" /></Box>}
    </ConfirmDialog>
  );
}
