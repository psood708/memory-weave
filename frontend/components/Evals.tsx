'use client';
import { Icon } from './Icon';

interface LineSeries { values: number[]; color: string; name: string }

function LineChart({
  series, labels, height = 220, yMax = 1,
}: { series: LineSeries[]; labels: string[]; height?: number; yMax?: number }) {
  const w = 760, h = height, pad = { l: 36, r: 16, t: 14, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const stepX = innerW / (labels.length - 1);

  const pathFor = (pts: number[]) =>
    pts.map((v, i) => {
      const x = pad.l + i * stepX;
      const y = pad.t + innerH - (v / yMax) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const areaFor = (pts: number[]) => {
    const p = pathFor(pts);
    const lastX = pad.l + (pts.length - 1) * stepX;
    return `${p} L ${lastX} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z`;
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`ev-g-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pad.t + innerH - p * innerH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l + innerW} y2={y} stroke="rgba(255,255,255,0.04)" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="var(--fg-4)" style={{ font: '500 9.5px/1 var(--font-mono)' }}>
              {(p * yMax).toFixed(p === 1 ? 0 : 2).replace(/^0\./, '.')}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={pad.l + i * stepX} y={h - 6} textAnchor="middle" fill="var(--fg-4)" style={{ font: '500 9.5px/1 var(--font-mono)' }}>
          {l}
        </text>
      ))}
      {series.map((s, i) => (
        <g key={i}>
          <path d={areaFor(s.values)} fill={`url(#ev-g-${i})`} />
          <path d={pathFor(s.values)} stroke={s.color} strokeWidth="1.6" fill="none" />
          {s.values.map((v, j) => {
            const x = pad.l + j * stepX;
            const y = pad.t + innerH - (v / yMax) * innerH;
            return <circle key={j} cx={x} cy={y} r={j === s.values.length - 1 ? 3 : 0} fill={s.color} />;
          })}
        </g>
      ))}
    </svg>
  );
}

function BarChart({
  data, height = 220, max = 1,
}: { data: { label: string; a: number; b: number }[]; height?: number; max?: number }) {
  const w = 380, h = height, pad = { l: 28, r: 10, t: 14, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const groupW = innerW / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 0.5, 1].map((p, i) => {
        const y = pad.t + innerH - p * innerH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l + innerW} y2={y} stroke="rgba(255,255,255,0.04)" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="var(--fg-4)" style={{ font: '500 9.5px/1 var(--font-mono)' }}>
              {(p * max).toFixed(p === 0.5 ? 1 : 0)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + i * groupW + groupW * 0.18;
        const bw = groupW * 0.32;
        const yA = pad.t + innerH - (d.a / max) * innerH;
        const yB = pad.t + innerH - (d.b / max) * innerH;
        return (
          <g key={i}>
            <rect x={x} y={yA} width={bw} height={pad.t + innerH - yA} rx="2" fill="var(--kg)" />
            <rect x={x + bw + 4} y={yB} width={bw} height={pad.t + innerH - yB} rx="2" fill="var(--working)" />
            <text x={pad.l + i * groupW + groupW / 2} y={h - 10} textAnchor="middle" fill="var(--fg-4)" style={{ font: '500 9.5px/1 var(--font-mono)' }}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Evals() {
  const sessLabels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
  const accuracy: LineSeries = {
    values: [0.62, 0.68, 0.71, 0.74, 0.79, 0.83, 0.86, 0.88, 0.91, 0.93],
    color: 'var(--kg)', name: 'MemoryWeave',
  };
  const baseline: LineSeries = {
    values: [0.58, 0.59, 0.60, 0.58, 0.61, 0.62, 0.60, 0.63, 0.62, 0.64],
    color: 'var(--fg-3)', name: 'Baseline (window-only)',
  };
  const efficiencyData = [
    { label: '1', a: 1240, b: 1980 },
    { label: '5', a: 980,  b: 2030 },
    { label: '10', a: 870, b: 2100 },
    { label: '25', a: 820, b: 2180 },
    { label: '50', a: 790, b: 2240 },
    { label: '100', a: 770, b: 2310 },
  ];

  return (
    <div className="evals">
      <div className="evals-inner">
        <h1>Evaluation overview</h1>
        <p className="sub">
          A snapshot of how MemoryWeave's three‑tier memory compares to a standard fixed‑window baseline across a controlled benchmark of long‑horizon conversations.
        </p>

        <div className="eval-row1">
          <div className="kpi">
            <div className="k">Retrieval accuracy</div>
            <div className="v">93<span className="u">%</span></div>
            <div className="delta"><Icon name="arrow-up" size={11} /> +29 pts vs baseline</div>
          </div>
          <div className="kpi">
            <div className="k">Token efficiency</div>
            <div className="v">2.7<span className="u">× </span></div>
            <div className="delta"><Icon name="arrow-up" size={11} /> fewer tokens / answer</div>
          </div>
          <div className="kpi">
            <div className="k">Recall @ 10 turns</div>
            <div className="v">89<span className="u">%</span></div>
            <div className="delta"><Icon name="arrow-up" size={11} /> +41 pts vs baseline</div>
          </div>
          <div className="kpi">
            <div className="k">Graph contribution</div>
            <div className="v">34<span className="u">%</span></div>
            <div className="delta"><Icon name="arrow-up" size={11} /> of context, top‑weighted</div>
          </div>
        </div>

        <div className="eval-row2">
          <div className="chart-card">
            <div className="chart-head">
              <div>
                <h3>Retrieval accuracy over sessions</h3>
                <div className="sub">% of correct recalls on the long‑horizon test suite, sessions 1–10</div>
              </div>
              <div className="legend">
                <span><span className="sw" style={{ background: 'var(--kg)' }} />MemoryWeave</span>
                <span><span className="sw" style={{ background: 'var(--fg-3)' }} />Baseline</span>
              </div>
            </div>
            <div className="chart-area">
              <LineChart series={[baseline, accuracy]} labels={sessLabels} yMax={1} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <div>
                <h3>Tokens per answer</h3>
                <div className="sub">Bucketed by session depth (turns)</div>
              </div>
              <div className="legend">
                <span><span className="sw" style={{ background: 'var(--kg)' }} />MW</span>
                <span><span className="sw" style={{ background: 'var(--working)' }} />Baseline</span>
              </div>
            </div>
            <div className="chart-area">
              <BarChart data={efficiencyData} max={2500} />
            </div>
          </div>
        </div>

        <div className="eval-row3">
          <div className="chart-card">
            <div className="chart-head">
              <div>
                <h3>Context contribution by tier</h3>
                <div className="sub">Average % of context tokens supplied by each memory tier</div>
              </div>
            </div>
            <div className="contrib-bar">
              <div className="seg working" style={{ flex: 36 }}>working · 36%</div>
              <div className="seg episodic" style={{ flex: 49 }}>episodic · 49%</div>
              <div className="seg kg" style={{ flex: 15 }}>kg · 15%</div>
            </div>
            <div style={{ font: '500 11.5px/1.5 var(--font-mono)', color: 'var(--fg-2)', marginTop: 8 }}>
              The graph tier contributes a small share of tokens but a disproportionate share of correct retrievals — punching ~2.3× above its weight.
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <div>
                <h3>Head‑to‑head on long‑horizon tasks</h3>
                <div className="sub">Win rate vs. baseline across 5 evaluation rubrics</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {[
                { lbl: 'Multi-turn factual recall', a: 0.92, b: 0.51 },
                { lbl: 'Pronoun & coref resolution', a: 0.88, b: 0.62 },
                { lbl: 'Decision continuity', a: 0.83, b: 0.44 },
                { lbl: 'Entity tracking', a: 0.95, b: 0.58 },
                { lbl: 'Causal chain across days', a: 0.79, b: 0.31 },
              ].map((r, i) => (
                <div className="compare-row" key={i}>
                  <div className="lbl">{r.lbl}</div>
                  <div className="vs">vs</div>
                  <div className="bars">
                    <div className="bar mw">
                      <div className="fill" style={{ width: `${r.a * 100}%` }} />
                      <span className="lbl-r">{Math.round(r.a * 100)}%</span>
                    </div>
                    <div className="bar base">
                      <div className="fill" style={{ width: `${r.b * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
