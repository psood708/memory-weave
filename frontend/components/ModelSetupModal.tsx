"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type CatalogEntry = { id: string; label: string };
type Catalog = { chat: CatalogEntry[]; embedding: CatalogEntry[]; judge: CatalogEntry[] };

export default function ModelSetupModal() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [provider, setProvider] = useState<"ollama" | "huggingface">("huggingface");
  const [hfKey, setHfKey] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${apiUrl}/api/models/catalog`)
      .then((r) => r.json())
      .then((data) => {
        setCatalog(data);
        setChatModel(data.chat[0]?.id ?? "");
        setEmbeddingModel(data.embedding[0]?.id ?? "");
        setJudgeModel(data.judge[0]?.id ?? "");
      });
  }, [apiUrl]);

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`${apiUrl}/api/user/model-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        provider,
        chat_model: chatModel || null,
        embedding_model: embeddingModel || null,
        judge_model: judgeModel || null,
        hf_api_key: provider === "huggingface" ? hfKey : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.detail ?? "Failed to save config");
      return;
    }
    router.push("/");
  }

  async function handleSkip() {
    await fetch(`${apiUrl}/api/user/model-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: "ollama" }),
    });
    router.push("/");
  }

  if (!catalog) return <div className="text-gray-400 text-sm">Loading models…</div>;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md flex flex-col gap-6">
      <div>
        <h2 className="text-white font-semibold text-xl">Set up your models</h2>
        <p className="text-gray-400 text-sm mt-1">Connect HuggingFace to use cloud models, or skip to use local Ollama.</p>
      </div>

      <div className="flex gap-2">
        {(["huggingface", "ollama"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${provider === p ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            {p === "huggingface" ? "HuggingFace" : "Local (Ollama)"}
          </button>
        ))}
      </div>

      {provider === "huggingface" && (
        <div className="flex flex-col gap-1">
          <label className="text-gray-300 text-sm font-medium">HuggingFace API Key</label>
          <input
            type="password"
            placeholder="hf_..."
            value={hfKey}
            onChange={(e) => setHfKey(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {(["chat", "embedding", "judge"] as const).map((role) => (
        <div key={role} className="flex flex-col gap-1">
          <label className="text-gray-300 text-sm font-medium capitalize">{role} model</label>
          <select
            value={role === "chat" ? chatModel : role === "embedding" ? embeddingModel : judgeModel}
            onChange={(e) => {
              if (role === "chat") setChatModel(e.target.value);
              else if (role === "embedding") setEmbeddingModel(e.target.value);
              else setJudgeModel(e.target.value);
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            {catalog[role].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      ))}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSkip}
          className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
        >
          Skip (use Ollama)
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {saving ? "Validating…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}
