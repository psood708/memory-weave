// MemoryWeave — fabricated state for a believable demo. All values illustrative.

export type Role = 'user' | 'bot';

export interface WorkingTurn { role: Role; text: string; }

export interface Episode {
  id: string;
  turn: number;
  hoursAgo: number;
  importance: number;
  decay: number;
  text: string;
  entities: string[];
  history: number[];
}

export type EntityType = 'person' | 'concept' | 'event';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  degree: number;
  weight: number;
  description?: string;
}

export interface Edge { s: string; t: string; rel: string; w: number; }

export type RichSegment = string | { type: 'em' | 'code'; value: string };

export interface ContextItem { id?: string; score: number; text?: string; name?: string; }

export interface MessageMeta { episodes: number; hops: number; tokens: number; latency: number; }

export interface ContextSnapshot {
  episodes: { id: string; score: number; text: string }[];
  nodes: { name: string; score: number }[];
  merge: number;
}

export interface ChatMessage {
  role: Role;
  turn: number;
  text: string | RichSegment[];
  ts: string;
  streaming?: boolean;
  meta?: MessageMeta;
  context?: ContextSnapshot;
}

export interface AgentStep { id: string; label: string; sub: string; }

export interface Budget {
  total: number;
  used: number;
  segments: { tier: 'working' | 'episodic' | 'kg'; tokens: number }[];
}

export const WORKING_TURNS: WorkingTurn[] = [];

export const EPISODES: Episode[] = [];

export const ENTITIES: Entity[] = [];

export const EDGES: Edge[] = [];

export const CONV: ChatMessage[] = [];

export const AGENT_STEPS: AgentStep[] = [
  { id: 'orch', label: 'Orchestrator',         sub: 'route' },
  { id: 'ep',   label: 'Episodic Agent',       sub: 'chromadb · k=3' },
  { id: 'kg',   label: 'KG Agent',             sub: 'networkx · 2 hops' },
  { id: 'mrg',  label: 'Merge / Rank',         sub: 'weighted' },
  { id: 'cnv',  label: 'Conversational Agent', sub: 'gpt-4o · streaming' },
];

export const BUDGET: Budget = {
  total: 2000,
  used: 847,
  segments: [
    { tier: 'working',  tokens: 312 },
    { tier: 'episodic', tokens: 416 },
    { tier: 'kg',       tokens: 119 },
  ],
};
