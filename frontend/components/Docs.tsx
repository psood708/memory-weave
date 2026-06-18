'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const SECTIONS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'stack',         label: 'Tech Stack' },
  { id: 'quickstart',    label: 'Quick Start' },
  { id: 'setup',         label: 'Model Setup' },
  { id: 'architecture',  label: 'Memory Architecture' },
  { id: 'conversation',  label: 'Conversation Panel' },
  { id: 'memory-panel',  label: 'Memory State Panel' },
  { id: 'kg-panel',      label: 'Knowledge Graph' },
  { id: 'providers',     label: 'Providers' },
  { id: 'evals',         label: 'Eval Dashboard' },
  { id: 'deployment',    label: 'Deployment' },
  { id: 'tips',          label: 'Tips & Best Practices' },
];

const SEARCH_INDEX: Record<string, string> = {
  overview:      'overview what is memoryweave multi-tier memory three tier working episodic knowledge graph context prompt forget window portfolio project',
  stack:         'tech stack fastapi next.js langchain langgraph qdrant postgres postgresql redis groq ollama huggingface fastembed railway docker',
  quickstart:    'quick start setup install docker compose redis postgres npm run dev get started first steps local development',
  setup:         'model setup groq api key huggingface hf key ollama local provider configure settings gear icon',
  architecture:  'architecture langraph agents hebbian decay lambda importance score vector embedding cosine qdrant extraction fused ppr personalized pagerank bfs traversal injection order async',
  conversation:  'conversation panel chat message send enter agent steps ep kg mrg cnv memory mode question mode context chips clear history working episodic stream sse',
  'memory-panel':'memory state panel working memory episodes entities filter reload clear importance decay history edge weight tab inspector',
  'kg-panel':    'knowledge graph panel node types person concept event edge weights drag click hover inspector fullscreen question ask query answer force directed react-force-graph',
  providers:     'providers ollama huggingface hf api key model setup inference groq llama cloud local custom',
  evals:         'eval dashboard token efficiency retrieval accuracy judge circuit breaker kg contribution latency postgres metrics ragas faithfulness answer relevance context relevance ainvoke async',
  deployment:    'deployment railway docker dockerfile api frontend postgres redis qdrant cloud groq production env vars cors auth secret',
  tips:          'tips best practices named entities query question mode session persistence langsmith trace devtools sessionStorage seed cross-turn recall',
};

function highlight(text: string, q: string) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} style={{ background: 'color-mix(in srgb, var(--kg) 28%, transparent)', color: 'var(--fg-0)', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
          : p,
      )}
    </>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      background: `${color}18`, border: `1px solid ${color}40`, color,
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function Section({ id, title, children, q }: { id: string; title: string; children: React.ReactNode; q: string }) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, color: 'var(--fg-0)',
        marginBottom: 16, paddingBottom: 10,
        borderBottom: '1px solid var(--line-2)',
        letterSpacing: '-0.02em',
      }}>
        {highlight(title, q)}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--fg-2)', marginBottom: 12 }}>{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontFamily: 'var(--font-mono)', fontSize: 12, padding: '1px 5px',
      background: 'var(--bg-3)', border: '1px solid var(--line-2)',
      borderRadius: 3, color: 'var(--fg-1)',
    }}>
      {children}
    </code>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65,
      padding: '12px 16px', background: 'var(--bg-2)',
      border: '1px solid var(--line-2)', borderRadius: 8,
      color: 'var(--fg-1)', overflowX: 'auto', marginBottom: 16,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {children}
    </pre>
  );
}

function Note({ children, accent = 'var(--info)' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px',
      background: `${accent}0f`, border: `1px solid ${accent}30`,
      borderRadius: 8, marginBottom: 16,
    }}>
      <span style={{ color: accent, fontSize: 13, marginTop: 1 }}>ℹ</span>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fg-2)', margin: 0 }}>{children}</p>
    </div>
  );
}

