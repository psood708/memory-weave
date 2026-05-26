'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';

interface LandingPageProps {
  onEnter: (view: 'dashboard' | 'evals') => void;
}

/* ── Brand mark SVG ─────────────────────────────────────────────── */
function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="bm-g-home" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.55" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f5a524" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" stroke="url(#bm-g-home)" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="6.5" stroke="rgba(167,139,250,0.6)" strokeWidth="1" />
      <circle cx="12" cy="12" r="2.5" fill="url(#bm-g-home)" />
      <circle cx="12" cy="2" r="1.6" fill="#2dd4bf" />
      <circle cx="22" cy="14" r="1.6" fill="#a78bfa" />
      <circle cx="4" cy="18" r="1.6" fill="#f5a524" />
      <line x1="12" y1="12" x2="12" y2="2" stroke="rgba(45,212,191,0.5)" strokeWidth="0.8" />
      <line x1="12" y1="12" x2="22" y2="14" stroke="rgba(167,139,250,0.5)" strokeWidth="0.8" />
      <line x1="12" y1="12" x2="4" y2="18" stroke="rgba(245,165,36,0.5)" strokeWidth="0.8" />
    </svg>
  );
}

/* ── Memory network viz ─────────────────────────────────────────── */
const NODES = [
  { id: 'hub', x: 268, y: 228, type: 'hub',      r: 9 },
  { id: 'w1',  x: 106, y:  96, type: 'working',  r: 5,   label: 'context' },
  { id: 'w2',  x: 158, y: 212, type: 'working',  r: 4.5, label: 'turn 6' },
  { id: 'w3',  x:  82, y: 310, type: 'working',  r: 4,   label: 'intent' },
  { id: 'e1',  x: 420, y:  78, type: 'episodic', r: 5,   label: 'sprint plan' },
  { id: 'e2',  x: 468, y: 192, type: 'episodic', r: 4.5, label: "Anya OK'd" },
  { id: 'e3',  x: 388, y: 316, type: 'episodic', r: 4,   label: 'Mon 10:42' },
  { id: 'k1',  x: 268, y: 392, type: 'kg',       r: 5,   label: 'Anya' },
  { id: 'k2',  x: 152, y: 420, type: 'kg',       r: 4,   label: 'Project X' },
  { id: 'k3',  x: 390, y: 406, type: 'kg',       r: 4,   label: 'Budget' },
] as const;

type NodeType = typeof NODES[number]['type'];

const EDGES: [string, string][] = [
  ['hub','w1'],['hub','w2'],['hub','w3'],
  ['hub','e1'],['hub','e2'],['hub','e3'],
  ['hub','k1'],['hub','k2'],['hub','k3'],
  ['w1','e1'],['e2','k1'],['k1','k2'],['k1','k3'],
];

const NODE_COLORS: Record<NodeType, { fill: string; glow: string; edge: string }> = {
  working:  { fill: '#2dd4bf', glow: 'rgba(45,212,191,0.35)',  edge: 'rgba(45,212,191,0.22)' },
  episodic: { fill: '#f5a524', glow: 'rgba(245,165,36,0.30)',  edge: 'rgba(245,165,36,0.18)' },
  kg:       { fill: '#a78bfa', glow: 'rgba(167,139,250,0.32)', edge: 'rgba(167,139,250,0.20)' },
  hub:      { fill: 'url(#net-ng)', glow: 'rgba(167,139,250,0.25)', edge: 'rgba(255,255,255,0.08)' },
};

const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

