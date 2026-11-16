import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { HNode } from './HierarchyTree';

const NODE_H = 58;
const GAP_Y = 8;
const PAD = 8;
const MIN_W = 100;
const MAX_W = 220;

interface Placed { node: HNode; depth: number; y: number; }

/** Columns by depth, left to right; each leaf takes a row and a parent sits level with its first child, like a file tree. */
function layout(root: HNode) {
  const placed: Placed[] = [];
  const edges: [string, string][] = [];
  let nextRow = 0;
  let depthMax = 0;
  const visit = (n: HNode, depth: number): number => {
    depthMax = Math.max(depthMax, depth);
    const kids = n.children ?? [];
    let y: number;
    if (kids.length === 0) {
      y = PAD + nextRow++ * (NODE_H + GAP_Y);
    } else {
      const ys = kids.map(k => { edges.push([n.id, k.id]); return visit(k, depth + 1); });
      y = ys[0];
    }
    placed.push({ node: n, depth, y });
    return y;
  };
  visit(root, 0);
  return { placed, edges, columns: depthMax + 1, rows: nextRow };
}

interface HierarchyDiagramProps {
  root: HNode;
  selectedId?: string;
  onSelect: (id: string) => void;
}

/** Card diagram with dashed connectors, read left to right so long child lists grow downwards instead of sideways. */
export default function HierarchyDiagram({ root, selectedId, onSelect }: HierarchyDiagramProps) {
  const { placed, edges, columns, rows } = useMemo(() => layout(root), [root]);
  const byId = useMemo(() => new Map(placed.map(p => [p.node.id, p])), [placed]);
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(900);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gapX = avail < 800 ? 18 : 36;
  const nodeW = Math.max(MIN_W, Math.min(MAX_W, (avail - 2 * PAD - (columns - 1) * gapX) / columns));
  const xOf = (depth: number) => PAD + depth * (nodeW + gapX);
  const width = xOf(columns - 1) + nodeW + PAD;
  const height = PAD * 2 + rows * (NODE_H + GAP_Y);

  return (
    // inline-size containment stops a wide diagram widening the page on narrow screens.
    <Box ref={box} sx={{ overflowX: 'auto', contain: 'inline-size' }}>
      <Box sx={{ position: 'relative', width, height }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {edges.map(([from, to]) => {
            const a = byId.get(from)!;
            const b = byId.get(to)!;
            const x1 = xOf(a.depth) + nodeW, y1 = a.y + NODE_H / 2, x2 = xOf(b.depth), y2 = b.y + NODE_H / 2;
            // Elbow connectors from one trunk per parent keep long child lists tidy.
            const trunk = x1 + (x2 - x1) / 2;
            return <path key={`${from}>${to}`} d={`M ${x1} ${y1} H ${trunk} V ${y2} H ${x2}`}
              fill="none" stroke="#888" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6} />;
          })}
        </svg>
        {placed.map(({ node, depth, y }) => (
          <Paper
            key={node.id}
            variant="outlined"
            onClick={() => onSelect(node.id)}
            sx={{
              position: 'absolute', left: xOf(depth), top: y, width: nodeW, height: NODE_H, px: 1, py: 0.5,
              cursor: 'pointer', borderLeft: `3px solid ${node.color}`, bgcolor: 'background.paper', overflow: 'hidden',
              outline: selectedId === node.id ? `2px solid ${node.color}` : 'none',
              transition: 'box-shadow 0.15s',
              '&:hover': { boxShadow: 3, zIndex: 2 },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', color: node.color, lineHeight: 1.3 }}>
                {node.label}
              </Typography>
              {node.badge && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.3 }}>{node.badge}</Typography>
              )}
            </Box>
            <Typography variant="body2" title={node.value} sx={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.value}
            </Typography>
            {node.subtext && (
              <Typography variant="caption" title={node.subtext} sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.subtext}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
