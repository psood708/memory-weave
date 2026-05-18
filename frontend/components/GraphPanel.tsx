'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { Edge, Entity } from '@/lib/data';

const NODE_COLORS: Record<Entity['type'], { fill: string; glow: string }> = {
  person:  { fill: '#a78bfa', glow: 'rgba(167, 139, 250, 0.5)' },
  concept: { fill: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.5)' },
  event:   { fill: '#f5a524', glow: 'rgba(245, 165, 36, 0.5)' },
};

const ALL_TYPES: Entity['type'][] = ['person', 'concept', 'event'];

interface SimNode extends Entity {
  x: number; y: number; vx: number; vy: number; radius: number;
}

interface SimLink extends Edge {
  source: SimNode | undefined;
  target: SimNode | undefined;
}

function useForceLayout(nodes: Entity[], edges: Edge[], width: number, height: number) {
  const nodesRef = useRef<SimNode[] | null>(null);
  const linksRef = useRef<SimLink[] | null>(null);
  const prevKeyRef = useRef('');
  const [, tick] = useState(0);

  const nodeKey = nodes.map(n => n.id).sort().join(',');

  if (!nodesRef.current || prevKeyRef.current !== nodeKey) {
    const prevNodes = nodesRef.current;
    prevKeyRef.current = nodeKey;
    nodesRef.current = nodes.map((n, i) => {
      const existing = prevNodes?.find(sn => sn.id === n.id);
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const r = Math.min(90 + nodes.length * 4, 160);
      return {
        ...n,
        x: existing?.x ?? (width / 2 + Math.cos(angle) * r),
        y: existing?.y ?? (height / 2 + Math.sin(angle) * r),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        radius: 10 + n.degree * 1.6,
      };
    });
    linksRef.current = edges.map(e => ({
      ...e,
      source: nodesRef.current!.find(n => n.id === e.s),
      target: nodesRef.current!.find(n => n.id === e.t),
    }));
  }

  useEffect(() => {
    let raf = 0;
    let alpha = 1;
    const repulsion = 1800 + nodes.length * 60;

    const step = () => {
      const ns = nodesRef.current!;
      const ls = linksRef.current!;
      const cx = width / 2, cy = height / 2;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          const k = repulsion / d2;
          dx /= d; dy /= d;
          a.vx += dx * k; a.vy += dy * k;
          b.vx -= dx * k; b.vy -= dy * k;
        }
      }
      for (const l of ls) {
        const a = l.source, b = l.target;
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const ideal = 80 + (1 - l.w) * 50;
        const f = (d - ideal) * 0.03;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      }
      for (const n of ns) {
        n.vx += (cx - n.x) * 0.008;
        n.vy += (cy - n.y) * 0.008;
      }
      const damp = 0.78;
      for (const n of ns) {
        n.vx *= damp; n.vy *= damp;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
        const pad = 36;
        n.x = Math.max(pad, Math.min(width - pad, n.x));
        n.y = Math.max(pad, Math.min(height - pad, n.y));
      }
      alpha *= 0.985;
      tick(t => t + 1);
      if (alpha > 0.02) raf = requestAnimationFrame(step);
      else raf = requestAnimationFrame(breathe);
    };

    const breathe = () => {
      const ns = nodesRef.current!;
      const t = performance.now() * 0.0005;
      for (let i = 0; i < ns.length; i++) {
        ns[i].x += Math.sin(t + i) * 0.05;
        ns[i].y += Math.cos(t * 1.1 + i * 1.7) * 0.05;
      }
      tick(t => t + 1);
      raf = requestAnimationFrame(breathe);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, height, nodeKey]);

  return { nodes: nodesRef.current!, links: linksRef.current! };
}

interface NodeImpactCardProps {
  node: Entity;
  edges: Edge[];
  entities: Entity[];
  onClose: () => void;
}

