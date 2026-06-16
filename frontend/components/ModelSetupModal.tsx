"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Provider = "groq" | "ollama" | "huggingface";
type CatalogEntry = { id: string; label: string };
type Catalog = { chat: CatalogEntry[]; embedding: CatalogEntry[]; judge: CatalogEntry[] };

/* ── provider metadata ─────────────────────────────────────────── */
const PROVIDERS: {
  id: Provider;
  name: string;
  tag: string;
  description: string;
  color: string;
  keyUrl: string | null;
  keyLabel: string | null;
  keyPlaceholder: string | null;
  keyHint: string | null;
  icon: React.ReactNode;
}[] = [
  {
    id: "groq",
    name: "Groq",
    tag: "Fastest inference",
    description: "LPU-powered inference. Sub-100ms responses on Llama & Mixtral.",
    color: "#2dd4bf",
    keyUrl: "https://console.groq.com/keys",
    keyLabel: "Groq API Key",
    keyPlaceholder: "gsk_••••••••••••••••••••••••••••••••••••••••••••••••••••••••",
    keyHint: "console.groq.com/keys",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#2dd4bf" strokeWidth="1.5" />
        <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#2dd4bf" fontWeight="700">GQ</text>
      </svg>
    ),
  },
  {
    id: "ollama",
    name: "Ollama",
    tag: "No key needed",
    description: "Run models locally. Full privacy, no API costs. Needs Ollama running.",
    color: "#a78bfa",
    keyUrl: null,
    keyLabel: null,
    keyPlaceholder: null,
    keyHint: null,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="1.5" />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fill="#a78bfa" fontWeight="700">OL</text>
      </svg>
    ),
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    tag: "Open models",
    description: "Access thousands of open-source models via HuggingFace Inference API.",
    color: "#f59e0b",
    keyUrl: "https://huggingface.co/settings/tokens",
    keyLabel: "HuggingFace Access Token",
    keyPlaceholder: "hf_••••••••••••••••••••••••••••••••••••••",
    keyHint: "huggingface.co/settings/tokens",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="700">HF</text>
      </svg>
    ),
  },
];

