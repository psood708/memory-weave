import json
import re
from pathlib import Path

from langchain_core.messages import HumanMessage
from pydantic import BaseModel, field_validator

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_extraction_llm
from memoryweave.memory.kg_store import KnowledgeGraphStore


def _kg_path_for_user(user_id: str) -> str:
    """Return the KG JSON path for a given user, creating the directory if needed."""
    if not user_id:
        return settings.kg_store_path
    base = Path(settings.kg_store_path).parent.parent / "users" / user_id
    base.mkdir(parents=True, exist_ok=True)
    return str(base / "kg_store.json")


def _parse_llm_json(raw: str) -> dict:
    """Strip Qwen3 <think> blocks and extract the JSON object from LLM output."""
    text = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    return json.loads(match.group(0) if match else text)

_FUSED_PROMPT = """\
Analyze this conversation turn for memory storage.

Turn:
{text}

Return ONLY valid JSON:
{{
  "importance_score": <float 0.0-1.0>,
  "entities": [
    {{"name": "string", "type": "Person|Project|Preference|Fact|Organization|Event", "description": "string"}}
  ],
  "relationships": [
    {{"source": "entity name", "target": "entity name", "rel_type": "string", "weight": 1.0}}
  ]
}}

importance_score rules:
- High (0.7-1.0): specific facts, decisions, names, preferences, project details, commitments
- Low (0.0-0.3): pleasantries, filler, vague statements, repeated context

entity/relationship rules:
- Only types: Person, Project, Preference, Fact, Organization, Event
- Event: use for meetings, deadlines, launches, demos, decisions, milestones, or any time-bound occurrence
- rel_type: works_on, prefers, knows, part_of, uses, has, related_to, scheduled_for, decided_at, attended
- source and target must be names from the entities list above
- If no entities found, use empty lists

Return ONLY the JSON object."""


_TYPE_COERCE: dict[str, str] = {
    "Technology": "Fact",
    "Tool": "Fact",
    "Model": "Fact",
    "Service": "Organization",
    "Component": "Fact",
    "Library": "Fact",
    "Framework": "Fact",
    "Database": "Fact",
    "Platform": "Organization",
    "Concept": "Fact",
    "Language": "Fact",
    "Method": "Fact",
}

_ALLOWED_TYPES = {"Person", "Project", "Preference", "Fact", "Organization", "Event"}


class Entity(BaseModel):
    name: str
    type: str
    description: str

    @field_validator("type", mode="before")
    @classmethod
    def coerce_type(cls, v: str) -> str:
        if v in _ALLOWED_TYPES:
            return v
        return _TYPE_COERCE.get(v, "Fact")


class Relationship(BaseModel):
    source: str
    target: str
    rel_type: str
    weight: float = 1.0


class ExtractionResult(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]


class FusedResult(BaseModel):
    importance_score: float
    entities: list[Entity]
    relationships: list[Relationship]


class KGAgent:
    """Extracts entities from conversation turns and manages KG read/write paths."""

    def __init__(self, store: KnowledgeGraphStore | None = None, provider: str | None = None, user_config=None, user_id: str = ""):
        self._store = store or KnowledgeGraphStore(persist_path=_kg_path_for_user(user_id))
        self._extraction_llm = get_extraction_llm(provider=provider, user_config=user_config)

    def fused_extract(self, text: str) -> FusedResult:
        """Single LLM call: returns importance score + entities + relationships."""
        if not text.strip():
            return FusedResult(importance_score=0.0, entities=[], relationships=[])
        try:
            response = self._extraction_llm.invoke(
                [HumanMessage(content=_FUSED_PROMPT.format(text=text))]
            )
            raw = extract_text(response.content)
            data = _parse_llm_json(raw)
            return FusedResult.model_validate(data)
        except Exception as e:
            print(f"[kg_agent] fused_extract failed: {e!r}")
            return FusedResult(importance_score=0.0, entities=[], relationships=[])

    def find_seed_nodes(self, text: str) -> list[str]:
        """Return graph node names that appear (case-insensitive) in text."""
        text_lower = text.lower()
        return [n for n in self._store._graph.nodes if n.lower() in text_lower]

    def retrieve_context(self, entity_ids: list[str]) -> str:
        """Read path: traverse graph from entity_ids, return formatted context string."""
        nodes = self._store.traverse(entity_ids, max_hops=settings.kg_traversal_hops)
        self._store._maybe_maintain()
        return self._store.format_context(nodes)

    def update_graph(self, fused: FusedResult, episode_id: str) -> list[str]:
        """Write path: upsert graph from a FusedResult, persist, return entity names."""
        for entity in fused.entities:
            self._store.upsert_node(entity.name, entity.type, entity.description)
        for rel in fused.relationships:
            if (self._store._graph.has_node(rel.source)
                    and self._store._graph.has_node(rel.target)):
                self._store.upsert_edge(rel.source, rel.target, rel.rel_type, rel.weight)
        self._store.save()
        return [e.name for e in fused.entities]

    @property
    def store(self) -> KnowledgeGraphStore:
        return self._store
