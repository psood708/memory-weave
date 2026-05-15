'use client';
import { BrandMark } from './Icon';

type Provider = 'ollama' | 'huggingface';

export default function Topbar({
  tab, onTab, provider, onProvider,
}: {
  tab: 'conversation' | 'evals';
  onTab: (t: 'conversation' | 'evals') => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
}) {
  return (
    <div className="topbar">
      <div className="brand">
        <BrandMark />
        <span>MemoryWeave</span>
        <span className="brand-tag">v0.4 · dev</span>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'conversation' ? 'active' : ''}`} onClick={() => onTab('conversation')}>Conversation</button>
        <button className={`tab ${tab === 'evals' ? 'active' : ''}`} onClick={() => onTab('evals')}>Evals</button>
      </div>
      <div className="session">
        <div className="provider-toggle">
          <button
            className={`provider-btn ${provider === 'ollama' ? 'active' : ''}`}
            onClick={() => onProvider('ollama')}
            title="Run locally with Ollama"
          >
            Ollama
          </button>
          <button
            className={`provider-btn ${provider === 'huggingface' ? 'active' : ''}`}
            onClick={() => onProvider('huggingface')}
            title="Use HuggingFace Inference API"
          >
            HF
          </button>
        </div>
        <span className="kv">
          <span className="kv-k">provider</span>
          <span className="kv-v" style={{ color: provider === 'huggingface' ? 'var(--episodic)' : 'var(--working)' }}>
            {provider === 'huggingface' ? 'hf-inference' : 'ollama·local'}
          </span>
        </span>
        <span className="live"><span className="live-dot" /> live</span>
      </div>
    </div>
  );
}
