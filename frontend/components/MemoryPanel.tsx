'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import type { Entity, Episode, WorkingTurn } from '@/lib/data';

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
        meta={[{ k: 'tokens', v: '312' }, { k: 'window', v: '8 turns' }]}
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
        swatch="episodic" label="Episodic Memory" count={`top ${episodes.length}`}
        open={open} onToggle={onToggle}
        meta={[{ k: 'retrieved', v: '3' }, { k: 'tokens', v: '416' }, { k: 'in store', v: '8,421' }]}
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
              <div className="mc-decay">
                <div className="mc-decay-bar" style={{ width: `${Math.round(ep.decay * 100)}%` }} />
              </div>
              <div className="mc-row" style={{ marginTop: 1 }}>
                <span style={{ color: 'var(--fg-4)' }}>decay</span>
                <span style={{ color: 'var(--fg-3)' }}>{Math.round(ep.decay * 100)}%</span>
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
  open: boolean;
  onToggle: () => void;
  onEntity: (en: Entity) => void;
  onEntityHover: (name: string | null) => void;
}

function KGTier({ entities, open, onToggle, onEntity, onEntityHover }: KGTierProps) {
  return (
    <div className={`tier ${open ? '' : 'collapsed'}`}>
      <TierHead
        swatch="kg" label="Knowledge Graph" count={`${entities.length} nodes`}
        open={open} onToggle={onToggle}
        meta={[{ k: 'edges', v: '23' }, { k: 'tokens', v: '119' }, { k: 'avg w', v: '0.61' }]}
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