function MemoryNetwork() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % NODES.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <svg viewBox="0 0 540 480" width="540" height="480" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="net-ng" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#f5a524" />
        </linearGradient>
        <filter id="net-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="net-sm" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* background grid dots */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => (
          <circle key={`d-${row}-${col}`} cx={col * 66} cy={row * 66} r="1" fill="rgba(255,255,255,0.035)" />
        ))
      )}

      {/* edges */}
      {EDGES.map(([a, b]) => {
        const na = nodeMap[a], nb = nodeMap[b];
        const type = na.type === 'hub' ? nb.type : na.type;
        const col = NODE_COLORS[type as NodeType]?.edge ?? 'rgba(255,255,255,0.08)';
        const len = Math.hypot(nb.x - na.x, nb.y - na.y);
        const animated = len > 80;
        return (
          <line key={`${a}-${b}`}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke={col} strokeWidth="1" strokeLinecap="round"
            strokeDasharray={animated ? '6 6' : 'none'}
            style={animated ? { animation: `edge-dash ${(len / 60).toFixed(1)}s linear infinite` } : {}}
          />
        );
      })}

      {/* nodes */}
      {NODES.map((node, i) => {
        const col = NODE_COLORS[node.type];
        const isActive = i === active;
        return (
          <g key={node.id} style={{ animation: `node-glow 2.8s ease-in-out ${i * 0.28}s infinite` }}>
            <circle cx={node.x} cy={node.y} r={node.r + 10}
              fill={col.glow.replace('0.3', '0.07').replace('0.2', '0.06')} />
            <circle cx={node.x} cy={node.y} r={node.r + (isActive ? 5 : 0)}
              fill={col.glow.replace('0.35','0.12').replace('0.30','0.10').replace('0.32','0.10').replace('0.25','0.08')}
              style={{ transition: 'r 400ms ease' }} />
            <circle cx={node.x} cy={node.y} r={node.r}
              fill={col.fill}
              filter={isActive ? 'url(#net-glow)' : 'url(#net-sm)'}
              style={{ transition: 'r 400ms' }} />
            {node.type === 'hub' && (
              <circle cx={node.x} cy={node.y} r={node.r + 6}
                fill="none" stroke="rgba(167,139,250,0.3)" strokeWidth="0.8"
                strokeDasharray="4 3"
                style={{ animation: 'edge-dash 8s linear infinite reverse', transformOrigin: `${node.x}px ${node.y}px` }} />
            )}
            {'label' in node && node.label && (
              <text
                x={node.x + (node.x < 268 ? -(node.r + 8) : node.r + 8)}
                y={node.y + 4}
                fill="rgba(255,255,255,0.38)"
                fontSize="9.5"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="500"
                textAnchor={node.x < 268 ? 'end' : 'start'}>
                {node.label}
              </text>
            )}
          </g>
        );
      })}

      {/* tier badges */}
      <g style={{ animation: 'badge-in 600ms 800ms ease-out both' }}>
        <rect x="56" y="52" width="88" height="22" rx="11"
          fill="rgba(45,212,191,0.1)" stroke="rgba(45,212,191,0.3)" strokeWidth="0.8" />
        <text x="100" y="67" textAnchor="middle" fill="#2dd4bf"
          fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">WORKING MEM</text>
      </g>
      <g style={{ animation: 'badge-in 600ms 1000ms ease-out both' }}>
        <rect x="372" y="38" width="88" height="22" rx="11"
          fill="rgba(245,165,36,0.1)" stroke="rgba(245,165,36,0.3)" strokeWidth="0.8" />
        <text x="416" y="53" textAnchor="middle" fill="#f5a524"
          fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">EPISODIC MEM</text>
      </g>
      <g style={{ animation: 'badge-in 600ms 1200ms ease-out both' }}>
        <rect x="208" y="438" width="110" height="22" rx="11"
          fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.3)" strokeWidth="0.8" />
        <text x="263" y="453" textAnchor="middle" fill="#a78bfa"
          fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="600">KNOWLEDGE GRAPH</text>
      </g>
    </svg>
  );
}

/* ── Tier icons ─────────────────────────────────────────────────── */
function TierIcon({ type }: { type: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'working') return (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/>
    </svg>
  );
  if (type === 'episodic') return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
    </svg>
  );
  return (
    <svg {...props}>
      <circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/>
      <line x1="6" y1="6" x2="12" y2="18"/><line x1="18" y1="6" x2="12" y2="18"/><line x1="6" y1="6" x2="18" y2="6"/>
    </svg>
  );
}