function TierCard({ color, name, desc, detail }: { color: string; name: string; desc: string; detail: string }) {
  return (
    <div style={{
      padding: '14px 16px', background: `${color}0a`,
      border: `1px solid ${color}30`, borderRadius: 10, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>{name}</span>
        <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>— {desc}</span>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--fg-3)', margin: 0, paddingLeft: 16 }}>{detail}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--line-1)', alignItems: 'start',
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--fg-2)' }}>{children}</span>
    </div>
  );
}

function StackBadge({ name, role, color }: { name: string; role: string; color: string }) {
  return (
    <div style={{
      padding: '10px 14px', background: 'var(--bg-2)', border: `1px solid ${color}30`,
      borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{name}</span>
      <span style={{ fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.4 }}>{role}</span>
    </div>
  );
}

export default function Docs() {
  const [active, setActive]   = useState('overview');
  const [search, setSearch]   = useState('');
  const searchRef             = useRef<HTMLInputElement>(null);
  const mainRef               = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();

  const visibleSections = q
    ? SECTIONS.filter(s =>
        s.label.toLowerCase().includes(q) ||
        SEARCH_INDEX[s.id]?.toLowerCase().includes(q),
      )
    : SECTIONS;

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (q && visibleSections.length > 0) {
      setActive(visibleSections[0].id);
      document.getElementById(visibleSections[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sectionProps = (id: string, title: string) => ({ id, title, q });

  return (
    <div className="docs-layout">

      {/* ── Sidebar ── */}
      <nav className="docs-nav">
        <div className="docs-nav-head">
          <span className="docs-nav-title">Documentation</span>
          <div className="docs-search-wrap">
            <Icon name="search" size={12} className="docs-search-ic" />
            <input
              ref={searchRef}
              className="docs-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search documentation"
            />
            {search ? (
              <button className="docs-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <Icon name="close" size={10} />
              </button>
            ) : (
              <span className="docs-search-hint">/</span>
            )}
          </div>
          {q && (
            <div className="docs-search-count">
              {visibleSections.length === 0
                ? 'No results'
                : `${visibleSections.length} section${visibleSections.length !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        {SECTIONS.map(s => {
          const isMatch = q ? visibleSections.some(v => v.id === s.id) : true;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`docs-nav-item ${active === s.id ? 'active' : ''} ${q && !isMatch ? 'dimmed' : ''} ${q && isMatch ? 'matched' : ''}`}
            >
              {s.label}
              {q && isMatch && <span className="docs-match-dot" />}
            </button>
          );
        })}
      </nav>

      {/* ── Main content ── */}
      <main className="docs-main" ref={mainRef}>
        <div className="docs-content">

          {q && visibleSections.length === 0 && (
            <div className="docs-no-results">
              <Icon name="search" size={28} style={{ color: 'var(--fg-4)', marginBottom: 12 }} />
              <p>No sections match <strong>"{search}"</strong></p>
              <button className="docs-clear-btn" onClick={() => setSearch('')}>Clear search</button>
            </div>
          )}

          {/* ── Overview ── */}
          {(!q || visibleSections.some(s => s.id === 'overview')) && (
            <Section {...sectionProps('overview', 'Overview')}>
              <P>
                MemoryWeave is a production-deployed, multi-tier conversational AI system built as a portfolio project
                demonstrating applied AI engineering. It gives an LLM persistent, structured memory across conversations —
                not just a sliding window of recent messages, but episodic memories weighted by importance and a live
                knowledge graph of entities and relationships.
              </P>
              <P>
                Unlike a plain chatbot that forgets when the context window fills, MemoryWeave selectively stores,
                decays, and retrieves context using three memory tiers that work together to keep the most relevant
                information in every prompt.
              </P>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                {[
                  { color: 'var(--working)',  icon: '⚡', title: 'Working Memory',   desc: 'Last N turns, always in context. In-memory deque.' },
                  { color: 'var(--episodic)', icon: '🧠', title: 'Episodic Memory',  desc: 'Past turns scored by importance, decay over time, retrieved by vector search.' },
                  { color: 'var(--kg)',       icon: '🕸',  title: 'Knowledge Graph', desc: 'Named entities & relationships with Hebbian edge weights.' },
                ].map(c => (
                  <div key={c.title} style={{
                    padding: 14, background: `${c.color}0a`, border: `1px solid ${c.color}30`,
                    borderRadius: 10, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.color, marginBottom: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Tech Stack ── */}
          {(!q || visibleSections.some(s => s.id === 'stack')) && (
            <Section {...sectionProps('stack', 'Tech Stack')}>
              <P>Full-stack system built for horizontal scale, with swappable backends at every tier.</P>
              <Sub title="Backend">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  <StackBadge name="FastAPI" role="Async REST + SSE streaming" color="var(--ok)" />
                  <StackBadge name="LangGraph" role="Multi-agent orchestration pipeline" color="var(--episodic)" />
                  <StackBadge name="PostgreSQL" role="Users, sessions, eval metrics" color="#60a5fa" />
                  <StackBadge name="Qdrant Cloud" role="Episodic vector store" color="var(--episodic)" />
                  <StackBadge name="Redis" role="Cross-replica session TTL cache" color="#f87171" />
                  <StackBadge name="FastEmbed" role="Local embeddings — BAAI/bge-small-en-v1.5" color="var(--kg)" />
                </div>
              </Sub>
              <Sub title="Frontend">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  <StackBadge name="Next.js 14" role="App Router, SSR, API proxy rewrites" color="var(--fg-1)" />
                  <StackBadge name="Auth.js v5" role="Google + GitHub OAuth, JWT cookies" color="#fbbf24" />
                  <StackBadge name="react-force-graph" role="Live KG visualisation" color="var(--kg)" />
                </div>
              </Sub>
              <Sub title="LLM Providers">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  <StackBadge name="Groq" role="Production LLM — llama-3.3-70b-versatile" color="#f59e0b" />
                  <StackBadge name="Ollama" role="Local inference — qwen3.5:9b" color="var(--ok)" />
                  <StackBadge name="HuggingFace" role="Serverless inference API" color="#f59e0b" />
                </div>
              </Sub>
              <Sub title="Deployment">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <StackBadge name="Railway" role="API + Frontend services, Docker builds" color="#a78bfa" />
                  <StackBadge name="Docker" role="Dockerfile.api + Dockerfile.frontend" color="#60a5fa" />
                  <StackBadge name="LangSmith" role="Agent trace observability" color="var(--episodic)" />
                </div>
              </Sub>
            </Section>
          )}

          {/* ── Quick Start ── */}
          {(!q || visibleSections.some(s => s.id === 'quickstart')) && (
            <Section {...sectionProps('quickstart', 'Quick Start')}>
              <Sub title="Local development">
                <P>Requirements: Docker, Python 3.12+, Node 20+, <Code>uv</Code> package manager.</P>
                <Block>{`# 1. Start infra services
docker compose up -d postgres redis

# 2. Copy and configure environment
cp .env.example .env   # fill in AUTH_SECRET, GOOGLE_CLIENT_ID, etc.

# 3. Start the API (port 8000)
uv run python run_api.py

# 4. Start the frontend (port 3000)
cd frontend && npm install && npm run dev`}</Block>
                <P>Open <Code>http://localhost:3000</Code>, sign in with Google, then complete model setup to choose your LLM provider.</P>
              </Sub>
              <Sub title="Using Groq for local dev (recommended)">
                <P>
                  The fastest local setup uses Groq cloud inference — no GPU needed. Get a free API key at{' '}
                  <Code>console.groq.com</Code> and add it to <Code>.env</Code>:
                </P>
                <Block>{`LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile`}</Block>
              </Sub>
              <Sub title="Using Ollama for fully local inference">
                <Block>{`ollama pull qwen3.5:9b
ollama serve   # starts on localhost:11434

# In .env:
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen3.5:9b`}</Block>
              </Sub>
              <Sub title="Seed demo data (optional)">
                <P>Load a pre-built knowledge graph and episodic memories for a richer first experience:</P>
                <Block>{`uv run python scripts/seed_data.py --provider groq`}</Block>
                <Note>
                  To link seeded eval metrics to your own browser session, grab your session ID from
                  DevTools → Application → Session Storage → <Code>mw.session</Code>, then rerun with{' '}
                  <Code>--session-id &lt;id&gt;</Code>.
                </Note>
              </Sub>
            </Section>
          )}

          {/* ── Model Setup ── */}
          {(!q || visibleSections.some(s => s.id === 'setup')) && (
            <Section {...sectionProps('setup', 'Model Setup')}>
              <P>
                After signing in, you'll be directed to the Setup page to configure your LLM provider.
                You can return at any time via the gear icon (⚙) in the top-right of the dashboard.
              </P>
              <Sub title="Groq (recommended for cloud)">
                <P>
                  1. Go to <Code>console.groq.com</Code> → sign in → <Code>API Keys</Code> → <Code>Create API Key</Code>.<br />
                  2. On the Setup page, select <strong>Groq</strong>, paste your key, and click Save.<br />
                  3. The status indicator in the topbar turns green when the key is active.
                </P>
                <Note accent="var(--ok)">Groq's free tier is sufficient for regular use. The default model is <Code>llama-3.3-70b-versatile</Code>.</Note>
              </Sub>
              <Sub title="HuggingFace Inference API">
                <P>
                  1. Go to <Code>huggingface.co/settings/tokens</Code> → create a read-access token.<br />
                  2. On the Setup page, select <strong>HuggingFace</strong>, paste your token, and pick a model.<br />
                  3. Default model: <Code>Qwen/Qwen2.5-7B-Instruct</Code>. The HF free tier is rate-limited.
                </P>
              </Sub>
              <Sub title="Ollama (local only)">
                <P>
                  No API key required. Just run <Code>ollama serve</Code> locally and select <strong>Ollama</strong>
                  in the topbar. The green dot next to the Ollama button shows connection status.
                </P>
              </Sub>
              <Note>
                Your API key is encrypted at rest using Fernet symmetric encryption (<Code>ENCRYPTION_KEY</Code>)
                before being stored in Postgres. It is never logged or returned in plaintext.
              </Note>
            </Section>
          )}

          {/* ── Architecture ── */}
          {(!q || visibleSections.some(s => s.id === 'architecture')) && (
            <Section {...sectionProps('architecture', 'Memory Architecture')}>
              <P>Every message triggers a LangGraph pipeline with four specialised agents firing in sequence:</P>
              <TierCard
                color="var(--working)"
                name="Working Memory"
                desc="sliding window buffer"
                detail="Holds the last 10 turns verbatim. Always injected at the top of the prompt. Zero latency — pure in-memory deque, optionally persisted to Redis for cross-replica consistency."
              />
              <TierCard
                color="var(--episodic)"
                name="Episodic Memory"
                desc="vector store with decay"
                detail="Stores summaries of past turns scored by importance (0–1). Uses exponential decay (λ=0.05) so old, unreferenced memories fade. Retrieved via cosine similarity in Qdrant Cloud. Top-5 episodes are injected into the prompt above the working memory block."
              />
              <TierCard
                color="var(--kg)"
                name="Knowledge Graph"
                desc="entity graph with Hebbian weights"
                detail="Extracts named entities (Person, Project, Organization, Event, Fact) and typed relationships from every turn via structured LLM output. Edge weights increase on re-observation (Hebbian reinforcement) and decay when unused. Multi-seed queries use Personalized PageRank traversal (HippoRAG-style) capped at 12 nodes. Stored in PostgreSQL for persistence across restarts."
              />
              <Sub title="Context injection order">
                <P>The final prompt assembled for the conversational LLM:</P>
                <Block>{`[System prompt]
[KG subgraph — relevant entities & typed edges, up to 12 nodes]
[Top-5 episodic memories — scored by importance × recency]
[Last 10 working turns — verbatim]
[Current user message]`}</Block>
              </Sub>
              <Sub title="Importance scoring">
                <P>
                  When a turn is written to episodic memory, the KG agent returns a fused importance score (0–1)
                  based on entity density and centrality. Only turns scoring above <Code>0.4</Code> are persisted.
                  Configurable via <Code>EPISODIC_IMPORTANCE_THRESHOLD</Code> in environment.
                </P>
              </Sub>
              <Sub title="Retrieval pipeline">
                <P>
                  The two-phase retrieval combines semantic search with graph traversal: FastEmbed generates
                  a query embedding locally (no API call), Qdrant returns top-K episodes by cosine similarity,
                  then the KG agent expands relevant entities via PPR traversal. Both results are merged and
                  ranked before prompt assembly.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── Conversation Panel ── */}
          {(!q || visibleSections.some(s => s.id === 'conversation')) && (
            <Section {...sectionProps('conversation', 'Conversation Panel')}>
              <Sub title="Sending messages">
                <P>
                  Type in the input box and press <Code>Enter</Code> (or <Code>Shift+Enter</Code> for a newline).
                  After sending, four agent step indicators animate across the top showing the pipeline progress.
                </P>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { step: 'EP',  color: 'var(--episodic)', desc: 'Episodic retrieval — fetching relevant past memories from Qdrant' },
                    { step: 'KG',  color: 'var(--kg)',       desc: 'Graph traversal — finding related entities via PPR' },
                    { step: 'MRG', color: 'var(--working)',  desc: 'Context merge — assembling the ranked prompt block' },
                    { step: 'CNV', color: 'var(--fg-2)',     desc: 'Conversation — LLM generates response, streamed token by token' },
                  ].map(s => (
                    <div key={s.step} style={{
                      display: 'flex', gap: 8, padding: '8px 10px',
                      background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 8,
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: s.color, minWidth: 30 }}>{s.step}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{s.desc}</span>
                    </div>
                  ))}
                </div>
                <P>Responses stream in real time via Server-Sent Events (SSE) — you see tokens appear as the LLM generates them.</P>
              </Sub>
              <Sub title="Memory mode vs Question mode">
                <P>The mode toggle in the input bar controls whether this turn is written back to memory:</P>
                <Row label="memory (default)">
                  The turn is fully processed — entities extracted, episode scored and stored, KG updated.
                  Retrieval eval metrics are recorded. Use this for conversations you want remembered.
                </Row>
                <Row label="question">
                  The LLM retrieves from memory to answer, but this turn is <em>not</em> written back.
                  Use for one-off queries that shouldn't pollute the memory store. Retrieval quality
                  metrics are still recorded in the Eval Dashboard.
                </Row>
              </Sub>
              <Sub title="Context chips">
                <P>
                  Below each bot response, coloured chips show which episodes and KG nodes were retrieved.
                  The number shows retrieval stats (episodes used, graph hops, token count, latency).
                  Click any chip to open the Inspector drawer with full details.
                </P>
              </Sub>
              <Sub title="File attachments">
                <P>
                  Use the Files tab to upload documents. Uploaded files are chunked and indexed into episodic
                  memory so the agent can reference them in conversation.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── Memory State Panel ── */}
          {(!q || visibleSections.some(s => s.id === 'memory-panel')) && (
            <Section {...sectionProps('memory-panel', 'Memory State Panel')}>
              <P>
                The left panel shows all three memory tiers live. It refreshes automatically after each turn
                when the backend fires a <Code>memory_updated</Code> event.
              </P>
              <Sub title="Working Memory tab">
                <P>Shows the last N verbatim turns (default: 10). These are always in the prompt. No decay, no scoring. Persisted to Redis per session.</P>
              </Sub>
              <Sub title="Episodes tab">
                <P>
                  Each card is one stored episodic memory. The score on the left is its current importance
                  after decay. The bar shows decay history across the last 5 intervals.
                </P>
                <Row label="importance score">Score (0–1) assigned at write time by the KG agent's fused extraction result.</Row>
                <Row label="decay">Score reduces by e<sup>−λt</sup> each decay interval (λ=0.05). Memories below 0.05 are pruned.</Row>
                <Row label="entities">Coloured chips show linked KG entities. Click to open Inspector.</Row>
                <Row label="filter bar">Type any keyword to filter episodes in real time.</Row>
              </Sub>
              <Sub title="Entities tab">
                <P>
                  Lists all nodes in the knowledge graph with their degree and average edge weight.
                  Click any entity to open its Inspector drawer showing edges and linked episodes.
                </P>
              </Sub>
              <Sub title="Reload / Clear">
                <P>
                  The reload icon re-fetches memory state. The clear icons wipe individual tiers —
                  useful when testing or resetting a session. Clearing episodic memory removes entries
                  from Qdrant; clearing KG removes the Postgres graph rows.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── KG Panel ── */}
          {(!q || visibleSections.some(s => s.id === 'kg-panel')) && (
            <Section {...sectionProps('kg-panel', 'Knowledge Graph Panel')}>
              <P>
                The right panel renders the live knowledge graph as a force-directed layout using
                <Code>react-force-graph</Code>. Nodes are coloured by entity type; edges scale with
                Hebbian weight.
              </P>
              <Sub title="Node types">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Chip color="var(--working)"  label="person" />
                  <Chip color="var(--kg)"       label="concept" />
                  <Chip color="var(--episodic)" label="event" />
                </div>
                <P>Node size reflects degree — highly connected entities appear larger.</P>
              </Sub>
              <Sub title="Edge weights">
                <P>
                  Edge thickness and opacity reflect the Hebbian weight. A thick bright edge means the
                  relationship has been mentioned repeatedly. Thin faded edges may be pruned as their
                  weight decays below <Code>KG_MIN_EDGE_WEIGHT</Code>.
                </P>
              </Sub>
              <Sub title="Interactions">
                <Row label="Click a node">Opens the Inspector drawer — all edges, linked episodes, and metadata.</Row>
                <Row label="Drag a node">Pin it in place. Layout re-stabilises around it.</Row>
                <Row label="Hover a node">Highlights connected edges, dims unrelated nodes.</Row>
                <Row label="Scroll to zoom">Zoom in/out on the graph canvas.</Row>
                <Row label="Export">Gear icon → export as PNG, SVG, or JSON adjacency list.</Row>
              </Sub>
              <Sub title="Fullscreen — Question window">
                <P>
                  Click the expand icon to open the graph fullscreen. A conversation panel appears
                  alongside it — ask questions about your knowledge graph and answers stream back with
                  retrieval metadata (episodes used, KG hops, tokens, latency). Runs in{' '}
                  <Code>question</Code> mode so queries don't pollute the main memory.
                </P>
              </Sub>
              <Note accent="var(--kg)">
                The graph is persisted in PostgreSQL so it survives server restarts. Your session ID in{' '}
                <Code>sessionStorage</Code> is used to reload the same graph on reconnect.
              </Note>
            </Section>
          )}

          {/* ── Providers ── */}
          {(!q || visibleSections.some(s => s.id === 'providers')) && (
            <Section {...sectionProps('providers', 'Providers')}>
              <P>
                MemoryWeave supports three LLM providers switchable per-user via the Setup page or the
                topbar toggle. The selected provider is used for both the conversational LLM and the
                entity extraction LLM.
              </P>
              <Sub title="Groq (cloud — recommended)">
                <P>
                  Fast LPU inference. Free tier at <Code>console.groq.com</Code>.
                  Default model: <Code>llama-3.3-70b-versatile</Code>. No GPU needed.
                  Set your key in Setup → the status indicator turns green immediately.
                </P>
              </Sub>
              <Sub title="HuggingFace Inference API">
                <P>
                  Serverless inference via HuggingFace's hosted models. Requires a read-access token from{' '}
                  <Code>huggingface.co/settings/tokens</Code>. Default model: <Code>Qwen/Qwen2.5-7B-Instruct</Code>.
                  Free tier is rate-limited; use a PRO account for production workloads.
                </P>
              </Sub>
              <Sub title="Ollama (local)">
                <P>
                  Runs inference entirely on your machine — no API key, no cost, no data leaves your device.
                  Requires Ollama installed and a model pulled. The topbar shows a live connection dot:
                  green = reachable, red = server not running.
                </P>
                <Block>{`ollama pull qwen3.5:9b && ollama serve`}</Block>
              </Sub>
              <Note>
                Embeddings always use FastEmbed's <Code>BAAI/bge-small-en-v1.5</Code> model locally —
                no API call, no cost, regardless of which LLM provider is selected.
              </Note>
            </Section>
          )}

          {/* ── Evals ── */}
          {(!q || visibleSections.some(s => s.id === 'evals')) && (
            <Section {...sectionProps('evals', 'Eval Dashboard')}>
              <P>
                The Evals tab shows live quality metrics measured by an automated pipeline that fires
                asynchronously after every turn — no latency added to the response.
              </P>
              <Sub title="Memory Eval metrics">
                <Row label="token efficiency"><Code>1 − (system_tokens / naive_tokens)</Code> — how much smaller MemoryWeave's prompt is vs a naive full-history approach. Higher is better.</Row>
                <Row label="judge score">Score (0–1) from an LLM judge assessing faithfulness and context quality. Uses Groq by default; falls back to a heuristic scorer if the circuit-breaker trips.</Row>
                <Row label="KG contribution rate">Fraction of turns where the KG contributed at least one node to the prompt.</Row>
                <Row label="latency">End-to-end response time in milliseconds, including retrieval and LLM generation.</Row>
              </Sub>
              <Sub title="Retrieval Quality metrics (RAGAS-inspired)">
                <P>
                  After every memory-mode turn, a second LLM evaluation scores retrieval quality using
                  RAGAS-inspired metrics (Es et al. 2023). Runs asynchronously so it never blocks responses.
                </P>
                <Row label="context relevance">Are the retrieved KG nodes and episodes actually useful for answering this query?</Row>
                <Row label="faithfulness">Does the answer stay within the retrieved context, or does it add unsupported claims?</Row>
                <Row label="answer relevance">Does the answer directly address what was asked?</Row>
                <Row label="KG seed hit rate">Fraction of turns where KG traversal found a seed node and contributed context.</Row>
                <Row label="episode count">Average number of episodic memories retrieved per turn.</Row>
              </Sub>
              <Sub title="Judge circuit breaker">
                <P>
                  If the LLM judge fails 3 consecutive times (timeout or API error), it disables itself
                  and switches to a fast heuristic scorer (keyword overlap + response length ratio).
                  Auto-resets after 5 minutes. Status visible via the <Code>/eval/health</Code> endpoint.
                </P>
              </Sub>
              <Note accent="var(--episodic)">
                All eval metrics are written to the <Code>turn_metrics</Code> and <Code>retrieval_evals</Code>{' '}
                tables in Postgres per session. Query them directly for offline analysis.
              </Note>
            </Section>
          )}

          {/* ── Deployment ── */}
          {(!q || visibleSections.some(s => s.id === 'deployment')) && (
            <Section {...sectionProps('deployment', 'Deployment')}>
              <P>
                MemoryWeave is deployed on Railway as two separate Docker services built from the same
                GitHub repo. Postgres and Redis come from Railway's native add-ons. Qdrant Cloud replaces
                self-hosted ChromaDB for the vector store.
              </P>
              <Sub title="Services">
                <Row label="API service">Built from <Code>Dockerfile.api</Code>. FastAPI + all Python dependencies. Runs on Railway's internal network.</Row>
                <Row label="Frontend service">Built from <Code>Dockerfile.frontend</Code>. Next.js static build with API proxy rewrites. Public-facing.</Row>
                <Row label="Postgres add-on">Railway-managed PostgreSQL. Auto-migrated on API startup via <Code>init_db()</Code>.</Row>
                <Row label="Redis add-on">Railway-managed Redis. Used for working memory TTL cache across API replicas.</Row>
                <Row label="Qdrant Cloud">External managed cluster (free tier). Episodic vector store.</Row>
              </Sub>
              <Sub title="Key environment variables (API)">
                <Block>{`APP_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
QDRANT_URL=https://....qdrant.io
QDRANT_API_KEY=...
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
AUTH_SECRET=<32-byte base64>        # must match frontend
ENCRYPTION_KEY=<fernet key>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CORS_ORIGINS=["https://your-frontend.up.railway.app"]`}</Block>
              </Sub>
              <Sub title="Key environment variables (Frontend)">
                <Block>{`NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
NEXTAUTH_URL=https://your-frontend.up.railway.app
AUTH_TRUST_HOST=true
AUTH_SECRET=<same value as API>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...`}</Block>
              </Sub>
              <Note accent="var(--kg)">
                <Code>AUTH_SECRET</Code> must be identical on both services — the frontend signs JWTs with it,
                the API verifies them. Generate one with: <Code>openssl rand -base64 32</Code>
              </Note>
              <Sub title="Database migrations">
                <P>
                  Migrations in <Code>memoryweave/db/migrations/</Code> run automatically on API startup
                  via <Code>init_db()</Code>. Already-applied files are tracked in <Code>schema_migrations</Code>{' '}
                  and skipped on subsequent deploys. No manual migration step needed.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── Tips ── */}
          {(!q || visibleSections.some(s => s.id === 'tips')) && (
            <Section {...sectionProps('tips', 'Tips & Best Practices')}>
              <Sub title="Getting a rich knowledge graph">
                <P>
                  The KG is built from named entities — people, organisations, projects, events. Introduce
                  yourself, mention people by name, describe relationships explicitly.
                </P>
                <Block>{`# Good — creates Person → worksAt → Organization edges
"My colleague Priya Nair is a founding engineer at Letta AI."

# Weak — no extractable entities
"I spoke to someone at a startup about memory systems."`}</Block>
              </Sub>
              <Sub title="Testing cross-turn recall">
                <P>After a few turns, ask questions that require both episodic and KG retrieval:</P>
                <Block>{`"How are Sarah and Lena connected?"
"What advice did I receive about my KG implementation?"
"Who in my network could help with Rust async patterns?"`}</Block>
              </Sub>
              <Sub title="Use question mode for queries">
                <P>
                  Switch to <Code>question</Code> mode to query memory without writing anything back.
                  Good for debugging retrieval, checking what the agent knows, or one-off lookups.
                  Retrieval quality is still evaluated in the Evals tab.
                </P>
              </Sub>
              <Sub title="Session persistence">
                <P>
                  Your session ID is stored in <Code>sessionStorage</Code> under <Code>mw.session</Code>.
                  It persists across page refreshes but not across browser tabs or devices.
                  The knowledge graph and episodes are persisted in Postgres + Qdrant and reloaded
                  on reconnect using the same session ID.
                </P>
              </Sub>
              <Sub title="Watching traces in LangSmith">
                <P>
                  Every agent run is traced automatically if <Code>LANGSMITH_TRACING=true</Code>.
                  Visit <Code>smith.langchain.com</Code> → project <Code>memory-weave</Code> to see the
                  full waterfall: agent latencies, token counts, LLM inputs/outputs per turn.
                </P>
              </Sub>
            </Section>
          )}

        </div>
      </main>
    </div>
  );
}
