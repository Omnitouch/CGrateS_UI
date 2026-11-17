import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonGroup, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { HNode } from './HierarchyTree';

const W = 280;
const H = 84;
const GAP_X = 56;
const GAP_Y = 12;
const PAD = 16;
const LANE_HEAD = 34;
const LANE_GAP = 18;
const SIBLINGS = 25;
const MORE_STEP = 50;

export interface DiagramLane { key: string; label: string; caption?: string; roots: HNode[] }

interface Item { node: HNode; depth: number; y: number; path: HNode[]; more?: { parentId: string; hidden: number } }
interface Sub { items: Item[]; edges: [string, string][]; top: number; bottom: number }

interface Layout { items: Item[]; edges: [string, string][]; lanes: { lane: DiagramLane; top: number; bottom: number }[]; width: number; height: number }

function layout(lanes: DiagramLane[], childrenOf: (n: HNode) => HNode[] | undefined, expanded: Set<string>, pathIds: Set<string>, shown: Record<string, number>): Layout {
  let depthMax = 0;
  const lay = (n: HNode, depth: number, path: HNode[]): Sub => {
    depthMax = Math.max(depthMax, depth);
    const here = [...path, n];
    const self: Item = { node: n, depth, y: 0, path: here };
    const all = expanded.has(n.id) ? childrenOf(n) ?? [] : [];
    if (!all.length) return { items: [self], edges: [], top: -H / 2, bottom: H / 2 };
    const cap = shown[n.id] ?? SIBLINGS;
    let kids = all.slice(0, cap);
    const onPath = all.find(k => pathIds.has(k.id));
    if (onPath && !kids.includes(onPath)) kids = [...kids, onPath];
    const subs = kids.map(k => lay(k, depth + 1, here));
    const hidden = all.length - kids.length;
    if (hidden > 0) {
      const id = `${n.id}/__more`;
      subs.push({ items: [{ node: { id, label: 'More', value: `+${hidden} more`, subtext: `Show ${Math.min(MORE_STEP, hidden)} more`, color: '#757575' }, depth: depth + 1, y: 0, path: here, more: { parentId: n.id, hidden } }], edges: [], top: -H / 2, bottom: H / 2 });
    }
    let cursor = 0;
    const offsets = subs.map(s => { const o = cursor - s.top; cursor = o + s.bottom + GAP_Y; return o; });
    const stackTop = 0;
    const stackBottom = cursor - GAP_Y;
    // The chain stays on one line: the child on the selected path sits level with its parent, siblings fan out around it.
    const anchor = onPath ? kids.indexOf(onPath) : -1;
    const shift = anchor >= 0 ? -offsets[anchor] : -(stackTop + stackBottom) / 2;
    const items: Item[] = [self];
    const edges: [string, string][] = [];
    subs.forEach((s, i) => {
      const dy = offsets[i] + shift;
      s.items.forEach(it => items.push({ ...it, y: it.y + dy }));
      edges.push(...s.edges, [n.id, s.items[0].node.id]);
    });
    return { items, edges, top: Math.min(-H / 2, stackTop + shift), bottom: Math.max(H / 2, stackBottom + shift) };
  };

  const items: Item[] = [];
  const edges: [string, string][] = [];
  const laneBoxes: Layout['lanes'] = [];
  let cursor = PAD;
  for (const lane of lanes) {
    const top = cursor;
    cursor += LANE_HEAD;
    for (const r of lane.roots) {
      const s = lay(r, 0, []);
      const y = cursor - s.top;
      s.items.forEach(it => items.push({ ...it, y: it.y + y }));
      edges.push(...s.edges);
      cursor = y + s.bottom + GAP_Y;
    }
    laneBoxes.push({ lane, top, bottom: cursor });
    cursor += LANE_GAP;
  }
  const width = PAD * 2 + (depthMax + 1) * W + depthMax * GAP_X;
  return { items, edges, lanes: laneBoxes, width, height: cursor + PAD };
}

interface HierarchyDiagramProps {
  lanes: DiagramLane[];
  childrenOf: (n: HNode) => HNode[] | undefined;
  canExpand: (n: HNode) => boolean;
  loading: (id: string) => boolean;
  expanded: Set<string>;
  pathIds: Set<string>;
  selectedId?: string;
  /** Nodes that match the search, outlined wherever they are drawn. */
  highlight: Set<string>;
  onSelect: (path: HNode[]) => void;
  height: number;
}

const xOf = (depth: number) => PAD + depth * (W + GAP_X);

