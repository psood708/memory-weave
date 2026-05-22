"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Turn = {
  turn_number: number;
  system_tokens: number;
  naive_tokens: number;
  token_efficiency: number;
  judge_score: number | null;
  kg_contributed: boolean;
};

export default function EvalChart({ turns }: { turns: Turn[] }) {
  const data = [...turns].reverse().map((t) => ({
    turn: t.turn_number,
    "System tokens": t.system_tokens,
    "Naive buffer": t.naive_tokens,
    "Judge score": t.judge_score != null ? Math.round(t.judge_score * 100) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-gray-400 text-xs mb-2">Token usage per turn</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <XAxis dataKey="turn" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="System tokens" stroke="#6366f1" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="Naive buffer" stroke="#374151" dot={false} strokeWidth={1} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-gray-400 text-xs mb-2">Retrieval accuracy (judge score %)</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data}>
            <XAxis dataKey="turn" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8 }} />
            <Line type="monotone" dataKey="Judge score" stroke="#10b981" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
