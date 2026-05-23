'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import { clearMemory, fetchMemoryState } from '@/lib/api';
import type { MemoryState, Provider } from '@/lib/api';

interface ClearRowProps {
  label: string;
  description: string;
  tier: 'working' | 'episodic' | 'kg' | 'all';
  swatch?: 'working' | 'episodic' | 'kg';
  onClear: (target: 'all' | 'episodic' | 'kg' | 'working') => Promise<void>;
  busy: string | null;
}

function ClearRow({ label, description, tier, swatch, onClear, busy }: ClearRowProps) {
  const [confirm, setConfirm] = useState(false);
  const isBusy = busy === tier;

  return (
    <div className="setting-row">
      <div className="setting-info">
        {swatch && <span className={`tier-swatch ${swatch}`} style={{ flexShrink: 0 }} />}
        <div>
          <div className="setting-label">{label}</div>
          <div className="setting-desc">{description}</div>
        </div>
      </div>
      {confirm ? (
        <div className="setting-confirm">
          <span className="setting-confirm-q">Are you sure?</span>
          <button
            className="setting-btn danger"
            disabled={isBusy}
            onClick={async () => {
              await onClear(tier as 'all' | 'episodic' | 'kg' | 'working');
              setConfirm(false);
            }}
          >
            {isBusy ? '…' : 'Delete'}
          </button>
          <button className="setting-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button className="setting-btn danger-outline" onClick={() => setConfirm(true)}>
          Clear
        </button>
      )}
    </div>
  );
}

export interface SettingsProps {
  sessionId: string;
  provider: Provider;
  memoryState: MemoryState | null;
  onMemoryUpdate: (state: MemoryState) => void;
  onConvClear: () => void;
  onClose: () => void;
}

export default function Settings({
  sessionId, provider, memoryState, onMemoryUpdate, onConvClear, onClose,
}: SettingsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);

  const handleClear = async (target: 'all' | 'episodic' | 'kg' | 'working') => {
    setBusy(target);
    try {
      await clearMemory(sessionId, provider, target);
      if (target === 'all' || target === 'working') onConvClear();
      const fresh = await fetchMemoryState(sessionId, provider).catch(() => null);
      if (fresh) onMemoryUpdate(fresh);
      setCleared(target);
      setTimeout(() => setCleared(null), 3000);
    } finally {
      setBusy(null);
    }
  };

  const episodeCount = memoryState?.episodes.length ?? '—';
  const nodeCount = memoryState?.entities.length ?? '—';
  const edgeCount = memoryState?.edges.length ?? '—';
  const turnCount = memoryState?.working_turns.length ?? '—';

  return (
    <div className="settings-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        <div className="settings-head">
          <span className="settings-title">Settings</span>
          <button className="icon-btn" data-tooltip="Close" onClick={onClose}><Icon name="close" size={13} /></button>
        </div>

        <div className="settings-body">

          {/* ── Session info ─────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-label">Session</div>
            <div className="settings-kv-list">
              <div className="settings-kv">
                <span className="sk">ID</span>
                <span className="sv mono">{sessionId.slice(0, 8)}…</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Provider</span>
                <span className="sv" style={{ color: provider === 'huggingface' ? 'var(--episodic)' : 'var(--working)' }}>
                  {provider === 'huggingface' ? 'HuggingFace' : 'Ollama · local'}
                </span>
              </div>
              <div className="settings-kv">
                <span className="sk">Working turns</span>
                <span className="sv mono">{turnCount}</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Stored episodes</span>
                <span className="sv mono">{episodeCount}</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Graph nodes / edges</span>
                <span className="sv mono">{nodeCount} / {edgeCount}</span>
              </div>
            </div>
          </div>

          {/* ── Memory management ────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-label">Memory management</div>

            <ClearRow
              label="Clear working memory"
              description="Removes the in-context conversation buffer. The agent loses recent turn context."
              tier="working"
              swatch="working"
              onClear={handleClear}
              busy={busy}
            />
            <ClearRow
              label="Clear episodic memory"
              description={`Deletes all ${episodeCount} stored episodes from ChromaDB. Long-term recall will be empty.`}
              tier="episodic"
              swatch="episodic"
              onClear={handleClear}
              busy={busy}
            />
            <ClearRow
              label="Clear knowledge graph"
              description={`Wipes all ${nodeCount} nodes and ${edgeCount} edges from the graph and deletes kg_store.json.`}
              tier="kg"
              swatch="kg"
              onClear={handleClear}
              busy={busy}
            />
            <ClearRow
              label="Clear everything"
              description="Resets working memory, all episodes, and the full knowledge graph. Starts fresh."
              tier="all"
              onClear={handleClear}
              busy={busy}
            />

            {cleared && (
              <div className="settings-cleared">
                ✓ {cleared === 'all' ? 'All memory' : cleared.charAt(0).toUpperCase() + cleared.slice(1) + ' memory'} cleared
              </div>
            )}
          </div>

          {/* ── About ────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-label">About</div>
            <div className="settings-kv-list">
              <div className="settings-kv">
                <span className="sk">Version</span>
                <span className="sv mono">v0.4 · dev</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Memory tiers</span>
                <span className="sv">Working · Episodic · KG</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Orchestration</span>
                <span className="sv">LangGraph StateGraph</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Vector store</span>
                <span className="sv">ChromaDB (local)</span>
              </div>
              <div className="settings-kv">
                <span className="sk">Graph store</span>
                <span className="sv">NetworkX · kg_store.json</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
