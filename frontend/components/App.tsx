'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Topbar from './Topbar';
import MemoryPanel from './MemoryPanel';
import Conversation from './Conversation';
import GraphPanel from './GraphPanel';
import Evals from './Evals';
import Toasts, { type ToastItem } from './Toasts';
import { EpisodeInspector, EntityInspector } from './Inspector';
import { Icon } from './Icon';
import {
  WORKING_TURNS, EPISODES, ENTITIES, EDGES, CONV as INITIAL_CONV, AGENT_STEPS, BUDGET as INITIAL_BUDGET,
  type Episode, type Entity, type ChatMessage, type Budget,
} from '@/lib/data';
import { fetchMemoryState, resetSessions, streamChat } from '@/lib/api';
import type { MemoryState } from '@/lib/api';

type Tab = 'conversation' | 'evals';
type Drawer =
  | { kind: 'episode'; data: Episode }
  | { kind: 'entity';  data: Entity }
  | null;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function Resizer({
  baseW, side, onResize, min = 240, max = 520,
}: {
  baseW: number;
  side: 'left' | 'right';
  onResize: (w: number) => void;
  min?: number;
  max?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = baseW;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const next = side === 'left' ? startW + dx : startW - dx;
      onResize(clamp(next, min, max));
    };
    const up = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div
      className={`resizer ${dragging ? 'dragging' : ''}`}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onResize(side === 'left' ? 296 : 340)}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double‑click to reset"
    >
      <span className="resizer-grip" />
    </div>
  );
}

