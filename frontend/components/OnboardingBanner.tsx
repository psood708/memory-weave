'use client';

const STEPS = [
  { label: 'Model Setup',     hint: 'Configure your provider' },
  { label: 'First Message',   hint: 'Send a message in chat' },
  { label: 'Upload File',     hint: 'Add a doc to memory' },
  { label: 'Knowledge Graph', hint: 'Open the graph panel' },
  { label: 'Run an Eval',     hint: 'Open the Evals tab' },
] as const;

export default function OnboardingBanner({ completedSteps }: { completedSteps: boolean[] }) {
  const doneCount = completedSteps.filter(Boolean).length;
  const activeIdx = completedSteps.findIndex(v => !v);

  return (
    <div className="ob-banner" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={doneCount} aria-label="Onboarding progress">
      <div className="ob-header">
        <span className="ob-label">GET STARTED</span>
        <div className="ob-track">
          {STEPS.map((_, i) => (
            <div key={i} className={`ob-seg${completedSteps[i] ? ' done' : ''}`} />
          ))}
        </div>
        <span className="ob-count">{doneCount} of {STEPS.length} done</span>
      </div>

      <div className="ob-steps">
        {STEPS.map((step, i) => {
          const done = completedSteps[i];
          const active = i === activeIdx;
          return (
            <div key={i} className={`ob-step${done ? ' done' : active ? ' active' : ' locked'}`}>
              <div className="ob-dot">
                {done && <span className="ob-check" aria-hidden="true">✓</span>}
                {active && <span className="ob-pulse" aria-hidden="true" />}
                {!done && !active && <span className="ob-lock" aria-hidden="true">⚿</span>}
              </div>
              <div className="ob-step-body">
                <span className="ob-step-label">{step.label}</span>
                <span className="ob-step-hint">{step.hint}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