function NodeImpactCard({ node, edges, entities, onClose }: NodeImpactCardProps) {
  const c = NODE_COLORS[node.type] || NODE_COLORS.concept;
  const connections = edges
    .filter(e => e.s === node.id || e.t === node.id)
    .map(e => {
      const otherId = e.s === node.id ? e.t : e.s;
      const other = entities.find(en => en.id === otherId);
      return { other, rel: e.rel, w: e.w, direction: e.s === node.id ? 'out' : 'in' as 'out' | 'in' };
    })
    .filter(c => c.other)
    .sort((a, b) => b.w - a.w);

  const avgWeight = connections.length
    ? connections.reduce((s, c) => s + c.w, 0) / connections.length
    : 0;

  return (
    <div className="node-card">
      <div className="nc-header">
        <div className="nc-title">
          <span className="nc-dot" style={{ background: c.fill }} />
          <span className="nc-name">{node.name}</span>
          <span className="nc-type">{node.type}</span>
        </div>
        <button className="icon-btn nc-close" onClick={onClose}>
          <Icon name="close" size={11} />
        </button>
      </div>
      {node.description && <div className="nc-desc">{node.description}</div>}
      <div className="nc-stats">
        <div className="nc-stat">
          <span className="nc-stat-v">{node.degree}</span>
          <span className="nc-stat-k">connections</span>
        </div>
        <div className="nc-stat">
          <span className="nc-stat-v">{node.weight.toFixed(2)}</span>
          <span className="nc-stat-k">strength</span>
        </div>
        <div className="nc-stat">
          <span className="nc-stat-v">{avgWeight.toFixed(2)}</span>
          <span className="nc-stat-k">avg edge w</span>
        </div>
      </div>
      {connections.length > 0 && (
        <div className="nc-impact">
          <div className="nc-impact-label">Impact</div>
          <div className="nc-connections">
            {connections.map((conn, i) => (
              <div className="nc-edge" key={i}>
                <span className="nc-edge-dot" style={{ background: NODE_COLORS[conn.other!.type]?.fill || '#888' }} />
                <span className="nc-edge-name">{conn.other!.name}</span>
                <span className="nc-rel">{conn.direction === 'out' ? '→' : '←'} {conn.rel}</span>
                <span className="nc-edge-w">{conn.w.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface GraphPanelProps {
  entities: Entity[];
  edges: Edge[];
  hoveredEntity: string | null;
  onEntity: (en: Entity) => void;
  onEntityHover: (name: string | null) => void;
  focusedNode?: string | null;
  onCollapse?: () => void;
}

export default function GraphPanel({
  entities, edges, hoveredEntity, onEntity, onEntityHover, onCollapse,
}: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 360, h: 380 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<Entity['type']>>(new Set(ALL_TYPES));
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setSize({ w: Math.max(280, r.width), h: Math.max(300, r.height) });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const q = query.trim().toLowerCase();
  const visibleEntities = useMemo(() =>
    entities.filter(e => typeFilter.has(e.type) && (!q || e.name.toLowerCase().includes(q))),
    [entities, typeFilter, q]
  );
  const visibleIds = useMemo(() => new Set(visibleEntities.map(e => e.id)), [visibleEntities]);
  const visibleEdges = useMemo(() =>
    edges.filter(e => visibleIds.has(e.s) && visibleIds.has(e.t)),
    [edges, visibleIds]
  );

  const { nodes, links } = useForceLayout(visibleEntities, visibleEdges, size.w, size.h);

  const transform = `translate(${(size.w / 2) * (1 - zoom) + pan.x}, ${(size.h / 2) * (1 - zoom) + pan.y}) scale(${zoom})`;

  const toggleType = (t: Entity['type']) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  };

  const isLinked = (nodeId: string, pivotName: string | null) => {
    if (!pivotName) return false;
    const pivot = entities.find(e => e.name === pivotName);
    if (!pivot) return false;
    return pivot.id === nodeId || edges.some(e =>
      (e.s === pivot.id && e.t === nodeId) || (e.t === pivot.id && e.s === nodeId)
    );
  };

  const isSelectedLinked = (nodeId: string) => {
    if (!selectedNode) return false;
    return selectedNode.id === nodeId || edges.some(e =>
      (e.s === selectedNode.id && e.t === nodeId) || (e.t === selectedNode.id && e.s === nodeId)
    );
  };

  const handleNodeClick = (n: Entity) => {
    setSelectedNode(prev => prev?.id === n.id ? null : n);
    onEntity(n);
  };

  // Wheel zoom — zoom toward cursor
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    setZoom(z => Math.max(0.3, Math.min(4, z * factor)));
  };

  // Pan — drag on SVG background
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.g-node')) return;
    isPanningRef.current = true;
    panStartRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.style.cursor = 'grabbing';
  };
  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanningRef.current) return;
    setPan({
      x: panStartRef.current.px + (e.clientX - panStartRef.current.mx),
      y: panStartRef.current.py + (e.clientY - panStartRef.current.my),
    });
  };
  const onSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    isPanningRef.current = false;
    e.currentTarget.style.cursor = '';
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className="panel right">
      <div className="panel-head">
        <span className="panel-title">Knowledge Graph</span>
        <div className="panel-actions">
          {onCollapse && (
            <button className="icon-btn" title="Hide panel" onClick={onCollapse}>
              <Icon name="panel-right" size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="graph-toolbar">
        <div className="graph-search">
          <Icon name="search" size={12} className="ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter entities…" />
        </div>
      </div>

      <div className="graph-type-bar">
        {ALL_TYPES.map(t => (
          <button
            key={t}
            className={`type-pill ${typeFilter.has(t) ? 'active' : ''}`}
            style={{ '--pill-color': NODE_COLORS[t].fill } as React.CSSProperties}
            onClick={() => toggleType(t)}
          >
            <span className="tp-dot" />
            {t}
            <span className="tp-count">
              {entities.filter(e => e.type === t).length}
            </span>
          </button>
        ))}
        <span className="graph-node-count">{visibleEntities.length} / {entities.length}</span>
      </div>

      <div className="graph-wrap">
        <div
          className="graph-canvas"
          ref={containerRef}
          onWheel={onWheel}
        >
          <div className="graph-grid" />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: 'grab' }}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={onSvgMouseUp}
          >
            <g transform={transform}>
              {(links || []).map((l, i) => {
                const a = l.source, b = l.target;
                if (!a || !b) return null;
                const dx = b.x - a.x, dy = b.y - a.y;
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const hiHover = !!hoveredEntity && (a.name === hoveredEntity || b.name === hoveredEntity);
                const hiSel = !!selectedNode && (a.id === selectedNode.id || b.id === selectedNode.id);
                const hi = hiHover || hiSel;
                return (
                  <g key={i}>
                    <line
                      className={`g-link ${hi ? 'hl' : ''}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      strokeWidth={0.6 + l.w * 1.4}
                    />
                    {hi && len > 40 && (
                      <text
                        className="g-link-label"
                        x={mx} y={my - 4}
                        transform={`rotate(${Math.abs(angle) > 90 ? angle + 180 : angle}, ${mx}, ${my})`}
                      >
                        {l.rel}
                      </text>
                    )}
                  </g>
                );
              })}
              {(nodes || []).map(n => {
                const c = NODE_COLORS[n.type] || NODE_COLORS.concept;
                const hlHover = (!!hoveredEntity && (n.name === hoveredEntity || isLinked(n.id, hoveredEntity)));
                const hlSel = !!selectedNode && (n.id === selectedNode.id || isSelectedLinked(n.id));
                const hl = hlHover || hlSel;
                const isSel = selectedNode?.id === n.id;
                const r = n.radius;
                return (
                  <g
                    key={n.id}
                    className={`g-node ${hl ? 'hl' : ''} ${isSel ? 'selected' : ''}`}
                    transform={`translate(${n.x}, ${n.y})`}
                    onClick={() => handleNodeClick(n)}
                    onMouseEnter={() => onEntityHover(n.name)}
                    onMouseLeave={() => onEntityHover(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {hl && <circle className="g-node-glow" r={r + 10} fill={c.glow} />}
                    {isSel && (
                      <circle r={r + 5} fill="none" stroke={c.fill} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
                    )}
                    <circle className="g-node-bg" r={r} stroke={hl ? c.fill : undefined} />
                    <circle r={r * 0.35} fill={c.fill} />
                    <text className="g-node-label" y={r + 12}>{n.name}</text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="graph-legend">
            {ALL_TYPES.map(t => (
              <div className="row" key={t} style={{ opacity: typeFilter.has(t) ? 1 : 0.35 }}>
                <span className="sw" style={{ background: NODE_COLORS[t].fill }} />
                {t}
              </div>
            ))}
          </div>

          <div className="graph-controls">
            <button className="gc-btn" onClick={() => setZoom(z => Math.min(4, z * 1.2))} title="Zoom in"><Icon name="plus" size={12} /></button>
            <button className="gc-btn" onClick={() => setZoom(z => Math.max(0.3, z / 1.2))} title="Zoom out"><Icon name="minus" size={12} /></button>
            <div className="sep" />
            <button className="gc-btn" onClick={resetView} title="Reset view"><Icon name="focus" size={12} /></button>
          </div>
        </div>

        {selectedNode ? (
          <NodeImpactCard
            node={selectedNode}
            edges={edges}
            entities={entities}
            onClose={() => setSelectedNode(null)}
          />
        ) : (
          <div className="graph-stats">
            <div className="graph-stat">
              <div className="v">{visibleEntities.length}<span className="u">nodes</span></div>
              <div className="k">visible</div>
            </div>
            <div className="graph-stat">
              <div className="v">{visibleEdges.length}<span className="u">edges</span></div>
              <div className="k">relations</div>
            </div>
            <div className="graph-stat">
              <div className="v">
                {visibleEntities.length > 0
                  ? (visibleEdges.length / visibleEntities.length).toFixed(1)
                  : '—'}
                <span className="u">avg</span>
              </div>
              <div className="k">degree</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
