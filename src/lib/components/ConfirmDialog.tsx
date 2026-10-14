import { useState, type ReactNode } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Second step for calls that change the live system; children should say exactly what will be sent. */
export default function ConfirmDialog({ open, title, children, confirmLabel, busy, danger = true, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? <CircularProgress size={20} /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<unknown>;
}

interface Outcome {
  title: string;
  ok: boolean;
  text: string;
}

/** ask() opens a confirm dialog; on confirm it runs the call and keeps its reply or error as the outcome. */
export function useConfirm() {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await pending.run();
      setOutcome({ title: pending.title, ok: true, text: typeof r === 'string' ? r : JSON.stringify(r, null, 2) });
    } catch (e: unknown) {
      setOutcome({ title: pending.title, ok: false, text: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={!!pending} title={pending?.title || ''} confirmLabel={pending?.confirmLabel || ''}
      danger={pending?.danger ?? true} busy={busy} onConfirm={confirm} onClose={() => setPending(null)}
    >
      {pending?.body}
    </ConfirmDialog>
  );

  const outcomeAlert = outcome && (
    <Alert severity={outcome.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setOutcome(null)}>
      <strong>{outcome.title}:</strong>{' '}
      {outcome.text.includes('\n') ? <pre style={{ margin: 0, fontSize: 12 }}>{outcome.text}</pre> : outcome.text}
    </Alert>
  );

  return { ask: setPending, dialog, outcomeAlert };
}
