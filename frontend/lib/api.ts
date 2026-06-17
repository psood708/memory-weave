// API client for MemoryWeave FastAPI backend
const BASE = '/proxy';

export type Provider = 'ollama' | 'groq' | 'custom';

export interface MemoryState {
  working_turns: { role: 'user' | 'bot'; text: string }[];
  episodes: {
    id: string; turn: number; hoursAgo: number; importance: number; decay: number;
    text: string; entities: string[]; history: number[];
  }[];
  entities: {
    id: string; name: string; type: 'person' | 'concept' | 'event';
    degree: number; weight: number;
  }[];
  edges: { s: string; t: string; rel: string; w: number }[];
  budget: {
    total: number; used: number;
    segments: { tier: 'working' | 'episodic' | 'kg'; tokens: number }[];
  };
}

export async function fetchMemoryState(sessionId: string, provider: Provider = 'ollama'): Promise<MemoryState> {
  const res = await fetch(`${BASE}/api/memory?session_id=${sessionId}&provider=${provider}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch memory state');
  return res.json();
}

export async function resetSessions(): Promise<{ cleared: number }> {
  const res = await fetch(`${BASE}/api/sessions/reset`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('Reset failed');
  return res.json();
}

export async function clearMemory(
  sessionId: string,
  provider: string,
  target: 'all' | 'episodic' | 'kg' | 'working',
): Promise<{ cleared: string[] }> {
  const res = await fetch(`${BASE}/api/sessions/clear-memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, provider, target }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Clear failed');
  return res.json();
}

export function streamChat(
  sessionId: string,
  message: string,
  provider: Provider,
  mode: 'memory' | 'question',
  callbacks: {
    onAgentStep: (step: string, status: 'active' | 'done') => void;
    onToken: (text: string) => void;
    onDone: (meta: { episodes: number; hops: number; tokens: number; latency: number }, context: any) => void;
    onMemoryUpdated: () => void;
    onError: (err: Error) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message, provider, mode }),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'agent_step') {
                callbacks.onAgentStep(data.step, data.status);
              } else if (eventType === 'token') {
                callbacks.onToken(data.text);
              } else if (eventType === 'done') {
                callbacks.onDone(data.meta, data.context);
              } else if (eventType === 'memory_updated') {
                callbacks.onMemoryUpdated();
              }
            } catch {}
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') callbacks.onError(err);
    }
  })();

  return () => controller.abort();
}
