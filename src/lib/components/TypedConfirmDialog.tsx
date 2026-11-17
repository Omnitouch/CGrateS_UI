import { useEffect, useState, type ReactNode } from 'react';
import { TextField, Typography } from '@mui/material';
import ConfirmDialog from './ConfirmDialog';

interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Text the user must type exactly before the confirm button enables. */
  expected: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function TypedConfirmDialog({ open, title, children, expected, confirmLabel, busy, onConfirm, onClose }: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open, expected]);
  return (
    <ConfirmDialog open={open} title={title} confirmLabel={confirmLabel} busy={busy}
      confirmDisabled={typed !== expected} onConfirm={onConfirm} onClose={onClose}>
      {children}
      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
        Type <strong style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{expected}</strong> to confirm.
      </Typography>
      <TextField size="small" fullWidth autoFocus value={typed} onChange={e => setTyped(e.target.value)}
        inputProps={{ 'aria-label': `Type ${expected} to confirm`, spellCheck: false, autoComplete: 'off' }} />
    </ConfirmDialog>
  );
}
