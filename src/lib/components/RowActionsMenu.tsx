import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

/** Overflow menu for a table row whose click opens the read-only view. */
export default function RowActionsMenu({ id, onEdit, onDelete }: { id: string; onEdit: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (fn: () => void) => { setAnchor(null); fn(); };
  return (
    <>
      <Tooltip title="More actions">
        <IconButton size="small" aria-label={`Actions for ${id}`} aria-haspopup="menu"
          onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={e => e.stopPropagation()}>
        <Tooltip title="Open the edit form" placement="left">
          <MenuItem onClick={() => pick(onEdit)} aria-label={`Edit ${id}`}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Edit</ListItemText>
          </MenuItem>
        </Tooltip>
        <Tooltip title="Delete; asks you to type the ID first" placement="left">
          <MenuItem onClick={() => pick(onDelete)} aria-label={`Delete ${id}`} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete…</ListItemText>
          </MenuItem>
        </Tooltip>
      </Menu>
    </>
  );
}
