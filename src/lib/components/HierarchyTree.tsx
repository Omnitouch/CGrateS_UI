import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Box, Button, Chip, CircularProgress, Collapse, List, ListItemButton, ListItemIcon, ListItemText, TextField, Tooltip, Typography,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { SvgIconComponent } from '@mui/icons-material';

/** One object in a hierarchy, shared by the tree, the diagram and the detail panel. */
export interface HNode {
  /** Unique within the tree; the same object reached twice gets two ids. */
  id: string;
  /** Object type shown above the value, e.g. "Rating Plan". */
  label: string;
  value: string;
  subtext?: string;
  badge?: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'default';
  icon?: SvgIconComponent;
  color: string;
  /** Rows for the detail panel. */
  details?: [string, ReactNode][];
  raw?: unknown;
  children?: HNode[];
  /** Fetched on first expand or select, so large hierarchies only load what is opened. */
  loadChildren?: () => Promise<HNode[]>;
  /** Extra fields fetched when the node is selected, e.g. a destination's prefixes. */
  loadDetails?: () => Promise<Partial<HNode>>;
  /** Dialog body for changing this object; close(true) reloads its details. */
  editor?: (close: (saved: boolean) => void) => ReactNode;
  editLabel?: string;
}

/** Loaded state shared by the tree, diagram and details. */
export interface LazyTree {
  childrenOf: (n: HNode) => HNode[] | undefined;
  loading: (id: string) => boolean;
  error: (id: string) => string | undefined;
  expand: (n: HNode) => void;
  /** While the quick filter is on: ids to show, and ids opened because something under them matches. */
  match: Set<string> | null;
  forceOpen: Set<string> | null;
}

export const LazyTreeContext = createContext<LazyTree | null>(null);

export function hasChildren(n: HNode, tree: LazyTree) {
  const kids = tree.childrenOf(n);
  return kids ? kids.length > 0 : !!n.loadChildren;
}

const PAGE = 100;
const FILTER_FROM = 30;

function TreeItem({ node, depth, selectedId, onSelect }: { node: HNode; depth: number; selectedId?: string; onSelect: (n: HNode) => void }) {
  const tree = useContext(LazyTreeContext)!;
  const [expanded, setExpanded] = useState(depth < 3);
  const [shown, setShown] = useState(PAGE);
  const [filter, setFilter] = useState('');
  const allKids = tree.childrenOf(node);
  const kids = allKids && tree.match ? allKids.filter(k => tree.match!.has(k.id)) : allKids;
  const open = expanded || !!tree.forceOpen?.has(node.id);
  const expandable = hasChildren(node, tree);
  const Icon = node.icon;

  useEffect(() => { if (open) tree.expand(node); }, [open, node, tree]);

  const f = filter.trim().toLowerCase();
  const visible = kids && f ? kids.filter(k => `${k.value} ${k.subtext ?? ''}`.toLowerCase().includes(f)) : kids;

  return (
    <>
      <Tooltip title={node.label} placement="right" enterDelay={600}>
        <ListItemButton
          selected={selectedId === node.id}
          onClick={() => { if (expandable) setExpanded(e => !e); onSelect(node); }}
          sx={{ pl: 1.5 + depth * 2, py: 0.5, minHeight: 32 }}
        >
          {node.status && (
            <ListItemIcon sx={{ minWidth: 18 }}>
              <FiberManualRecordIcon sx={{ fontSize: 8, color: node.status === 'default' ? 'text.secondary' : `${node.status}.main` }} />
            </ListItemIcon>
          )}
          {Icon && (
            <ListItemIcon sx={{ minWidth: 26 }}>
              <Icon sx={{ fontSize: 16, color: node.color }} />
            </ListItemIcon>
          )}
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontSize: '0.85rem' }}>{node.value}</Typography>
                {node.badge && <Chip label={node.badge} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />}
              </Box>
            }
          />
          {tree.loading(node.id) && <CircularProgress size={12} sx={{ mr: 0.5 }} />}
          {expandable && (open
            ? <ExpandLess sx={{ fontSize: 16, color: 'text.secondary' }} />
            : <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />)}
        </ListItemButton>
      </Tooltip>
      {expandable && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {tree.error(node.id) && (
            <Typography variant="caption" color="error" sx={{ display: 'block', pl: 3.5 + depth * 2 }}>{tree.error(node.id)}</Typography>
          )}
          {kids && kids.length > FILTER_FROM && (
            <Box sx={{ pl: 3.5 + depth * 2, pr: 1, py: 0.5 }}>
              <TextField size="small" fullWidth placeholder={`Filter ${kids.length}…`} value={filter}
                onChange={e => { setFilter(e.target.value); setShown(PAGE); }} />
            </Box>
          )}
          {visible && (
            <List component="div" disablePadding dense>
              {visible.slice(0, shown).map(c => <TreeItem key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}
            </List>
          )}
          {visible && visible.length > shown && (
            <Button size="small" sx={{ ml: 3.5 + depth * 2, textTransform: 'none' }} onClick={() => setShown(s => s + PAGE)}>
              Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
            </Button>
          )}
        </Collapse>
      )}
    </>
  );
}

/** Collapsible tree in the style of OmniWeb's subscriber hierarchy; long child lists are paged and filterable. */
export default function HierarchyTree({ nodes, selectedId, onSelect }: { nodes: HNode[]; selectedId?: string; onSelect: (n: HNode) => void }) {
  return (
    <List component="nav" dense disablePadding>
      {nodes.map(n => <TreeItem key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />)}
    </List>
  );
}
