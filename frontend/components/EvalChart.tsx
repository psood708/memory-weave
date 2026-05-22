'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Turn = {
  turn_number: number;
  system_tokens: number;
  naive_tokens: number;
  token_efficiency: number;
  judge_score: number | null;
  kg_contributed: boolean;
};

interface Props {
  turns: Turn[];
  hoveredTurn?: number | null;
  onHover?: (turn: number | null) => void;
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-3)',
    border: '1px solid var(--line-2)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
  },
  labelStyle: { color: 'var(--fg-3)', marginBottom: 4 },
  itemStyle: { color: 'var(--fg-1)' },
  cursor: { stroke: 'var(--line-3)' },
};

const axisProps = {
  tick: { fill: 'var(--fg-4)', fontSize: 10, fontFamily: 'var(--font-mono)' },
  axisLine: false as const,
  tickLine: false as const,
};

export default function EvalChart({ turns, onHover }: Props) {
  const data = [...turns]
    .sort((a, b) => a.turn_number - b.turn_number)
    .map(t => ({
      turn: t.turn_number,
      'MW tokens': t.system_tokens,
      Naive: t.naive_tokens,
      'Judge %': t.judge_score != null ? Math.round(t.judge_score * 100) : null,
    }));

  const handleMouseMove = (state: any) => {
    if (state?.isTooltipActive && state.activePayload?.[0]) {
      onHover?.(state.activePayload[0].payload.turn as number);
    }
  };
  const handleMouseLeave = () => onHover?.(null);

  const activeDot = (color: string) => ({ r: 5, fill: color, stroke: 'var(--bg-0)', strokeWidth: 2 });

  return (
    <>
      <div className="chart-card">
        <div className="chart-head">
          <div>
            <h3>Token usage per turn</h3>
            <div className="sub">MemoryWeave vs naive rolling buffer</div>
          </div>
          <div className="legend">
            <span><span className="sw" style={{ background: 'var(--kg)' }} />MW</span>
            <span><span className="sw" style={{ background: 'var(--fg-4)' }} />Naive</span>
          </div>
        </div>
        <div className="chart-area" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <XAxis dataKey="turn" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="MW tokens" stroke="var(--kg)" dot={false} strokeWidth={2} activeDot={activeDot('var(--kg)')} />
              <Line type="monotone" dataKey="Naive" stroke="var(--fg-3)" dot={false} strokeWidth={1.5} strokeDasharray="4 4" activeDot={activeDot('var(--fg-3)')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-head">
          <div>
            <h3>Judge score per turn</h3>
            <div className="sub">Heuristic quality estimate (0 – 100%)</div>
          </div>
        </div>
        <div className="chart-area" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <XAxis dataKey="turn" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="Judge %" stroke="var(--ok)" dot={false} strokeWidth={2} activeDot={activeDot('var(--ok)')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
