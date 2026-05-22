'use client';
import Link from 'next/link';
import { BrandMark } from './Icon';
import type { Provider } from '@/lib/api';

const PROVIDER_LABEL: Record<Provider, string> = {
  ollama: 'ollama·local',
  huggingface: 'hf·inference',
  custom: 'custom·key',
};

const PROVIDER_COLOR: Record<Provider, string> = {
  ollama: 'var(--working)',
  huggingface: 'var(--episodic)',
  custom: 'var(--kg)',
};

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
            title="Use HuggingFace Inference API (server key)"
          >
            HF
          </button>
          <button
            className={`provider-btn ${provider === 'custom' ? 'active' : ''}`}
            onClick={() => onProvider('custom')}
            title="Use your own API key (configured in Setup)"
          >
            Custom
          </button>
        </div>
        <span className="kv">
          <span className="kv-k">provider</span>
          <span className="kv-v" style={{ color: PROVIDER_COLOR[provider] }}>
            {PROVIDER_LABEL[provider]}
          </span>
        </span>
        <span className="live"><span className="live-dot" /> live</span>
        <Link href="/setup" className="text-gray-400 hover:text-white transition-colors" title="Model settings">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
