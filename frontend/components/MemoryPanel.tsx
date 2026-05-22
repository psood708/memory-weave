'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import type { Edge, Entity, Episode, WorkingTurn } from '@/lib/data';

function ForgettingCurve({ importance, hoursAgo }: { importance: number; hoursAgo: number }) {
  const λ = 0.04;
  const duration = Math.max(hoursAgo, 1);
  const I0 = Math.min(importance * Math.exp(λ * duration), 1.0);
  const N = 28;
  const H = 32, padT = 4, padB = 3;
  const innerH = H - padT - padB;

  const points = Array.from({ length: N }, (_, i) => {
    const frac = i / (N - 1);
    const t = frac * duration;
    const val = Math.max(0, I0 * Math.exp(-λ * t));
    return { x: frac * 100, y: padT + (1 - val) * innerH };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];
  const area = `${line} L100,${H - padB} L0,${H - padB} Z`;

  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="forget-curve"
      aria-hidden="true"
    >
      <path d={area} fill="rgba(245,165,36,0.10)" />
      <path d={line} fill="none" stroke="var(--episodic)" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x.toFixed(2)} cy={last.y.toFixed(2)} r="2.5" fill="var(--episodic)" />
    </svg>
  );
}

interface TierHeadProps {
  swatch: 'working' | 'episodic' | 'kg';
  label: string;
  count: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  meta?: { k: string; v: string }[];
}

function TierHead({ swatch, label, count, open, onToggle, meta }: TierHeadProps) {
  return (
    <div>
      <button className="tier-head" onClick={onToggle}>
        <span className={`tier-swatch ${swatch}`} />
        <span className="tier-label">{label}</span>
        <span className="tier-count">{count}</span>
        <span className="tier-chev"><Icon name="chev-down" size={12} /></span>
      </button>
      {meta && (
        <div className="tier-meta">
          {meta.map((m, i) => <span key={i}><b>{m.v}</b> {m.k}</span>)}
        </div>
      )}
    </div>
  );
}

