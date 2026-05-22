"use client";
import { useEffect, useState } from "react";
import EvalChart from "./EvalChart";

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
};

type Health = { judge_status: "active" | "circuit_open"; queue_depth: number };

export default function EvalDashboard({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const load = () => {
      fetch(`${apiUrl}/eval/metrics?session_id=${sessionId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => { setSummary(d.summary); setTurns(d.turns); });
      fetch(`${apiUrl}/eval/health`, { credentials: "include" })
        .then((r) => r.json())
        .then(setHealth);
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [sessionId, apiUrl]);

  const judgeColor = health?.judge_status === "active" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-white font-medium text-sm">Eval metrics</span>
        {health && (
          <span className={`${judgeColor} text-white text-xs px-2 py-0.5 rounded-full`}>
            Judge {health.judge_status === "active" ? "active" : "circuit open"}
          </span>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Token efficiency", value: `${(summary.avg_token_efficiency * 100).toFixed(1)}%` },
            { label: "KG contribution", value: `${(summary.kg_contribution_rate * 100).toFixed(1)}%` },
            { label: "Avg judge score", value: summary.avg_judge_score != null ? `${(summary.avg_judge_score * 100).toFixed(0)}%` : "—" },
            { label: "Turns", value: summary.turn_count },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3">
              <p className="text-gray-400 text-xs">{label}</p>
              <p className="text-white font-semibold text-lg">{value}</p>
            </div>
          ))}
        </div>
      )}

      {turns.length > 0 && <EvalChart turns={turns} />}
      {turns.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-8">Start a conversation to see metrics.</p>
      )}
    </div>
  );
}