export default function App(props: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'conversation');
  const [conv, setConv] = useState<ChatMessage[]>([]);
  const [budget, setBudget] = useState<Budget>(INITIAL_BUDGET);
  const [agentActive, setAgentActive] = useState(AGENT_STEPS.length);
  const [streamedChars, setStreamedChars] = useState(0);
  const [expandedCtx, setExpandedCtx] = useState<Record<number, boolean>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [pruning, setPruning] = useState<string | null>(null);
  const [memQuery, setMemQuery] = useState('');
  const [provider, setProvider] = useState<'ollama' | 'huggingface'>('ollama');

  // Session ID — persisted in sessionStorage
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('mw.session');
      if (stored) return stored;
      const id = crypto.randomUUID();
      sessionStorage.setItem('mw.session', id);
      return id;
    }
    return crypto.randomUUID();
  });
  const [memoryState, setMemoryState] = useState<MemoryState | null>(null);

  // Resizable panels
  const [leftW, setLeftW] = useState(296);
  const [rightW, setRightW] = useState(340);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  useEffect(() => {
    const l = parseInt(localStorage.getItem('mw.leftW')  || '296', 10);
    const r = parseInt(localStorage.getItem('mw.rightW') || '340', 10);
    if (!Number.isNaN(l)) setLeftW(l);
    if (!Number.isNaN(r)) setRightW(r);
    setLeftCollapsed(localStorage.getItem('mw.leftCollapsed')  === '1');
    setRightCollapsed(localStorage.getItem('mw.rightCollapsed') === '1');
  }, []);
  useEffect(() => { try { localStorage.setItem('mw.leftW',  String(leftW));  } catch {} }, [leftW]);
  useEffect(() => { try { localStorage.setItem('mw.rightW', String(rightW)); } catch {} }, [rightW]);
  useEffect(() => { try { localStorage.setItem('mw.leftCollapsed',  leftCollapsed  ? '1' : '0'); } catch {} }, [leftCollapsed]);
  useEffect(() => { try { localStorage.setItem('mw.rightCollapsed', rightCollapsed ? '1' : '0'); } catch {} }, [rightCollapsed]);

  const toastIdRef = useRef(0);
  const pushToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++toastIdRef.current;
    setToasts(ts => [...ts, { id, ...t }]);
    setTimeout(() => setToasts(ts => ts.map(x => x.id === id ? { ...x, exit: true } : x)), 3200);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3500);
  }, []);

  // Fetch initial memory state on mount or when provider changes
  useEffect(() => {
    fetchMemoryState(sessionId, provider).then(setMemoryState).catch(() => {});
  }, [sessionId, provider]);

  // Sync budget from memory state
  useEffect(() => {
    if (memoryState?.budget) setBudget(memoryState.budget);
  }, [memoryState]);

  const onToggleCtx = (i: number) => setExpandedCtx(o => ({ ...o, [i]: !o[i] }));

  const onEpisodeClick = (epOrId: Episode | string) => {
    const episodes = memoryState?.episodes ?? EPISODES;
    const full = typeof epOrId === 'string' ? episodes.find(e => e.id === epOrId) : epOrId;
    if (full) setDrawer({ kind: 'episode', data: full as Episode });
  };

  const onEntityClick = (enOrName: Entity | string) => {
    const entities = memoryState?.entities ?? ENTITIES;
    let full: Entity | undefined;
    if (typeof enOrName === 'string') {
      const key = enOrName.split(/[→·(]/)[0].trim().toLowerCase();
      full = entities.find(e => key.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(key)) as Entity | undefined;
    } else {
      full = entities.find(e => e.id === enOrName.id) as Entity | undefined;
    }
    if (full) setDrawer({ kind: 'entity', data: full });
  };

  /* SSE-backed composer — falls back gracefully if backend is down */
  const onSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nextTurn = (conv[conv.length - 1]?.turn || 0) + 1;
    const ts = new Date().toLocaleString('en-US', { weekday: 'short' }) + ' · ' +
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Add user message immediately
    setConv(c => [...c, { role: 'user', turn: nextTurn, text: trimmed, ts }]);

    // Add placeholder bot message in streaming state
    setConv(c => [...c, {
      role: 'bot', turn: nextTurn, ts, streaming: true, text: '',
      meta: { episodes: 0, hops: 0, tokens: 0, latency: 0 },
      context: { episodes: [], nodes: [], merge: 0 },
    }]);

    let accText = '';
    const stepMap: Record<string, number> = { ep: 1, kg: 2, mrg: 3, cnv: 4 };

    setAgentActive(0);
    setStreamedChars(0);

    streamChat(sessionId, trimmed, provider, {
      onAgentStep: (step, status) => {
        if (status === 'active' && stepMap[step] !== undefined) {
          setAgentActive(stepMap[step] - 1);
        }
      },
      onToken: (tokenText) => {
        accText += tokenText;
        const finalText = accText;
        setConv(c => c.map((m, i) => i === c.length - 1 ? { ...m, text: finalText } : m));
        setStreamedChars(finalText.length);
      },
      onDone: (meta, context) => {
        setAgentActive(AGENT_STEPS.length);
        setConv(c => c.map((m, i) => i === c.length - 1 ? { ...m, streaming: false, text: accText, meta, context } : m));
        setBudget(b => ({ ...b, used: meta.tokens }));
      },
      onMemoryUpdated: () => {
        // Fires after write_turn_async completes — memory panels are now current.
        fetchMemoryState(sessionId, provider).then(ms => {
          setMemoryState(ms);
          pushToast({ tier: 'episodic', text: `✦ Episodic memory updated`, score: 0.8 });
          if (ms.entities.length > 0) {
            pushToast({ tier: 'kg', text: `✦ Graph updated · ${ms.entities.length} nodes` });
          }
        }).catch(() => {});
      },
      onError: (err) => {
        setConv(c => c.map((m, i) => i === c.length - 1 ? { ...m, streaming: false, text: `Error: ${err.message}` } : m));
      },
    });
  }, [conv, sessionId, pushToast, provider]);

  return (
    <div className="app" style={{ ['--left-w' as any]: leftW + 'px', ['--right-w' as any]: rightW + 'px' }}>
      <Topbar tab={tab} onTab={setTab} provider={provider} onProvider={setProvider} />
      {tab === 'conversation' ? (
        <div className="main conv-main">
          {leftCollapsed ? (
            <button
              className="collapsed-rail left"
              onClick={() => setLeftCollapsed(false)}
              title="Show memory state"
            >
              <Icon name="panel-right" size={14} />
              <span className="cr-label">Memory State</span>
            </button>
          ) : (
            <>
              <MemoryPanel
                turns={memoryState?.working_turns ?? WORKING_TURNS}
                episodes={memoryState?.episodes ?? EPISODES}
                entities={memoryState?.entities ?? ENTITIES}
                edges={memoryState?.edges ?? EDGES}
                hoveredEntity={hoveredEntity}
                onEpisode={onEpisodeClick}
                onEntity={onEntityClick}
                onEntityHover={setHoveredEntity}
                pruning={pruning}
                entering={null}
                query={memQuery}
                onQueryChange={setMemQuery}
                onCollapse={() => setLeftCollapsed(true)}
                onReload={async () => {
                  await resetSessions();
                  fetchMemoryState(sessionId, provider).then(setMemoryState).catch(() => {});
                }}
              />
              <Resizer baseW={leftW} side="left" onResize={setLeftW} />
            </>
          )}
          <Conversation
            conv={conv}
            agentSteps={AGENT_STEPS}
            agentActive={agentActive}
            streamedChars={streamedChars}
            expandedCtx={expandedCtx}
            onToggleCtx={onToggleCtx}
            onEpisode={onEpisodeClick}
            onEntity={onEntityClick}
            onSend={onSend}
            onConvClear={() => setConv([])}
            budget={budget}
            sessionId={sessionId}
            provider={provider}
            memoryState={memoryState}
            onMemoryUpdate={setMemoryState}
          />
          {rightCollapsed ? (
            <button
              className="collapsed-rail right"
              onClick={() => setRightCollapsed(false)}
              title="Show knowledge graph"
            >
              <Icon name="panel-left" size={14} />
              <span className="cr-label">Knowledge Graph</span>
            </button>
          ) : (
            <>
              <Resizer baseW={rightW} side="right" onResize={setRightW} />
              <GraphPanel
                entities={memoryState?.entities ?? ENTITIES}
                edges={memoryState?.edges ?? EDGES}
                hoveredEntity={hoveredEntity}
                onEntity={onEntityClick}
                onEntityHover={setHoveredEntity}
                onCollapse={() => setRightCollapsed(true)}
              />
            </>
          )}
        </div>
      ) : (
        <div className="evals-main">
          <Evals />
        </div>
      )}

      <Toasts items={toasts} />
      {drawer?.kind === 'episode' && (
        <EpisodeInspector
          episode={drawer.data}
          edges={memoryState?.edges ?? EDGES}
          entities={memoryState?.entities ?? ENTITIES}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer?.kind === 'entity' && (
        <EntityInspector
          entity={drawer.data}
          edges={memoryState?.edges ?? EDGES}
          entities={memoryState?.entities ?? ENTITIES}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
