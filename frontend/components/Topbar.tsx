'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { BrandMark } from './Icon';
import type { Provider } from '@/lib/api';

interface UserInfo {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  ollama: 'ollama·local',
  groq: 'groq·cloud',
  custom: 'hf·key',
};

const PROVIDER_COLOR: Record<Provider, string> = {
  ollama: 'var(--working)',
  groq: 'var(--episodic)',
  custom: 'var(--kg)',
};

const PROVIDER_WARNING: Partial<Record<Provider, { title: string; detail: string }>> = {
  ollama: {
    title: 'Ollama not configured',
    detail: 'Ollama requires a local server running at localhost:11434. Run ollama serve and pull a model first.',
  },
  groq: {
    title: 'Groq API key not set',
    detail: 'Groq requires an API key from console.groq.com/keys. Add it in Setup to use Groq.',
  },
  custom: {
    title: 'HuggingFace key not configured',
    detail: 'A HuggingFace API key is required. Configure it in Setup to continue.',
  },
};

type OllamaStatus = 'checking' | 'ok' | 'unreachable';
type LiveStatus = 'live' | 'checking' | 'offline' | 'no-key';

const LIVE_CONFIG: Record<LiveStatus, { color: string; label: string; pulse: boolean }> = {
  live:     { color: 'var(--ok)',  label: 'live',     pulse: true  },
  checking: { color: 'rgba(255,255,255,0.2)', label: 'checking', pulse: false },
  offline:  { color: '#f87171',   label: 'offline',  pulse: false },
  'no-key': { color: '#fbbf24',   label: 'no key',   pulse: false },
};

const OLLAMA_STATUS_COLOR: Record<OllamaStatus, string> = {
  checking: 'rgba(255,255,255,0.2)',
  ok: 'var(--ok)',
  unreachable: '#f87171',
};

const OLLAMA_STATUS_LABEL: Record<OllamaStatus, string> = {
  checking: 'Checking Ollama…',
  ok: 'Ollama reachable',
  unreachable: 'Ollama unreachable — run: ollama serve',
};