/** Lanes of roots, read left to right; the selected chain is drawn in full and its siblings fan out vertically. Drag to pan, Ctrl+wheel to zoom. */
export default function HierarchyDiagram({ lanes, childrenOf, canExpand, loading, expanded, pathIds, selectedId, highlight, onSelect, height }: HierarchyDiagramProps) {
  const [shown, setShown] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const L = useMemo(() => layout(lanes, childrenOf, expanded, pathIds, shown), [lanes, childrenOf, expanded, pathIds, shown]);
  const byId = useMemo(() => new Map(L.items.map(i => [i.node.id, i])), [L]);

  const zoomTo = useCallback((z: number) => setZoom(Math.min(2, Math.max(0.2, Math.round(z * 100) / 100))), []);
  const fit = () => {
    const el = box.current;
    if (el) zoomTo(Math.min(1, el.clientWidth / L.width, el.clientHeight / L.height));
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => Math.min(2, Math.max(0.2, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const sel = selectedId ? byId.get(selectedId) : undefined;
  useEffect(() => {
    const el = box.current;
    if (!el || !sel) return;
    const x = xOf(sel.depth) * zoom, y = (sel.y - H / 2) * zoom, w = W * zoom, h = H * zoom;
    const left = x < el.scrollLeft || x + w > el.scrollLeft + el.clientWidth ? Math.max(0, x - el.clientWidth / 3) : el.scrollLeft;
    const top = y < el.scrollTop || y + h > el.scrollTop + el.clientHeight ? Math.max(0, y - el.clientHeight / 3) : el.scrollTop;
    el.scrollTo({ left, top, behavior: 'smooth' });
  }, [sel?.node.id, sel?.depth, sel?.y, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-node]') || e.button !== 0) return;
    const el = box.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    box.current!.scrollLeft = d.left - (e.clientX - d.x);
    box.current!.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = () => { drag.current = null; };

  return (
    <Box sx={{ position: 'relative', height }}>
      <ButtonGroup size="small" variant="outlined" sx={{ position: 'absolute', right: 12, top: 8, zIndex: 3, bgcolor: 'background.paper' }}>
        <Tooltip title="Zoom out"><Button onClick={() => zoomTo(zoom / 1.2)}><ZoomOutIcon fontSize="small" /></Button></Tooltip>
        <Tooltip title="Actual size"><Button onClick={() => zoomTo(1)} sx={{ minWidth: 56 }}>{Math.round(zoom * 100)}%</Button></Tooltip>
        <Tooltip title="Zoom in"><Button onClick={() => zoomTo(zoom * 1.2)}><ZoomInIcon fontSize="small" /></Button></Tooltip>
        <Tooltip title="Fit to panel"><Button onClick={fit}><FitScreenIcon fontSize="small" /></Button></Tooltip>
      </ButtonGroup>
      <Box ref={box} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        sx={{ position: 'absolute', inset: 0, overflow: 'auto', cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none' }}>
        <Box sx={{ width: L.width * zoom, height: L.height * zoom, position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: 0, top: 0, width: L.width, height: L.height, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            {L.lanes.map(({ lane, top, bottom }) => (
              <Box key={lane.key} sx={{ position: 'absolute', left: 4, right: 4, top, height: bottom - top, borderRadius: 1, bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}>
                <Typography sx={{ position: 'absolute', left: 12, top: 7, fontSize: 13, fontWeight: 700 }}>
                  {lane.label}
                  {lane.caption && <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>{lane.caption}</Typography>}
                </Typography>
              </Box>
            ))}
            <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {L.edges.map(([from, to]) => {
                const a = byId.get(from), b = byId.get(to);
                if (!a || !b) return null;
                const x1 = xOf(a.depth) + W, x2 = xOf(b.depth), mid = x1 + GAP_X / 2;
                const on = pathIds.has(from) && pathIds.has(to);
                return <path key={`${from}>${to}`} d={`M ${x1} ${a.y} H ${mid} V ${b.y} H ${x2}`} fill="none"
                  stroke={on ? b.node.color : '#888'} strokeWidth={on ? 2.5 : 1.25} strokeDasharray={on ? undefined : '5 3'} opacity={on ? 0.95 : 0.55} />;
              })}
            </svg>
            {L.items.map(it => {
              const n = it.node;
              const isSel = n.id === selectedId;
              const onPath = pathIds.has(n.id);
              const collapsed = !it.more && !expanded.has(n.id) && canExpand(n);
              const kids = childrenOf(n);
              return (
                <Box key={n.id} data-node
                  onClick={() => (it.more ? setShown(s => ({ ...s, [it.more!.parentId]: (s[it.more!.parentId] ?? SIBLINGS) + MORE_STEP })) : onSelect(it.path))}
                  sx={{
                    position: 'absolute', left: xOf(it.depth), top: it.y - H / 2, width: W, height: H, px: 1.25, py: 0.75, boxSizing: 'border-box',
                    cursor: 'pointer', borderRadius: 1, bgcolor: 'background.paper', overflow: 'hidden',
                    border: '1px solid', borderColor: onPath ? n.color : 'divider', borderLeft: `4px solid ${n.color}`,
                    borderStyle: it.more ? 'dashed' : 'solid',
                    boxShadow: isSel ? `0 0 0 2px ${n.color}, 0 4px 12px rgba(0,0,0,0.25)` : highlight.has(n.id) ? '0 0 0 2px #ffb300' : 'none',
                    transition: 'box-shadow 0.15s',
                    '&:hover': { boxShadow: isSel ? undefined : 3 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: n.color, lineHeight: 1.4 }}>
                      {n.status && n.status !== 'default' && <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: `${n.status}.main`, mr: 0.75, verticalAlign: 'middle' }} />}
                      {n.label}
                    </Typography>
                    {n.badge && <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4 }} noWrap>{n.badge}</Typography>}
                  </Box>
                  <Typography title={n.value} sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: collapsed ? 2.5 : 0 }}>
                    {n.value}
                  </Typography>
                  {n.subtext && (
                    <Typography title={n.subtext} sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.subtext}
                    </Typography>
                  )}
                  {loading(n.id) && <CircularProgress size={14} sx={{ position: 'absolute', right: 8, bottom: 8 }} />}
                  {collapsed && !loading(n.id) && (
                    <Tooltip title={kids ? `${kids.length} inside; select to open` : 'Select to open'}>
                      <Box sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                        {kids && <Typography sx={{ fontSize: 11 }}>{kids.length}</Typography>}
                        <ChevronRightIcon fontSize="small" />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