/* ── SSO icons ──────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

/* ── Auth modal ─────────────────────────────────────────────────── */
interface AuthModalProps {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSwitch: (mode: 'signin' | 'signup') => void;
  onSuccess: () => void;
}

function AuthModal({ mode, onClose, onSwitch, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState(mode);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });

  useEffect(() => setTab(mode), [mode]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(onSuccess, 900);
    }, 1300);
  };

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-modal" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>

        {success ? (
          <div className="auth-success">
            <div className="check">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3>{tab === 'signin' ? 'Welcome back.' : 'Account created.'}</h3>
            <p>Taking you to the dashboard…</p>
          </div>
        ) : (
          <>
            <div className="auth-top">
              <div className="auth-brand">
                <BrandMark />
                <span className="auth-brand-name">MemoryWeave</span>
              </div>
              <div className="auth-tabs">
                <button className={`auth-tab${tab === 'signin' ? ' active' : ''}`}
                  onClick={() => { setTab('signin'); onSwitch('signin'); }}>Sign in</button>
                <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
                  onClick={() => { setTab('signup'); onSwitch('signup'); }}>Create account</button>
              </div>
            </div>

            <form className="auth-body" onSubmit={handleSubmit} autoComplete="on">
              {tab === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-name">Full name</label>
                  <input id="auth-name" type="text" placeholder="Ada Lovelace" value={form.name} onChange={set('name')} autoFocus />
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="auth-email">Email</label>
                <input id="auth-email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="auth-field">
                {tab === 'signin' ? (
                  <div className="auth-row">
                    <label htmlFor="auth-pw">Password</label>
                    <span className="auth-link" style={{ fontSize: '11px' }}>Forgot?</span>
                  </div>
                ) : (
                  <label htmlFor="auth-pw">Password</label>
                )}
                <input id="auth-pw" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} />
              </div>
              {tab === 'signup' && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm">Confirm password</label>
                  <input id="auth-confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} />
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && <span className="auth-spinner" />}
                {loading
                  ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (tab === 'signin' ? 'Sign in' : 'Create account')
                }
              </button>

              <div className="auth-or">
                <span className="auth-or-line" /><span>or</span><span className="auth-or-line" />
              </div>

              <div className="auth-sso">
                <button type="button" className="sso-btn" onClick={() => signIn('google', { callbackUrl: '/setup' })}>
                  <GoogleIcon />Google
                </button>
                <button type="button" className="sso-btn" onClick={() => signIn('google', { callbackUrl: '/setup' })}>
                  <GithubIcon />GitHub
                </button>
              </div>
            </form>

            <div className="auth-footer">
              {tab === 'signin'
                ? <>Don&apos;t have an account?{' '}
                    <span className="auth-link" onClick={() => { setTab('signup'); onSwitch('signup'); }}>Sign up free</span></>
                : <>Already have an account?{' '}
                    <span className="auth-link" onClick={() => { setTab('signin'); onSwitch('signin'); }}>Sign in</span></>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────── */
function Nav({ onSignin, onSignup, onDashboard }: {
  onSignin: () => void;
  onSignup: () => void;
  onDashboard: () => void;
}) {
  return (
    <nav className="hn">
      <button className="hn-brand" onClick={onDashboard}>
        <BrandMark />
        <span>MemoryWeave</span>
        <span className="brand-tag">v0.4</span>
      </button>
      <div className="hn-links">
        <button className="hn-link" onClick={onDashboard}>Dashboard</button>
        <span className="hn-link" style={{ cursor: 'default', color: 'var(--fg-4)' }}>Docs</span>
        <span className="hn-link" style={{ cursor: 'default', color: 'var(--fg-4)' }}>API</span>
      </div>
      <div className="hn-actions">
        <button className="btn-ghost" onClick={onSignin}>Sign in</button>
        <button className="btn-primary" onClick={onSignup}>
          Get started
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}

/* ── Hero ───────────────────────────────────────────────────────── */
function Hero({ onGetStarted, onDashboard }: { onGetStarted: () => void; onDashboard: () => void }) {
  return (
    <section className="hh">
      <div className="hh-left">
        <span className="hh-eyebrow">
          <span className="dot" />
          Now in early access
        </span>
        <h1 className="hh-h1">Memory that<br /><em>never forgets.</em></h1>
        <p className="hh-sub">
          MemoryWeave gives your AI a layered, persistent memory — working context, episodic recall, and a living knowledge graph that grows richer with every conversation.
        </p>
        <div className="hh-ctas">
          <button className="hh-cta-primary" onClick={onGetStarted}>
            Get started free
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <button className="hh-cta-ghost" onClick={onDashboard}>
            Open dashboard
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/>
            </svg>
          </button>
        </div>
        <div className="hh-stats">
          <div className="hh-stat">
            <span className="v">3</span>
            <span className="k">Memory tiers</span>
          </div>
          <div className="hh-stat-sep" />
          <div className="hh-stat">
            <span className="v">∞</span>
            <span className="k">Session recall</span>
          </div>
          <div className="hh-stat-sep" />
          <div className="hh-stat">
            <span className="v">8k+</span>
            <span className="k">Token budget</span>
          </div>
        </div>
      </div>
      <div className="hh-right">
        <div className="net-wrap">
          <MemoryNetwork />
        </div>
      </div>
    </section>
  );
}

/* ── Tiers section ──────────────────────────────────────────────── */
const TIERS = [
  {
    type: 'working',
    label: 'Working Memory',
    pill: 'In-context',
    body: 'Holds the active conversation window with turn-by-turn importance scores. Fast retrieval within a fixed token budget — the front-line of every response.',
    metric: '312 tokens · 6 turns active',
  },
  {
    type: 'episodic',
    label: 'Episodic Memory',
    pill: 'Long-term',
    body: "Key decisions, facts, and events encoded from every past session. Decay-weighted scoring surfaces what's relevant now, not just what was said last.",
    metric: '416 tokens · 8,421 in store',
  },
  {
    type: 'kg',
    label: 'Knowledge Graph',
    pill: 'Relational',
    body: 'Automatically extracts people, concepts, and events into a queryable graph. Relationships strengthen over time — the more you talk, the smarter it gets.',
    metric: '3 retrieved · 48 entities',
  },
];

function TiersSection() {
  return (
    <section className="ht">
      <div className="ht-header">
        <span className="ht-label">How it works</span>
        <h2 className="ht-title">Three layers of memory,<br />working in concert.</h2>
        <p className="ht-sub">
          Each tier serves a distinct role. Together they give your AI the continuity, context, and relational depth of a long-term collaborator.
        </p>
      </div>
      <div className="ht-cards">
        {TIERS.map(t => (
          <div key={t.type} className={`tier-card ${t.type}`}>
            <div className="tc-icon"><TierIcon type={t.type} /></div>
            <h3 className="tc-head">{t.label}</h3>
            <p className="tc-body">{t.body}</p>
            <div className="tc-footer">
              <span className="tc-pill">{t.pill}</span>
              <span style={{ color: 'var(--fg-4)', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}>{t.metric}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Root ───────────────────────────────────────────────────────── */
export default function LandingPage({ onEnter }: LandingPageProps) {
  const [auth, setAuth] = useState<'signin' | 'signup' | null>(null);

  useEffect(() => {
    document.body.classList.add('home-page');
    return () => document.body.classList.remove('home-page');
  }, []);

  return (
    <div style={{ background: 'var(--bg-0)', minHeight: '100vh' }}>
      <Nav
        onSignin={() => setAuth('signin')}
        onSignup={() => setAuth('signup')}
        onDashboard={() => onEnter('dashboard')}
      />
      <Hero
        onGetStarted={() => setAuth('signup')}
        onDashboard={() => onEnter('dashboard')}
      />
      <TiersSection />
      {auth && (
        <AuthModal
          mode={auth}
          onClose={() => setAuth(null)}
          onSwitch={setAuth}
          onSuccess={() => onEnter('dashboard')}
        />
      )}
    </div>
  );
}
