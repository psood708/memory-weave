'use client';

interface LandingPageProps {
  onEnter: (view: 'dashboard' | 'evals') => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2.5rem',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          color: 'var(--kg)',
          textTransform: 'uppercase',
          marginBottom: '1rem',
          opacity: 0.8,
        }}>Context Engineering · v0.4</div>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          fontWeight: 400,
          color: 'var(--fg-0)',
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>MemoryWeave</h1>
        <p style={{
          color: 'var(--fg-3)',
          fontSize: '1rem',
          marginTop: '1rem',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}>
          A conversational agent with biologically-inspired three-tier memory — working, episodic, and knowledge graph. Remembers what matters.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => onEnter('dashboard')}
          style={{
            background: 'var(--kg)',
            color: '#07090d',
            border: 'none',
            borderRadius: 'var(--r-md)',
            padding: '0.75rem 2rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Open Dashboard
        </button>
        <button
          onClick={() => onEnter('evals')}
          style={{
            background: 'transparent',
            color: 'var(--fg-1)',
            border: '1px solid var(--line-3)',
            borderRadius: 'var(--r-md)',
            padding: '0.75rem 2rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          View Evals
        </button>
      </div>

      <div style={{
        display: 'flex', gap: '2rem',
        color: 'var(--fg-4)', fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
      }}>
        <span><span style={{ color: 'var(--working)' }}>■</span> Working</span>
        <span><span style={{ color: 'var(--episodic)' }}>■</span> Episodic</span>
        <span><span style={{ color: 'var(--kg)' }}>■</span> Knowledge Graph</span>
      </div>
    </div>
  );
}
