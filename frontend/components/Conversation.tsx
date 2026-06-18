'use client';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import BotMarkdown from './BotMarkdown';
import { Icon } from './Icon';
import Settings from './Settings';
import type {
  AgentStep, Budget, ChatMessage, ContextSnapshot, MessageMeta, RichSegment,
} from '@/lib/data';
import type { MemoryState, Provider } from '@/lib/api';
import type { ToastItem } from './Toasts';

/* ------------------------------------------------------------------ */
/* Inline thinking trace — replaces the always-visible top stepper.    */
/* Lives inside the bot message while streaming, collapses afterward.  */
/* ------------------------------------------------------------------ */

function InlineTrace({
  steps, activeIdx, done,
}: { steps: AgentStep[]; activeIdx: number; done: boolean }) {
  const [open, setOpen] = useState(true);

  // Auto-collapse once streaming completes; user can re-open with "show steps".
  useEffect(() => {
    if (done) setOpen(false);
  }, [done]);

  if (done && !open) {
    return (
      <button className="trace trace-collapsed" onClick={() => setOpen(true)}>
        <span className="trace-check">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="trace-summary">Drew on 3 memories and 2 graph connections</span>
        <span className="trace-show">show steps</span>
      </button>
    );
  }

  return (
    <div className={`trace trace-open ${done ? 'trace-done' : ''}`}>
      <div className="trace-rail">
        {steps.map((s, i) => {
          const status = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'idle';
          return (
            <div className={`trace-row ${status}`} key={s.id}>
              <span className="trace-dot" />
              <span className="trace-row-label">{s.label}</span>
              <span className="trace-row-sub">{s.sub}</span>
            </div>
          );
        })}
      </div>
      {done && (
        <button className="trace-hide" onClick={() => setOpen(false)}>hide steps</button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* "Why this answer" — replaces the dense metadata strip.              */
/* Plain language by default; full context revealed only on expand.    */
/* ------------------------------------------------------------------ */

function WhyStrip({
  meta, expanded, onToggle,
}: { meta: MessageMeta; expanded: boolean; onToggle: () => void }) {
  return (
    <button className="why-strip" onClick={onToggle} aria-expanded={expanded}>
      <span className="why-dot" />
      <span className="why-label">
        Drew on <b>{meta.episodes}</b> {meta.episodes === 1 ? 'memory' : 'memories'}
        {meta.hops > 0 && <> and <b>{meta.hops}</b> graph {meta.hops === 1 ? 'connection' : 'connections'}</>}
        <span className="why-sep">·</span>
        <span className="why-time">{meta.latency}s</span>
      </span>
      <span className="why-toggle">
        {expanded ? 'Hide' : 'Why?'}
        <Icon name={expanded ? 'chev-down' : 'chev-right'} size={11} />
      </span>
    </button>
  );
}

function ContextDrawer({
  ctx, meta, onEpisode, onEntity,
}: {
  ctx: ContextSnapshot; meta: MessageMeta;
  onEpisode: (id: string) => void; onEntity: (name: string) => void;
}) {
  return (
    <div className="ctx">
      <div className="ctx-col">
        <h4><span className="dot ep" /> Memories used</h4>
        {ctx.episodes.map(e => (
          <div key={e.id} className="ctx-item" onClick={() => onEpisode(e.id)}>
            <span className="sc">{e.score.toFixed(2)}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>
      <div className="ctx-col">
        <h4><span className="dot kg" /> From the graph</h4>
        {ctx.nodes.map((n, i) => (
          <div key={i} className="ctx-item" onClick={() => onEntity(n.name)}>
            <span className="sc kg">{n.score.toFixed(2)}</span>
            <span>{n.name}</span>
          </div>
        ))}
        <div className="ctx-tech">
          <span>merge score <b>{ctx.merge.toFixed(2)}</b></span>
          <span>·</span>
          <span><b>{meta.tokens}</b> tokens</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface MessageProps {
  m: ChatMessage;
  expanded: boolean;
  onToggleCtx: () => void;
  streamedChars: number | null;
  agentSteps: AgentStep[];
  agentActive: number;
  onEpisode: (id: string) => void;
  onEntity: (name: string) => void;
}

function MessageInner({
  m, expanded, onToggleCtx, streamedChars, agentSteps, agentActive, onEpisode, onEntity,
}: MessageProps) {
  if (m.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-meta">
          <span>You</span><span>·</span><span>{m.ts}</span>
        </div>
        <div className="msg-body">{m.text as string}</div>
      </div>
    );
  }

  const isStreaming = !!m.streaming;
  const rawText = typeof m.text === 'string' ? m.text : (m.text as RichSegment[]).map(c => typeof c === 'string' ? c : c.value).join('');
  const body: React.ReactNode = isStreaming
    ? <><BotMarkdown text={rawText} /><span className="cursor" /></>
    : <BotMarkdown text={rawText} />;

  return (
    <div className="msg bot">
      <div className="msg-meta">
        <span style={{ color: 'var(--kg)', fontWeight: 600 }}>MemoryWeave</span>
        <span>·</span><span>{m.ts}</span>
      </div>
      {isStreaming && (
        <InlineTrace steps={agentSteps} activeIdx={agentActive} done={false} />
      )}
      <div className="msg-body">{body}</div>
      {!isStreaming && m.meta && (
        <>
          <WhyStrip meta={m.meta} expanded={expanded} onToggle={onToggleCtx} />
          {expanded && m.context && <ContextDrawer ctx={m.context} meta={m.meta} onEpisode={onEpisode} onEntity={onEntity} />}
        </>
      )}
    </div>
  );
}

// Non-streaming messages don't re-render on every token — only their own props changing triggers a re-render.
const Message = React.memo(MessageInner, (prev, next) => {
  if (prev.m.streaming || next.m.streaming) return false;
  return prev.m === next.m && prev.expanded === next.expanded;
});

/* ------------------------------------------------------------------ */
/* Composer — quiet by default, full token breakdown one click away    */
/* ------------------------------------------------------------------ */

function BudgetDetail({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const seg = (tier: 'working' | 'episodic' | 'kg') => {
    const s = budget.segments.find(x => x.tier === tier);
    return s ? (s.tokens / budget.total) * 100 : 0;
  };
  return (
    <div className="budget-pop">
      <div className="budget-pop-head">
        <span>Context window</span>
        <button className="icon-btn" onClick={onClose}><Icon name="close" size={12} /></button>
      </div>
      <div className="budget-track" style={{ marginTop: 0 }}>
        <div className="budget-seg working"  style={{ width: `${seg('working')}%` }} />
        <div className="budget-seg episodic" style={{ width: `${seg('episodic')}%` }} />
        <div className="budget-seg kg"       style={{ width: `${seg('kg')}%` }} />
      </div>
      <div className="budget-legend">
        {budget.segments.map(s => (
          <div key={s.tier} className="budget-legend-row">
            <span className={`tier-swatch ${s.tier}`} />
            <span className="bl-label">{s.tier === 'kg' ? 'graph' : s.tier} memory</span>
            <span className="bl-val">{s.tokens}</span>
          </div>
        ))}
        <div className="budget-legend-row total">
          <span />
          <span className="bl-label">used / available</span>
          <span className="bl-val"><b>{budget.used}</b> / {budget.total}</span>
        </div>
      </div>
    </div>
  );
}

type ComposerMode = 'memory' | 'question';

const QUESTION_RE = /^(what|who|when|where|why|how|is|are|can|does|do|did|will|would|could|should|has|have|had|which|whose|whom)\b/i;

function isQuestion(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || QUESTION_RE.test(t);
}

function Composer({
  budget, onSend, sessionId, provider, onToast,
}: {
  budget: Budget;
  onSend?: (text: string, mode: ComposerMode) => void;
  sessionId: string;
  provider: Provider;
  onToast?: (t: Omit<ToastItem, 'id'>) => void;
}) {
  const [showBudget, setShowBudget] = useState(false);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ComposerMode>('memory');
  const [modeError, setModeError] = useState('');
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const apiUrl = '/proxy';
      const form = new FormData();
      form.append('file', file);
      form.append('session_id', sessionId);
      form.append('provider', provider);
      const res = await fetch(`${apiUrl}/api/files/upload`, { method: 'POST', credentials: 'include', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        onToast?.({ tier: 'episodic', text: `Upload failed: ${err.detail ?? res.statusText}` });
        return;
      }
      const data = await res.json();
      onToast?.({ tier: 'episodic', text: `✦ ${file.name} indexed · ${data.chunk_count} chunks · ${data.kg_nodes} nodes` });
    } catch {
      onToast?.({ tier: 'episodic', text: 'Upload failed — network error' });
    } finally {
      setUploading(false);
    }
  };
  const pct = Math.round((budget.used / budget.total) * 100);

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(120, el.scrollHeight) + 'px';
  };

  const switchMode = (m: ComposerMode) => {
    setMode(m);
    setModeError('');
  };

  const submit = () => {
    const t = text.trim();
    if (!t || !onSend) return;

    if (mode === 'memory' && isQuestion(t)) {
      setModeError('This looks like a question. Switch to Question mode so it won\'t be saved to memory.');
      return;
    }
    if (mode === 'question' && !isQuestion(t)) {
      setModeError('This looks like a statement. Switch to Memory mode to save it to memory.');
      return;
    }

    setModeError('');
    onSend(t, mode);
    setText('');
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const placeholder = mode === 'memory'
    ? 'Share something to remember — people, decisions, facts…'
    : 'Ask a question — I\'ll answer without saving to memory.';

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        <div className="mode-toggle-row">
          <div className="mode-toggle">
            <button
              className={`mode-btn${mode === 'memory' ? ' mode-btn--active mode-btn--memory' : ''}`}
              onClick={() => switchMode('memory')}
            >
              Memory
            </button>
            <button
              className={`mode-btn${mode === 'question' ? ' mode-btn--active mode-btn--question' : ''}`}
              onClick={() => switchMode('question')}
            >
              Question
            </button>
          </div>
          <span className="mode-desc">
            {mode === 'memory' ? 'Saves to episodic + graph' : 'Retrieves only — no writes'}
          </span>
        </div>
        {modeError && (
          <div className="mode-error">
            {modeError}
            <button
              className="mode-error-switch"
              onClick={() => switchMode(mode === 'memory' ? 'question' : 'memory')}
            >
              Switch to {mode === 'memory' ? 'Question' : 'Memory'}
            </button>
          </div>
        )}
        <div className={`composer composer--${mode}`}>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); autosize(e.target); setModeError(''); }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.py,.js,.ts,.json,.yaml,.yml,.toml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="composer-tools">
            <button
              className={`icon-btn${uploading ? ' icon-btn--loading' : ''}`}
              data-tooltip={uploading ? 'Uploading…' : 'Attach file'}
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="clip" size={14} />
            </button>
            <div className="budget-pill-wrap">
              <button className={`budget-pill ${showBudget ? 'open' : ''}`} onClick={() => setShowBudget(o => !o)} data-tooltip="Context budget">
                <span className="bp-dot" />
                <span>{pct}%</span>
              </button>
              {showBudget && <BudgetDetail budget={budget} onClose={() => setShowBudget(false)} />}
            </div>
          </div>
          <button className="composer-send" onClick={submit} disabled={!text.trim()}>
            Send <span className="kbd">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface ConversationProps {
  conv: ChatMessage[];
  agentSteps: AgentStep[];
  agentActive: number;
  streamedChars: number;
  expandedCtx: Record<number, boolean>;
  onToggleCtx: (i: number) => void;
  onEpisode: (id: string) => void;
  onEntity: (name: string) => void;
  onSend?: (text: string, mode: ComposerMode) => void;
  onConvClear: () => void;
  budget: Budget;
  sessionId: string;
  provider: Provider;
  memoryState: MemoryState | null;
  onMemoryUpdate: (s: MemoryState) => void;
  onToast?: (t: Omit<ToastItem, 'id'>) => void;
}

export default function Conversation({
  conv, agentSteps, agentActive, streamedChars, expandedCtx,
  onToggleCtx, onEpisode, onEntity, onSend, onConvClear, budget,
  sessionId, provider, memoryState, onMemoryUpdate, onToast,
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' });
    }
  }, [streamedChars]);

  return (
    <div className="panel center" style={{ minWidth: 0 }}>
      <div className="conv-head">
        <div className="conv-title">
          <h1>Conversation</h1>
          <span className="meta">session · {conv.length} turns</span>
        </div>
        <div className="conv-actions">
          <button className="icon-btn" data-tooltip="Settings" onClick={() => setShowSettings(true)}>
            <Icon name="cog" size={14} />
          </button>
        </div>
      </div>
      {showSettings && (
        <Settings
          sessionId={sessionId}
          provider={provider}
          memoryState={memoryState}
          onMemoryUpdate={onMemoryUpdate}
          onConvClear={onConvClear}
          onClose={() => setShowSettings(false)}
        />
      )}
      <div className="conv-scroll" ref={scrollRef}>
        <div className="conv">
          {conv.map((m, i) => (
            <Message
              key={i} m={m}
              expanded={!!expandedCtx[i]}
              onToggleCtx={() => onToggleCtx(i)}
              streamedChars={m.streaming ? streamedChars : null}
              agentSteps={agentSteps}
              agentActive={agentActive}
              onEpisode={onEpisode}
              onEntity={onEntity}
            />
          ))}
        </div>
      </div>
      <Composer budget={budget} onSend={onSend} sessionId={sessionId} provider={provider} onToast={onToast} />
    </div>
  );
}
