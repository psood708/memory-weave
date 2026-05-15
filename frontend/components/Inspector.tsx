'use client';
import { Icon } from './Icon';
import type { Edge, Entity, Episode } from '@/lib/data';

function Sparkline({
  points, color = 'var(--episodic)', height = 48,
}: { points: number[]; color?: string; height?: number }) {
  const w = 320, h = height;
  if (!points.length) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const range = Math.max(max - min, 0.0001);
  const stepX = w / (points.length - 1);
  const px = points.map((v, i) => [i * stepX, h - ((v - min) / range) * (h - 6) - 3] as const);
  const d = px.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id="sp-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sp-g)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" />
      {px.map((p, i) => (
        i === px.length - 1 ? <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} /> : null
      ))}
    </svg>
  );
}

export function EpisodeInspector({
  episode, edges, entities, onClose,
}: {
  episode: Episode; edges: Edge[]; entities: Entity[]; onClose: () => void;
}) {
  const linkedEdges = edges.filter(e => {
    const sN = entities.find(x => x.id === e.s)?.name;
    const tN = entities.find(x => x.id === e.t)?.name;
    return (sN && episode.entities.includes(sN)) || (tN && episode.entities.includes(tN));
  }).slice(0, 6);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="head-l">
            <span className="tag" style={{ color: 'var(--episodic)', borderColor: 'var(--episodic-line)', background: 'var(--episodic-soft)' }}>EPISODE</span>
            <h3>{episode.id}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <h4>Full text</h4>
            <div className="drawer-quote">{episode.text}</div>
          </div>
          <div className="drawer-section">
            <h4>Metadata</h4>
            <div className="drawer-kv">
              <div className="k">turn</div><div className="v">{episode.turn}</div>
              <div className="k">age</div><div className="v">{episode.hoursAgo}h</div>
              <div className="k">importance</div><div className="v amber">{episode.importance.toFixed(3)}</div>
              <div className="k">decay</div><div className="v">{Math.round(episode.decay * 100)}%</div>
              <div className="k">entities</div><div className="v violet">{episode.entities.join(', ')}</div>
              <div className="k">store</div><div className="v" style={{ color: 'var(--fg-2)' }}>chromadb · vec-1536</div>
            </div>
          </div>
          <div className="drawer-section">
            <h4>Importance over turns</h4>
            <div className="spark-card">
              <div className="spark-head">
                <span className="lbl">last {episode.history.length} turns</span>
                <span className="now">{episode.history[episode.history.length - 1].toFixed(2)}</span>
              </div>
              <Sparkline points={episode.history} />
            </div>
          </div>
          <div className="drawer-section">
            <h4>Linked graph edges</h4>
            <div className="linked-edges">
              {linkedEdges.map((e, i) => {
                const sN = entities.find(x => x.id === e.s)?.name;
                const tN = entities.find(x => x.id === e.t)?.name;
                return (
                  <div className="edge-row" key={i}>
                    <span className="from">{sN}</span>
                    <span className="ar"><Icon name="chev-right" size={10} /></span>
                    <span><span className="to">{tN}</span><span className="rel" style={{ display: 'block', marginTop: 2 }}>{e.rel}</span></span>
                    <span className="w">w={e.w.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function EntityInspector({
  entity, edges, entities, onClose,
}: {
  entity: Entity; edges: Edge[]; entities: Entity[]; onClose: () => void;
}) {
  const linked = edges.filter(e => e.s === entity.id || e.t === entity.id);
  const histPoints = [0.32, 0.45, 0.61, 0.72, 0.78, 0.83, 0.88, 0.91, 0.93, entity.weight];
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div className="head-l">
            <span className="tag" style={{ color: 'var(--kg)', borderColor: 'var(--kg-line)', background: 'var(--kg-soft)' }}>ENTITY · {entity.type.toUpperCase()}</span>
            <h3>{entity.name}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <h4>Description</h4>
            <div className="drawer-quote kg">
              A {entity.type} node connected to {entity.degree} neighbors. Weight derived from recency-weighted co-occurrence across episodic memory and explicit graph extractions.
            </div>
          </div>
          <div className="drawer-section">
            <h4>Metadata</h4>
            <div className="drawer-kv">
              <div className="k">type</div><div className="v violet">{entity.type}</div>
              <div className="k">degree</div><div className="v">{entity.degree}</div>
              <div className="k">centrality</div><div className="v">{entity.weight.toFixed(3)}</div>
              <div className="k">last seen</div><div className="v" style={{ color: 'var(--fg-2)' }}>turn 142</div>
              <div className="k">extracted from</div><div className="v" style={{ color: 'var(--fg-2)' }}>3 episodes</div>
            </div>
          </div>
          <div className="drawer-section">
            <h4>Centrality over session</h4>
            <div className="spark-card">
              <div className="spark-head">
                <span className="lbl">last 10 turns</span>
                <span className="now">{entity.weight.toFixed(2)}</span>
              </div>
              <Sparkline points={histPoints} color="var(--kg)" />
            </div>
          </div>
          <div className="drawer-section">
            <h4>Connected edges</h4>
            <div className="linked-edges">
              {linked.map((e, i) => {
                const sN = entities.find(x => x.id === e.s)?.name;
                const tN = entities.find(x => x.id === e.t)?.name;
                return (
                  <div className="edge-row" key={i}>
                    <span className="from">{sN}</span>
                    <span className="ar"><Icon name="chev-right" size={10} /></span>
                    <span><span className="to">{tN}</span><span className="rel" style={{ display: 'block', marginTop: 2 }}>{e.rel}</span></span>
                    <span className="w">w={e.w.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
