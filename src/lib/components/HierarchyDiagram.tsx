import { useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { HNode } from './HierarchyTree';

const NODE_W = 150;
const NODE_H = 70;
const GAP_X = 10;
const ROW_H = 110;
const PAD = 10;

interface Placed { node: HNode; x: number; y: number; }

/** Rows by depth; each leaf takes a column and a parent sits centred over its children. */
function layout(roots: HNode[], maxDepth: number) {
  const placed: Placed[] = [];
  const edges: [string, string][] = [];
  let nextCol = 0;
  const visit = (n: HNode, depth: number): number => {
    const kids = depth < maxDepth ? n.children ?? [] : [];
    let x: number;
    if (kids.length === 0) {
      x = PAD + nextCol++ * (NODE_W + GAP_X);
    } else {
      const xs = kids.map(k => { edges.push([n.id, k.id]); return visit(k, depth + 1); });
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    placed.push({ node: n, x, y: PAD + depth * ROW_H });
    return x;
  };
  roots.forEach(r => visit(r, 0));
  return { placed, edges };
}

interface HierarchyDiagramProps {
  nodes: HNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Deeper levels are left to the tree so wide hierarchies stay readable. */
  maxDepth?: number;
}

/** Card diagram with dashed connectors, in the style of OmniWeb's subscriber overview. */
export default function HierarchyDiagram({ nodes, selectedId, onSelect, maxDepth = 4 }: HierarchyDiagramProps) {
  const { placed, edges } = useMemo(() => layout(nodes, maxDepth), [nodes, maxDepth]);
  const byId = useMemo(() => new Map(placed.map(p => [p.node.id, p])), [placed]);
  const scroller = useRef<HTMLDivElement>(null);
  const focus = selectedId && byId.has(selectedId) ? selectedId : nodes[0]?.id;

  useEffect(() => {
    const el = scroller.current;
    const p = focus ? byId.get(focus) : undefined;
    if (el && p) el.scrollLeft = p.x + NODE_W / 2 - el.clientWidth / 2;
  }, [focus, byId]);

  if (!placed.length) return null;
  const width = Math.max(...placed.map(p => p.x + NODE_W)) + PAD;
  const height = Math.max(...placed.map(p => p.y + NODE_H)) + PAD;

  return (
    // inline-size containment keeps a wide diagram scrolling inside its panel instead of widening the page.
    <Box ref={scroller} sx={{ overflow: 'auto', contain: 'inline-size' }}>
      <Box sx={{ position: 'relative', width, height }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {edges.map(([from, to]) => {
            const a = byId.get(from)!;
            const b = byId.get(to)!;
            const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
            const mid = (y1 + y2) / 2;
            return <path key={`${from}>${to}`} d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
              fill="none" stroke="#888" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6} />;
          })}
        </svg>
        {placed.map(({ node, x, y }) => (
          <Paper
            key={node.id}
            variant="outlined"
            onClick={() => onSelect(node.id)}
            sx={{
              position: 'absolute', left: x, top: y, width: NODE_W, minHeight: NODE_H, p: 1,
              cursor: 'pointer', borderLeft: `3px solid ${node.color}`, bgcolor: 'background.paper',
              outline: selectedId === node.id ? `2px solid ${node.color}` : 'none',
              transition: 'box-shadow 0.15s, transform 0.15s',
              '&:hover': { boxShadow: 3, transform: 'scale(1.03)', zIndex: 2 },
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', color: node.color, lineHeight: 1.2, display: 'block' }}>
              {node.label}
            </Typography>
            <Typography variant="body2" title={node.value} sx={{ fontSize: '0.7rem', fontWeight: 500, lineHeight: 1.3, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.value}
            </Typography>
            {node.subtext && (
              <Typography variant="caption" title={node.subtext} sx={{ fontSize: '0.55rem', color: 'text.secondary', lineHeight: 1.2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.subtext}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