/* ── step indicator ─────────────────────────────────────────────── */
function StepBar({ step, total, skip }: { step: number; total: number; skip?: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => {
        const skipped = i === skip;
        const done = i < step;
        const active = i === step;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              visibility: skipped ? "hidden" : "visible",
              background: done
                ? "#2dd4bf"
                : active
                ? "rgba(45,212,191,0.4)"
                : "rgba(255,255,255,0.08)",
              transition: "background 300ms ease",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── main component ─────────────────────────────────────────────── */
export default function ModelSetupModal() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=provider, 1=key, 2=models
  const [provider, setProvider] = useState<Provider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [chatModel, setChatModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;
  const needsKey = provider !== "ollama";

  useEffect(() => {
    fetch(`${apiUrl}/api/models/catalog`)
      .then((r) => r.json())
      .then((data: Catalog) => {
        setCatalog(data);
        setChatModel(data.chat[0]?.id ?? "");
        setEmbeddingModel(data.embedding[0]?.id ?? "");
        setJudgeModel(data.judge[0]?.id ?? "");
      });
  }, [apiUrl]);

  function handleProviderNext() {
    setError("");
    setApiKey("");
    if (provider === "ollama") {
      setStep(2); // skip key step
    } else {
      setStep(1);
    }
  }

  function handleKeyNext() {
    if (!apiKey.trim()) {
      setError("Please enter your API key to continue.");
      return;
    }
    setError("");
    setStep(2);
  }

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
        hf_api_key: needsKey ? apiKey.trim() : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.detail ?? "Failed to save config");
      return;
    }
    router.push("/dashboard");
  }

  async function handleSkip() {
    await fetch(`${apiUrl}/api/user/model-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider: "ollama" }),
    });
    router.push("/dashboard");
  }

  const totalSteps = needsKey ? 3 : 2;

  return (
    <div style={{
      background: "rgba(13,17,23,0.95)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "32px 28px",
      width: "100%",
      maxWidth: 460,
      display: "flex",
      flexDirection: "column",
      gap: 0,
      boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
    }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
          color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: 700,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="hdr-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2dd4bf" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#hdr-g)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" stroke="url(#hdr-g)" strokeWidth="1" />
            <circle cx="12" cy="12" r="2" fill="url(#hdr-g)" />
          </svg>
          Set up MemoryWeave
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
          {step === 0 && "Choose how you want to run the AI models."}
          {step === 1 && `Connect your ${selectedProvider.name} account.`}
          {step === 2 && "Choose the models for each role."}
        </p>
      </div>

      {/* Step bar */}
      <StepBar
        step={step}
        total={3}
        skip={needsKey ? undefined : 1}
      />

      {/* ── Step 0: Provider selection ── */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 260 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                border: provider === p.id
                  ? `1.5px solid ${p.color}`
                  : "1.5px solid rgba(255,255,255,0.07)",
                background: provider === p.id
                  ? `${p.color}0f`
                  : "rgba(255,255,255,0.02)",
                transition: "all 180ms ease",
                textAlign: "left",
              }}
            >
              {p.icon}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{
                    color: provider === p.id ? p.color : "rgba(255,255,255,0.75)",
                    fontSize: 14, fontWeight: 600,
                  }}>{p.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px",
                    borderRadius: 4, fontFamily: "monospace",
                    background: `${p.color}18`,
                    color: p.color, border: `1px solid ${p.color}30`,
                  }}>{p.tag}</span>
                </div>
                <p style={{
                  color: "rgba(255,255,255,0.35)", fontSize: 11,
                  margin: "2px 0 0", lineHeight: 1.4,
                }}>{p.description}</p>
              </div>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: provider === p.id
                  ? `5px solid ${p.color}`
                  : "1.5px solid rgba(255,255,255,0.15)",
                flexShrink: 0, transition: "all 180ms ease",
              }} />
            </button>
          ))}

          <button
            onClick={handleProviderNext}
            style={{
              marginTop: 8, padding: "11px 0", borderRadius: 8,
              background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.3)",
              color: "#2dd4bf", fontSize: 14, fontWeight: 600, cursor: "pointer",
              transition: "all 180ms ease",
            }}
          >
            Continue →
          </button>

          <button
            onClick={handleSkip}
            style={{
              padding: "8px 0", borderRadius: 8, background: "none",
              border: "none", color: "rgba(255,255,255,0.2)",
              fontSize: 12, cursor: "pointer",
            }}
          >
            Skip — use Ollama defaults
          </button>
        </div>
      )}

      {/* ── Step 1: API key entry ── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 260 }}>

          {/* Get key callout */}
          <div style={{
            background: `${selectedProvider.color}08`,
            border: `1px solid ${selectedProvider.color}25`,
            borderRadius: 10, padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedProvider.icon}
              <span style={{
                color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600,
              }}>
                Get your {selectedProvider.name} API key
              </span>
            </div>
            <p style={{
              color: "rgba(255,255,255,0.4)", fontSize: 12,
              margin: 0, lineHeight: 1.5,
            }}>
              {provider === "groq"
                ? "Create a free Groq account and generate an API key from the console. No credit card required."
                : "Create a HuggingFace account and generate a read-access token from your settings page."}
            </p>
            <a
              href={selectedProvider.keyUrl!}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 7,
                background: `${selectedProvider.color}15`,
                border: `1px solid ${selectedProvider.color}40`,
                color: selectedProvider.color,
                fontSize: 12, fontWeight: 600, textDecoration: "none",
                fontFamily: "monospace", letterSpacing: "0.01em",
                transition: "all 180ms ease",
                alignSelf: "flex-start",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              {selectedProvider.keyHint}
            </a>
          </div>

          {/* Key input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{
              color: "rgba(255,255,255,0.5)", fontSize: 11,
              fontWeight: 600, letterSpacing: "0.06em", fontFamily: "monospace",
            }}>
              {selectedProvider.keyLabel?.toUpperCase()}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                placeholder={selectedProvider.keyPlaceholder!}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(""); }}
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)",
                  border: apiKey
                    ? `1px solid ${selectedProvider.color}50`
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "10px 40px 10px 12px",
                  color: "rgba(255,255,255,0.85)", fontSize: 12,
                  fontFamily: "monospace", outline: "none",
                  transition: "border-color 180ms ease",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)", background: "none",
                  border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.25)", padding: 0,
                }}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {apiKey && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                color: `${selectedProvider.color}99`, fontSize: 10,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Key entered — it will be stored securely server-side
              </div>
            )}
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setStep(0); setError(""); }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleKeyNext}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 8,
                background: apiKey
                  ? `${selectedProvider.color}18`
                  : "rgba(255,255,255,0.04)",
                border: apiKey
                  ? `1px solid ${selectedProvider.color}40`
                  : "1px solid rgba(255,255,255,0.08)",
                color: apiKey ? selectedProvider.color : "rgba(255,255,255,0.25)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 180ms ease",
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Model selection ── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 260 }}>
          {!catalog ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading models…</p>
          ) : (
            <>
              {(["chat", "embedding", "judge"] as const).map((role) => (
                <div key={role} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{
                    color: "rgba(255,255,255,0.4)", fontSize: 11,
                    fontWeight: 600, letterSpacing: "0.06em", fontFamily: "monospace",
                  }}>
                    {role.toUpperCase()} MODEL
                  </label>
                  <select
                    value={role === "chat" ? chatModel : role === "embedding" ? embeddingModel : judgeModel}
                    onChange={(e) => {
                      if (role === "chat") setChatModel(e.target.value);
                      else if (role === "embedding") setEmbeddingModel(e.target.value);
                      else setJudgeModel(e.target.value);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, padding: "9px 12px",
                      color: "rgba(255,255,255,0.8)", fontSize: 12,
                      fontFamily: "monospace", outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {catalog[role].map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              ))}

              {error && (
                <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{error}</p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => { setStep(needsKey ? 1 : 0); setError(""); }}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2, padding: "10px 0", borderRadius: 8,
                    background: saving ? "rgba(45,212,191,0.06)" : "rgba(45,212,191,0.12)",
                    border: "1px solid rgba(45,212,191,0.3)",
                    color: saving ? "rgba(45,212,191,0.4)" : "#2dd4bf",
                    fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                    transition: "all 180ms ease",
                  }}
                >
                  {saving ? "Saving…" : "Launch MemoryWeave →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
