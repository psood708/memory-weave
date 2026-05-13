from typing import Literal

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_extraction_llm
from memoryweave.memory.kg_store import KnowledgeGraphStore

_EXTRACTION_PROMPT = """\
Extract entities and relationships from this conversation turn.

Turn:
{text}

Return ONLY valid JSON matching this exact schema:
{{
  "entities": [
    {{"name": "string", "type": "Person|Project|Preference|Fact|Organization", "description": "string"}}
  ],
  "relationships": [
    {{"source": "entity name", "target": "entity name", "rel_type": "string", "weight": 1.0}}
  ]
}}

Rules:
- Only use entity types from this list: Person, Project, Preference, Fact, Organization
- rel_type must be a short verb phrase: works_on, prefers, knows, part_of, uses, has, related_to
- weight is always 1.0 for new relationships
- source and target must be names of entities listed above
- If no entities are found, return {{"entities": [], "relationships": []}}
- Return ONLY the JSON object, no explanation or markdown"""


class Entity(BaseModel):
    name: str
    type: Literal["Person", "Project", "Preference", "Fact", "Organization"]
    description: str


class Relationship(BaseModel):
    source: str
    target: str
    rel_type: str
    weight: float = 1.0


class ExtractionResult(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]


class KGAgent:
    """Extracts entities from conversation turns and manages KG read/write paths."""

    def __init__(self, store: KnowledgeGraphStore | None = None):
        self._store = store or KnowledgeGraphStore()
        self._extraction_llm = get_extraction_llm()

    def _extract(self, text: str) -> ExtractionResult:
        if not text.strip():
            return ExtractionResult(entities=[], relationships=[])
        try:
            response = self._extraction_llm.invoke(
                [HumanMessage(content=_EXTRACTION_PROMPT.format(text=text))]
            )
            raw = extract_text(response.content)
            return ExtractionResult.model_validate_json(raw)
        except Exception:
            return ExtractionResult(entities=[], relationships=[])

    def retrieve_context(self, entity_ids: list[str]) -> str:
        """Read path: traverse graph from entity_ids, return formatted context string."""
        nodes = self._store.traverse(entity_ids, max_hops=settings.kg_traversal_hops)
        self._store.decay_all()
        self._store.prune()
        return self._store.format_context(nodes)

    def extract_and_update(self, content: str, episode_id: str) -> list[str]:
        """Write path: extract entities from content, upsert graph, persist, return entity names."""
        extraction = self._extract(content)
        for entity in extraction.entities:
            self._store.upsert_node(entity.name, entity.type, entity.description)
        for rel in extraction.relationships:
            if (self._store._graph.has_node(rel.source)
                    and self._store._graph.has_node(rel.target)):
                self._store.upsert_edge(rel.source, rel.target, rel.rel_type, rel.weight)
        self._store.save()
        return [e.name for e in extraction.entities]

    @property
    def store(self) -> KnowledgeGraphStore:
        return self._store
