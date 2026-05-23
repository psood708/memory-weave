'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import EvalChart from './EvalChart';
import { Icon } from './Icon';
import type { MemoryState } from '@/lib/api';

type Summary = {
  turn_count: number;
  avg_token_efficiency: number;
  kg_contribution_rate: number;
  avg_judge_score: number | null;
};

type Turn = {
  turn_number: number;
  system_tokens: number;
  naive_tokens: number;
  token_efficiency: number;
  judge_score: number | null;
  kg_contributed: boolean;
  kg_cosine_distance: number | null;
  retrieval_latency_ms: number | null;
  total_latency_ms: number | null;
};

type Health = { judge_status: 'active' | 'circuit_open'; queue_depth: number };

interface Props {
  sessionId: string;
  memoryState?: MemoryState | null;
}

function effClass(v: number) {
  if (v >= 0.5) return 'eval-eff--high';
  if (v >= 0.3) return 'eval-eff--mid';
  return 'eval-eff--low';
}

function judgeColor(v: number) {
  if (v >= 0.7) return 'var(--ok)';
  if (v >= 0.5) return 'var(--warn)';
  return 'var(--danger)';
}

export default function EvalDashboard({ sessionId, memoryState }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  const load = useCallback(() => {
    fetch(`${apiUrl}/eval/metrics?session_id=${sessionId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setTurns(d.turns); })
      .catch(() => {});
    fetch(`${apiUrl}/eval/health`, { credentials: 'include' })
      .then(r => r.json())
      .then(setHealth)
      .catch(() => {});
  }, [sessionId, apiUrl]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const budget = memoryState?.budget;
  const budgetUsed = budget?.used ?? 0;
  const segments = budget?.segments ?? [];

  const sortedTurns = [...turns].sort((a, b) => a.turn_number - b.turn_number);

  const kpis = [
    {
      label: 'Token efficiency',
      value: summary ? (summary.avg_token_efficiency * 100).toFixed(1) : '—',
      unit: summary ? '%' : '',
      sub: 'avg vs naive buffer',
    },
    {
      label: 'KG contribution',
      value: summary ? (summary.kg_contribution_rate * 100).toFixed(1) : '—',
      unit: summary ? '%' : '',
      sub: 'turns with KG context',
    },
    {
      label: 'Judge score',
      value: summary?.avg_judge_score != null ? (summary.avg_judge_score * 100).toFixed(0) : '—',
      unit: summary?.avg_judge_score != null ? '%' : '',
      sub: 'avg heuristic quality',
    },
    {
      label: 'Turns recorded',
      value: summary ? String(summary.turn_count) : '—',
      unit: '',
      sub: 'this session',
    },
  ];

  return (
    <div className="eval-page">
      <div className="eval-page-inner">

        {/* ── Header ── */}
        <div className="eval-ph">
          <div>
            <h2>Eval Dashboard</h2>
            <div className="eval-ph-sub">session · {sessionId.slice(-8)}</div>
          </div>
          <div className="eval-ph-right">
            {health && (
              <span className={`judge-badge ${health.judge_status === 'active' ? 'judge-badge--active' : 'judge-badge--open'}`}>
                ● Judge {health.judge_status === 'active' ? 'active' : 'circuit open'}
              </span>
            )}
            <button className="icon-btn" data-tooltip="Refresh metrics" onClick={load}>
              <Icon name="refresh" size={13} />
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="eval-kpis">
          {kpis.map(k => (
            <div className="eval-kpi" key={k.label}>
              <div className="eval-kpi-label">{k.label}</div>
              <div className="eval-kpi-value">
                {k.value}
                {k.unit && <span className="unit">{k.unit}</span>}
              </div>
              <div className="eval-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Charts (2 columns) ── */}
        {sortedTurns.length > 0 ? (
          <div className="eval-charts">
            <EvalChart turns={turns} hoveredTurn={hoveredTurn} onHover={setHoveredTurn} />
          </div>
        ) : (
          <div className="eval-section">
            <div className="eval-empty">
              <p>No eval data yet — send a few messages to start recording metrics.</p>
            </div>
          </div>
        )}

        {/* ── Per-turn breakdown table ── */}
        {sortedTurns.length > 0 && (
          <div className="eval-section">
            <div className="eval-section-head">
              <span>Per-turn breakdown</span>
              <span style={{ fontWeight: 400, color: 'var(--fg-4)', textTransform: 'none', letterSpacing: 0 }}>
                {sortedTurns.length} turns · click row to expand
              </span>
            </div>
            <table className="eval-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>MW tokens</th>
                  <th>Naive</th>
                  <th>Efficiency</th>
                  <th>Judge</th>
                  <th>KG</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {sortedTurns.map(t => {
                  const isHovered = hoveredTurn === t.turn_number;
                  const isExpanded = expandedTurn === t.turn_number;
                  return (
                    <Fragment key={t.turn_number}>
                      <tr
                        className={isExpanded ? 'expanded' : isHovered ? 'hovered' : ''}
                        onMouseEnter={() => setHoveredTurn(t.turn_number)}
                        onMouseLeave={() => setHoveredTurn(null)}
                        onClick={() => setExpandedTurn(isExpanded ? null : t.turn_number)}
                      >
                        <td style={{ color: 'var(--fg-3)' }}>t{t.turn_number}</td>
                        <td style={{ color: 'var(--fg-0)' }}>{t.system_tokens.toLocaleString()}</td>
                        <td style={{ color: 'var(--fg-4)' }}>{t.naive_tokens.toLocaleString()}</td>
                        <td>
                          <span className={`eval-eff ${effClass(t.token_efficiency)}`}>
                            {(t.token_efficiency * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          {t.judge_score != null
                            ? <span style={{ color: judgeColor(t.judge_score) }}>{(t.judge_score * 100).toFixed(0)}%</span>
                            : <span style={{ color: 'var(--fg-4)' }}>—</span>
                          }
                        </td>
                        <td>
                          <span
                            className={`eval-kg-dot ${t.kg_contributed ? 'eval-kg-dot--yes' : 'eval-kg-dot--no'}`}
                            title={t.kg_contributed ? 'KG context used' : 'KG not used'}
                          />
                        </td>
                        <td style={{ color: 'var(--fg-3)' }}>
                          {t.total_latency_ms != null ? `${(t.total_latency_ms / 1000).toFixed(2)}s` : '—'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--line-1)' }}>
                            <div className="erd-inner">
                              {[
                                { label: 'System tokens', value: t.system_tokens.toLocaleString() },
                                { label: 'Naive buffer', value: t.naive_tokens.toLocaleString() },
                                { label: 'Token efficiency', value: `${(t.token_efficiency * 100).toFixed(1)}%` },
                                { label: 'Judge score', value: t.judge_score != null ? `${(t.judge_score * 100).toFixed(0)}%` : '—' },
                                { label: 'KG cosine dist', value: t.kg_cosine_distance != null ? t.kg_cosine_distance.toFixed(4) : '—' },
                                { label: 'Retrieval ms', value: t.retrieval_latency_ms != null ? `${t.retrieval_latency_ms}ms` : '—' },
                                { label: 'Total latency', value: t.total_latency_ms != null ? `${t.total_latency_ms}ms` : '—' },
                                { label: 'KG used', value: t.kg_contributed ? 'Yes' : 'No' },
                              ].map(item => (
                                <div className="erd-item" key={item.label}>
                                  <div className="erd-label">{item.label}</div>
                                  <div className="erd-value">{item.value}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Context tier contribution ── */}
        {budget && budgetUsed > 0 && (
          <div className="eval-section">
            <div className="eval-section-head">Context tier contribution</div>
            <div style={{ padding: '14px 16px 18px' }}>
              <div className="eval-tier-bar">
                {segments.map(seg => {
                  const pct = Math.round((seg.tokens / budgetUsed) * 100);
                  return (
                    <div
                      key={seg.tier}
                      className={`eval-tier-seg ${seg.tier}`}
                      style={{ flex: pct }}
                      title={`${seg.tier}: ${pct}% · ${seg.tokens.toLocaleString()} tokens`}
                    >
                      {pct >= 12 ? `${seg.tier} · ${pct}%` : ''}
                    </div>
                  );
                })}
              </div>
              <div className="eval-tier-meta">
                {segments.map(seg => {
                  const pct = Math.round((seg.tokens / budgetUsed) * 100);
                  const color = seg.tier === 'working' ? 'var(--working)' : seg.tier === 'episodic' ? 'var(--episodic)' : 'var(--kg)';
                  return (
                    <div className="eval-tier-meta-item" key={seg.tier}>
                      <span className="eval-tier-dot" style={{ background: color }} />
                      <span style={{ color: 'var(--fg-3)', textTransform: 'capitalize' }}>{seg.tier}</span>
                      <span>{pct}% · {seg.tokens.toLocaleString()} tok</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