async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function Topbar({
  tab, onTab, provider, onProvider, chatModel, configuredProvider, user,
}: {
  tab: 'conversation' | 'evals' | 'docs' | 'files';
  onTab: (t: 'conversation' | 'evals' | 'docs' | 'files') => void;
  provider: Provider;
  onProvider: (p: Provider) => void;
  chatModel?: string;
  configuredProvider?: Provider | null;
  user?: UserInfo | null;
}) {
  const [warning, setWarning] = useState<Provider | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('checking');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileRect, setProfileRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLButtonElement | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);

  // Needed to safely use createPortal (avoid SSR mismatch)
  useEffect(() => { setMounted(true); }, []);

  // Dismiss warning whenever the active tab changes
  useEffect(() => { setWarning(null); }, [tab]);

  const handleProviderClick = (p: Provider) => {
    onProvider(p);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (configuredProvider && p !== configuredProvider) {
      if (anchorRef.current) {
        setAnchorRect(anchorRef.current.getBoundingClientRect());
      }
      setWarning(p);
      timerRef.current = setTimeout(() => setWarning(null), 7000);
    } else {
      setWarning(null);
    }
  };

  // Poll Ollama health every 30s
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await pingOllama();
      if (!cancelled) setOllamaStatus(ok ? 'ok' : 'unreachable');
    };
    check();
    pollRef.current = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideButton = profileRef.current?.contains(t) ?? false;
      const insideDropdown = profileDropdownRef.current?.contains(t) ?? false;
      if (!insideButton && !insideDropdown) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileOpen]);

  const handleProfileClick = () => {
    if (profileRef.current) setProfileRect(profileRef.current.getBoundingClientRect());
    setProfileOpen(o => !o);
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const warn = warning ? PROVIDER_WARNING[warning] : null;

  const liveStatus: LiveStatus = (() => {
    if (provider === 'ollama') {
      if (ollamaStatus === 'ok') return 'live';
      if (ollamaStatus === 'checking') return 'checking';
      return 'offline';
    }
    // API-key providers — live only if this provider was saved with a key
    if (configuredProvider === provider) return 'live';
    return 'no-key';
  })();
  const live = LIVE_CONFIG[liveStatus];

  const profilePortal = mounted && profileOpen && profileRect ? createPortal(
    <div
      ref={profileDropdownRef}
      style={{
        position: 'fixed',
        top: profileRect.bottom + 8,
        right: window.innerWidth - profileRect.right,
        background: 'rgba(13,17,23,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '4px',
        width: 220,
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.image ? (
            <img src={user.image} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--episodic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'User'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? ''}
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '4px' }}>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          style={{
            width: '100%', textAlign: 'left', background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.55)', fontSize: 13, cursor: 'pointer',
            padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)', e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none', e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  // Portal — renders outside topbar's stacking context so it truly floats above everything
  const warningPortal = mounted && warn && anchorRect ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 8,
        right: window.innerWidth - anchorRect.right,
        background: 'rgba(13,17,23,0.97)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 10,
        padding: '12px 14px',
        width: 264,
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
          ⚠ {warn.title}
        </span>
        <button
          onClick={() => setWarning(null)}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
            padding: 0, fontSize: 16, lineHeight: 1, flexShrink: 0,
          }}
          aria-label="Dismiss warning"
        >
          ×
        </button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '0 0 10px', lineHeight: 1.5 }}>
        {warn.detail}
      </p>
      <Link
        href="/setup"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 6,
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
          color: '#fbbf24', fontSize: 11, fontWeight: 600, textDecoration: 'none',
        }}
      >
        Go to Setup →
      </Link>
    </div>,
    document.body,
  ) : null;

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
        <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => onTab('files')}>Files</button>
        <button className={`tab ${tab === 'docs' ? 'active' : ''}`} onClick={() => onTab('docs')}>Docs</button>
      </div>
      <div className="session">
        <div ref={anchorRef}>
          <div className="provider-toggle">
            <button
              className={`provider-btn ${provider === 'ollama' ? 'active' : ''}`}
              onClick={() => handleProviderClick('ollama')}
              title={OLLAMA_STATUS_LABEL[ollamaStatus]}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: OLLAMA_STATUS_COLOR[ollamaStatus],
                  marginRight: 5,
                  flexShrink: 0,
                  transition: 'background 400ms',
                  ...(ollamaStatus === 'ok' ? { boxShadow: '0 0 0 2px rgba(52,211,153,0.2)' } : {}),
                }}
              />
              Ollama
            </button>
            <button
              className={`provider-btn ${provider === 'groq' ? 'active' : ''}`}
              onClick={() => handleProviderClick('groq')}
              title="Use Groq LPU inference (API key required)"
            >
              Groq
            </button>
            <button
              className={`provider-btn ${provider === 'custom' ? 'active' : ''}`}
              onClick={() => handleProviderClick('custom')}
              title="Use HuggingFace API key (configured in Setup)"
            >
              HF
            </button>
          </div>
        </div>
        <span className="kv" style={{ width: 170, flexShrink: 0, overflow: 'hidden' }}>
          <span className="kv-k">provider</span>
          <span
            className="kv-v"
            style={{
              color: PROVIDER_COLOR[provider],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={provider === 'custom' && chatModel ? chatModel : PROVIDER_LABEL[provider]}
          >
            {provider === 'custom' && chatModel
              ? chatModel.split('/').pop()
              : PROVIDER_LABEL[provider]}
          </span>
        </span>
        <span className="live" style={{ color: live.color }}>
          <span
            className="live-dot"
            style={{
              background: live.color,
              boxShadow: live.pulse ? `0 0 0 3px color-mix(in srgb, ${live.color} 30%, transparent)` : 'none',
              animation: live.pulse ? undefined : 'none',
            }}
          />
          {live.label}
        </span>
        <Link href="/setup" className="text-gray-400 hover:text-white transition-colors" title="Model settings">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
        <button
          ref={profileRef}
          onClick={handleProfileClick}
          title={user?.name ?? 'Profile'}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: profileOpen ? '2px solid var(--episodic)' : '2px solid rgba(255,255,255,0.12)',
            background: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
            flexShrink: 0, transition: 'border-color 150ms',
          }}
        >
          {user?.image ? (
            <img src={user.image} alt={user.name ?? 'Profile'} width={30} height={30} style={{ display: 'block', borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 30, height: 30, background: 'var(--episodic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {initials}
            </div>
          )}
        </button>
      </div>
      {warningPortal}
      {profilePortal}
    </div>
  );
}