function WorkingTier({ turns, open, onToggle }: { turns: WorkingTurn[]; open: boolean; onToggle: () => void }) {
  return (
    <div className={`tier ${open ? '' : 'collapsed'}`}>
      <TierHead
        swatch="working" label="Working Memory" count={`${turns.length} turns`}
        open={open} onToggle={onToggle}
        meta={turns.length > 0 ? [{ k: 'in buffer', v: String(turns.length) }] : undefined}
      />
      <div className="tier-body">
        {turns.slice(-6).map((t, i) => (
          <div className="turn-row" key={i}>
            <span className={`turn-role ${t.role}`}>{t.role === 'user' ? 'YOU' : 'AGT'}</span>
            <span className="turn-text">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EpisodicTierProps {
  episodes: Episode[];
  open: boolean;
  onToggle: () => void;
  onEpisode: (ep: Episode) => void;
  hoveredEntity: string | null;
  pruning: string | null;
  entering: string | null;
}

function EpisodicTier({ episodes, open, onToggle, onEpisode, hoveredEntity, pruning, entering }: EpisodicTierProps) {
  return (
    <div className={`tier ${open ? '' : 'collapsed'}`}>
      <TierHead
        swatch="episodic" label="Episodic Memory" count={`${episodes.length} stored`}
        open={open} onToggle={onToggle}
        meta={episodes.length > 0 ? [{ k: 'episodes', v: String(episodes.length) }] : undefined}
      />
      <div className="tier-body">
        {episodes.map(ep => {
          const linked = hoveredEntity && ep.entities.some(e => e.toLowerCase() === hoveredEntity.toLowerCase());
          const cls = ['mem-card'];
          if (linked) cls.push('linked');
          if (pruning === ep.id) cls.push('flash-prune');
          if (entering === ep.id) cls.push('entering');
          return (
            <div className={cls.join(' ')} key={ep.id} onClick={() => onEpisode(ep)}>
              <div className="mc-row">
                <span className="mc-turn">t{ep.turn}</span>
                <span style={{ color: 'var(--fg-4)' }}>· {ep.hoursAgo}h ago</span>
                <span className="mc-score">
                  <b>{ep.importance.toFixed(2)}</b>
                  <span style={{ color: 'var(--fg-4)', marginLeft: 4 }}>imp</span>
                </span>
              </div>
              <div className="mc-text">{ep.text}</div>
              <ForgettingCurve importance={ep.importance} hoursAgo={ep.hoursAgo} />
              <div className="mc-row" style={{ marginTop: 1 }}>
                <span style={{ color: 'var(--fg-4)' }}>strength</span>
                <span style={{ color: 'var(--fg-3)' }}>{Math.round(ep.importance * 100)}%</span>
                <span className="mc-score" style={{ color: 'var(--fg-4)' }}>{ep.entities.length} entities</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface KGTierProps {
  entities: Entity[];
  edges: Edge[];
  open: boolean;
  onToggle: () => void;
  onEntity: (en: Entity) => void;
  onEntityHover: (name: string | null) => void;
}

function KGTier({ entities, edges, open, onToggle, onEntity, onEntityHover }: KGTierProps) {
  const avgW = edges.length > 0
    ? (edges.reduce((s, e) => s + e.w, 0) / edges.length).toFixed(2)
    : null;
  return (
    <div className={`tier ${open ? '' : 'collapsed'}`}>
      <TierHead
        swatch="kg" label="Knowledge Graph" count={`${entities.length} nodes`}
        open={open} onToggle={onToggle}
        meta={entities.length > 0
          ? [{ k: 'edges', v: String(edges.length) }, ...(avgW ? [{ k: 'avg w', v: avgW }] : [])]
          : undefined}
      />
      <div className="tier-body">
        {[...entities].sort((a, b) => b.weight - a.weight).map(en => (
          <div
            className="entity-row" key={en.id}
            onClick={() => onEntity(en)}
            onMouseEnter={() => onEntityHover(en.name)}
            onMouseLeave={() => onEntityHover(null)}
          >
            <span className={`entity-dot ${en.type}`} />
            <span className="entity-name">{en.name}<span className="deg">·{en.degree}</span></span>
            <span className="entity-w">{en.weight.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface MemoryPanelProps {
  turns: WorkingTurn[];
  episodes: Episode[];
  entities: Entity[];
  edges: Edge[];
  hoveredEntity: string | null;
  pruning: string | null;
  entering: string | null;
  onEpisode: (ep: Episode) => void;
  onEntity: (en: Entity) => void;
  onEntityHover: (name: string | null) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
  onCollapse?: () => void;
  onReload?: () => void;
}

export default function MemoryPanel(props: MemoryPanelProps) {
  const [open, setOpen] = useState({ working: true, episodic: true, kg: true });
  const toggle = (k: keyof typeof open) => setOpen(o => ({ ...o, [k]: !o[k] }));
  const q = (props.query || '').trim().toLowerCase();
  const filteredEdges = q
    ? props.edges.filter(e => props.entities.find(en => en.id === e.s || en.id === e.t))
    : props.edges;

  const matches = (s: string) => !q || s.toLowerCase().includes(q);
  const filteredEpisodes = q
    ? props.episodes.filter(ep => matches(ep.text) || ep.entities.some(e => matches(e)))
    : props.episodes;
  const filteredEntities = q
    ? props.entities.filter(e => matches(e.name))
    : props.entities;
  const filteredTurns = q
    ? props.turns.filter(t => matches(t.text))
    : props.turns;

  return (
    <div className="panel left">
      <div className="panel-head">
        <span className="panel-title">Memory State</span>
        <div className="panel-actions">
          <button className="icon-btn" title="Reload from disk (pick up demo/CLI changes)" onClick={props.onReload}><Icon name="refresh" size={13} /></button>
          <button className="icon-btn" title="History"><Icon name="history" size={13} /></button>
          {props.onCollapse && (
            <button className="icon-btn" title="Hide panel" onClick={props.onCollapse}>
              <Icon name="panel-left" size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="mem-search">
        <Icon name="search" size={12} className="ic" />
        <input
          value={props.query || ''}
          onChange={(e) => props.onQueryChange?.(e.target.value)}
          placeholder="Search memories, people, decisions…"
        />
        {q && (
          <button className="mem-search-clear" onClick={() => props.onQueryChange?.('')}>
            <Icon name="close" size={11} />
          </button>
        )}
      </div>
      <div className="tiers">
        <WorkingTier turns={filteredTurns} open={open.working} onToggle={() => toggle('working')} />
        <EpisodicTier
          episodes={filteredEpisodes}
          open={open.episodic}
          onToggle={() => toggle('episodic')}
          onEpisode={props.onEpisode}
          hoveredEntity={props.hoveredEntity}
          pruning={props.pruning}
          entering={props.entering}
        />
        <KGTier
          entities={filteredEntities}
          edges={filteredEdges}
          open={open.kg}
          onToggle={() => toggle('kg')}
          onEntity={props.onEntity}
          onEntityHover={props.onEntityHover}
        />
        {q && filteredEpisodes.length === 0 && filteredEntities.length === 0 && filteredTurns.length === 0 && (
          <div className="mem-empty">No matches for "{q}"</div>
        )}
      </div>
    </div>
  );
}
