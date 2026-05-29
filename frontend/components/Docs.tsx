'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

const SECTIONS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'quickstart',    label: 'Quick Start' },
  { id: 'architecture',  label: 'Memory Architecture' },
  { id: 'conversation',  label: 'Conversation Panel' },
  { id: 'memory-panel',  label: 'Memory State Panel' },
  { id: 'kg-panel',      label: 'Knowledge Graph' },
  { id: 'providers',     label: 'Providers' },
  { id: 'evals',         label: 'Eval Dashboard' },
  { id: 'tips',          label: 'Tips & Best Practices' },
];

// Flat searchable text per section (keywords + prose fragments)
const SEARCH_INDEX: Record<string, string> = {
  overview:      'overview what is memoryweave multi-tier memory three tier working episodic knowledge graph context prompt forget window',
  quickstart:    'quick start setup install docker compose redis chroma postgres npm run dev seed data session ollama get started first steps',
  architecture:  'architecture langraph agents hebbian decay lambda importance score vector embedding cosine chromadb qdrant extraction fused ppr personalized pagerank bfs traversal injection order',
  conversation:  'conversation panel chat message send enter agent steps ep kg mrg cnv memory mode question mode context chips clear history working episodic',
  'memory-panel':'memory state panel working memory episodes entities filter reload clear importance decay history edge weight tab inspector',
  'kg-panel':    'knowledge graph panel node types person concept event edge weights drag click hover inspector fullscreen question ask query answer force directed',
  providers:     'providers ollama huggingface hf api key model setup inference fastembed custom endpoint openai compatible qwen groq',
  evals:         'eval dashboard token efficiency retrieval accuracy judge circuit breaker kg contribution latency postgres metrics ragas faithfulness answer relevance context relevance',
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

  // Jump to first result when search changes
  useEffect(() => {
    if (q && visibleSections.length > 0) {
      setActive(visibleSections[0].id);
      document.getElementById(visibleSections[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Keyboard shortcut: / to focus search
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
                MemoryWeave is a multi-tier conversational AI that remembers across turns — not just the last few messages,
                but episodic memories (what you talked about, weighted by importance) and a semantic knowledge graph
                (who you mentioned, how they're connected, what topics recur).
              </P>
              <P>
                Unlike a plain chatbot that forgets everything when the window fills up, MemoryWeave selectively stores,
                decays, and retrieves context using three memory tiers that work together to keep the most relevant
                information in the prompt.
              </P>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                {[
                  { color: 'var(--working)',  icon: '⚡', title: 'Working',         desc: 'Last N turns, always in context' },
                  { color: 'var(--episodic)', icon: '🧠', title: 'Episodic',        desc: 'Important memories, decay over time' },
                  { color: 'var(--kg)',       icon: '🕸',  title: 'Knowledge Graph', desc: 'Entities & relationships, Hebbian weight' },
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

          {/* ── Quick Start ── */}
          {(!q || visibleSections.some(s => s.id === 'quickstart')) && (
            <Section {...sectionProps('quickstart', 'Quick Start')}>
              <Sub title="1. Start the backend">
                <P>Make sure Docker is running, then start the backing services and API:</P>
                <Block>{`docker compose up -d postgres redis chroma\nuv run python run_api.py`}</Block>
              </Sub>
              <Sub title="2. Start the frontend">
                <Block>{`cd frontend && npm run dev`}</Block>
                <P>Open <Code>http://localhost:3000</Code>. Sign in with Google or GitHub, then complete model setup.</P>
              </Sub>
              <Sub title="3. Seed demo data (optional)">
                <P>Load a pre-built knowledge graph and 25 episodic memories for a richer first experience:</P>
                <Block>{`uv run python scripts/seed_data.py --provider ollama`}</Block>
                <Note>
                  To link seeded eval metrics to your own browser session, grab your session ID from
                  DevTools → Application → Session Storage → <Code>mw.session</Code>, then rerun with{' '}
                  <Code>--session-id &lt;id&gt;</Code>.
                </Note>
              </Sub>
              <Sub title="4. Start a conversation">
                <P>
                  Type anything in the Conversation panel. After each turn, watch the Memory State panel update with
                  new episode cards and the Knowledge Graph panel grow with extracted entities.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── Architecture ── */}
          {(!q || visibleSections.some(s => s.id === 'architecture')) && (
            <Section {...sectionProps('architecture', 'Memory Architecture')}>
              <P>Every time you send a message, five LangGraph agents fire in sequence:</P>
              <TierCard
                color="var(--working)"
                name="Working Memory"
                desc="sliding window buffer"
                detail="Holds the last 10 turns verbatim. Always injected at the top of the prompt. Zero latency — no retrieval needed."
              />
              <TierCard
                color="var(--episodic)"
                name="Episodic Memory"
                desc="vector store with decay"
                detail="Stores summaries of past turns scored by importance (0–1). Uses exponential decay (λ=0.05) so old, unreferenced memories fade. Retrieved via cosine similarity search in ChromaDB or Qdrant. Top-5 episodes are injected into the prompt."
              />
              <TierCard
                color="var(--kg)"
                name="Knowledge Graph"
                desc="entity graph with Hebbian weights"
                detail="Extracts named entities and relationships from every turn using structured LLM output. Edge weights increase when relationships are re-observed (Hebbian reinforcement) and decay when not referenced. Multi-seed queries use Personalized PageRank (HippoRAG) traversal capped at 12 nodes."
              />
              <Sub title="Context injection order">
                <P>The final prompt seen by the conversational LLM is assembled as:</P>
                <Block>{`[System prompt]
[KG subgraph — relevant entities & edges]
[Top-5 episodic memories — scored by importance × relevance]
[Last 10 working turns — verbatim]
[Current user message]`}</Block>
              </Sub>
              <Sub title="Importance scoring">
                <P>
                  When a turn is written to episodic memory, the KG agent returns a fused importance score (0–1)
                  based on how many new entities were extracted and how central they are in the graph.
                  Only turns scoring above <Code>0.4</Code> are persisted. Configurable via{' '}
                  <Code>EPISODIC_IMPORTANCE_THRESHOLD</Code>.
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
                  After you send, four agent step indicators animate across the top.
                </P>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { step: 'EP',  color: 'var(--episodic)', desc: 'Episodic retrieval — fetching relevant past memories' },
                    { step: 'KG',  color: 'var(--kg)',       desc: 'Graph traversal — finding related entities and edges' },
                    { step: 'MRG', color: 'var(--working)',  desc: 'Context merge — assembling the ranked prompt block' },
                    { step: 'CNV', color: 'var(--fg-2)',     desc: 'Conversation — LLM generates the response' },
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
              </Sub>
              <Sub title="Memory mode vs Question mode">
                <P>The mode toggle in the input bar controls whether this turn is written to memory:</P>
                <Row label="memory (default)">
                  The turn is processed normally — entities extracted, episode scored and stored, KG updated.
                  Use this for conversations you want remembered.
                </Row>
                <Row label="question">
                  The LLM still retrieves from memory to answer, but this turn is <em>not</em> written back.
                  Use for one-off queries that shouldn't pollute the memory store. Retrieval quality metrics
                  are still recorded in the Eval Dashboard.
                </Row>
              </Sub>
              <Sub title="Context chips">
                <P>
                  Below each bot response you'll see coloured context chips showing which episodes and KG nodes
                  were retrieved. Click any chip to open the Inspector drawer with full details.
                </P>
              </Sub>
              <Sub title="Clearing conversation">
                <P>
                  The trash icon clears the displayed chat history only — it does <em>not</em> clear stored episodic
                  memory or the knowledge graph. Use the Memory State panel for that.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── Memory State Panel ── */}
          {(!q || visibleSections.some(s => s.id === 'memory-panel')) && (
            <Section {...sectionProps('memory-panel', 'Memory State Panel')}>
              <P>
                The left panel shows all three memory tiers live. It updates automatically after each turn
                when the <Code>memory_updated</Code> event fires from the backend.
              </P>
              <Sub title="Working Memory tab">
                <P>Shows the last N verbatim turns (default: 10). These are always in the prompt. No decay, no scoring.</P>
              </Sub>
              <Sub title="Episodes tab">
                <P>
                  Each card represents one stored episodic memory. The number on the left is its current
                  importance score after decay. The bar below shows the decay history across the last 5 intervals.
                </P>
                <Row label="importance score">Score (0–1) assigned at write time by the KG agent's fused extraction.</Row>
                <Row label="decay">Score reduces by e<sup>−λt</sup> each decay interval. Memories below 0.05 are pruned.</Row>
                <Row label="entities">Coloured chips show which KG entities this episode is linked to. Click to inspect.</Row>
                <Row label="filter bar">Type any keyword to search episode text in real time.</Row>
              </Sub>
              <Sub title="Entities tab">
                <P>
                  Lists all nodes currently in the knowledge graph with their degree (number of edges) and
                  average edge weight. Click any entity to open its Inspector drawer.
                </P>
              </Sub>
              <Sub title="Reload / Clear">
                <P>
                  The reload icon re-fetches memory state from the backend. The clear icons (per tier) wipe that
                  tier's storage — useful when testing or when the graph has grown stale.
                </P>
              </Sub>
            </Section>
          )}

          {/* ── KG Panel ── */}
          {(!q || visibleSections.some(s => s.id === 'kg-panel')) && (
            <Section {...sectionProps('kg-panel', 'Knowledge Graph Panel')}>
              <P>
                The right panel renders the live knowledge graph as a force-directed layout. Nodes are coloured
                by entity type; edges are weighted by Hebbian reinforcement.
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
                  Edge thickness and opacity reflect the Hebbian weight. A thick, bright edge means the
                  relationship has been mentioned many times. A thin, faded edge may be pruned as its weight decays.
                </P>
              </Sub>
              <Sub title="Interactions">
                <Row label="Click a node">Opens the Inspector drawer with all edges, linked episodes, and metadata.</Row>
                <Row label="Drag a node">Pin it in place. The layout re-stabilises around it.</Row>
                <Row label="Hover a node">Highlights connected edges and dims unrelated nodes.</Row>
                <Row label="Scroll to zoom">Zoom in/out on the graph canvas.</Row>
              </Sub>
              <Sub title="Fullscreen — Question window">
                <P>
                  Click the expand icon to open the graph fullscreen. The right panel becomes a scrollable
                  conversation history — ask questions about your knowledge graph and all Q&A pairs are kept
                  in view. Each answer shows retrieval metadata (episodes used, KG hops, tokens, latency).
                </P>
              </Sub>
              <Note accent="var(--kg)">
                The graph is rebuilt from scratch each time a session is created. If you reload the page your
                session ID persists in <Code>sessionStorage</Code>, so the same graph is loaded on reconnect.
              </Note>
            </Section>
          )}

          {/* ── Providers ── */}
          {(!q || visibleSections.some(s => s.id === 'providers')) && (
            <Section {...sectionProps('providers', 'Providers')}>
              <P>
                MemoryWeave supports three LLM providers, switchable live via the topbar toggle.
                Both the conversational LLM and the extraction LLM use the same provider.
              </P>
              <Sub title="Ollama (local)">
                <P>
                  Runs inference locally. Requires Ollama installed and a model pulled. No API key needed.
                  Default model: <Code>qwen3.5:9b</Code>. Change via <Code>OLLAMA_MODEL</Code> in <Code>.env</Code>.
                </P>
                <Block>{`ollama pull qwen3.5:9b\nollama serve   # starts on localhost:11434`}</Block>
              </Sub>
              <Sub title="HuggingFace Inference API">
                <P>
                  Uses HuggingFace's serverless inference API. Requires an HF API key set in your model
                  config (Settings → Model Setup). Default model: <Code>Qwen/Qwen2.5-7B-Instruct</Code>.
                  Free tier is rate-limited.
                </P>
              </Sub>
              <Sub title="Groq">
                <P>
                  Fast cloud inference. Set <Code>GROQ_API_KEY</Code> in <Code>.env</Code> and select Groq
                  from the provider toggle. Models: <Code>llama-3.3-70b-versatile</Code> (default),
                  swappable via <Code>GROQ_MODEL</Code>.
                </P>
              </Sub>
              <Note>
                The provider toggle only affects the conversational and extraction LLMs. Embeddings always use
                FastEmbed's <Code>BAAI/bge-small-en-v1.5</Code> locally — no API call, no cost.
              </Note>
            </Section>
          )}

          {/* ── Evals ── */}
          {(!q || visibleSections.some(s => s.id === 'evals')) && (
            <Section {...sectionProps('evals', 'Eval Dashboard')}>
              <P>
                The Evals tab shows live quality metrics for your session measured by an automated judge
                pipeline that fires after every turn.
              </P>
              <Sub title="Memory Eval metrics">
                <Row label="token efficiency"><Code>1 − (system_tokens / naive_tokens)</Code>. Measures how much smaller MemoryWeave's prompt is vs a naive full-history approach. Higher is better.</Row>
                <Row label="judge score">Score (0–1) from the LLM judge assessing context quality. Falls back to a heuristic scorer if the circuit-breaker trips.</Row>
                <Row label="KG contribution rate">Fraction of turns where the knowledge graph contributed at least one node. Tracks how often the graph is actually useful.</Row>
                <Row label="latency">End-to-end response time in milliseconds.</Row>
              </Sub>
              <Sub title="Retrieval Quality metrics (RAGAS)">
                <P>
                  When you use the Question window, a second evaluation runs automatically using RAGAS-inspired
                  metrics (Es et al. 2023):
                </P>
                <Row label="context relevance">Are the retrieved KG nodes and episodes actually useful for answering the query?</Row>
                <Row label="faithfulness">Does the answer stay within the retrieved context, or does it hallucinate facts?</Row>
                <Row label="answer relevance">Does the answer directly address what was asked?</Row>
                <Row label="KG seed hit rate">Fraction of queries that successfully triggered KG traversal (seed node found).</Row>
              </Sub>
              <Sub title="Judge circuit breaker">
                <P>
                  If the LLM judge fails or times out 3 consecutive times, it disables itself and falls back
                  to a heuristic scorer (keyword overlap + response length). It auto-resets after 5 minutes.
                </P>
              </Sub>
              <Note accent="var(--episodic)">
                Eval metrics are written to Postgres per session. Query them directly via the Postgres
                connection string in <Code>.env</Code> for offline analysis.
              </Note>
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
              <Sub title="Testing memory recall">
                <P>After a few turns, ask cross-turn questions that require both episodic and KG retrieval:</P>
                <Block>{`"How are Sarah Chen and Lena Fischer connected?"
"What advice did I receive about my KG implementation?"
"Who in my network could refer me to Mistral?"`}</Block>
              </Sub>
              <Sub title="Use question mode for queries">
                <P>
                  Switch to <Code>question</Code> mode when you want to query your memory without polluting it.
                  Good for: checking what the agent knows, debugging retrieval, or one-off lookups.
                  Retrieval quality is still evaluated in the Evals tab.
                </P>
              </Sub>
              <Sub title="Session persistence">
                <P>
                  Your session ID lives in <Code>sessionStorage</Code> under the key <Code>mw.session</Code>.
                  It persists across page refreshes but not across tabs or devices. To continue a session
                  elsewhere, copy the ID from DevTools and set it manually.
                </P>
              </Sub>
              <Sub title="Watching the trace in LangSmith">
                <P>
                  Every agent run is traced automatically if <Code>LANGSMITH_TRACING=true</Code> is set.
                  Visit <Code>smith.langchain.com</Code> → project <Code>memory-weave</Code> to see the
                  full waterfall — agent latencies, token counts, LLM inputs/outputs, and retrieval scores per turn.
                </P>
              </Sub>
            </Section>
          )}

        </div>
      </main>
    </div>
  );
}
