"""
Retrieval quality evaluator — RAGAS-inspired metrics (Es et al. 2023).

Three metrics scored by a single LLM call per turn:
  context_relevance  — are the retrieved facts useful for the query?
  faithfulness       — does the answer stay within retrieved context?
  answer_relevance   — does the answer actually address the question?

Plus two structural metrics computed without an LLM:
  kg_seed_found      — was the KG retrieval triggered (non-empty KG context)?
  episode_count      — how many episodes were retrieved?
"""
import json
import logging
import re

import asyncpg
from langchain_core.messages import HumanMessage

from memoryweave.core.config import settings
from memoryweave.core.llm import extract_text, get_extraction_llm
from memoryweave.db.database import new_uuid
from memoryweave.eval.events import TurnEvent

logger = logging.getLogger(__name__)

_EVAL_PROMPT = """\
You are evaluating the retrieval quality of a memory-augmented AI assistant.

Question asked:
{question}

Retrieved context (knowledge graph nodes + past episode memories):
{context}

Answer given:
{answer}

Score each metric from 0.0 to 1.0:

context_relevance: Are the retrieved facts actually useful for answering this question?
  1.0 = all retrieved context is directly relevant to the question
  0.5 = some context is relevant, some is noise
  0.0 = retrieved context is entirely irrelevant or context is empty

faithfulness: Does the answer only use information from the retrieved context?
  1.0 = every claim in the answer is supported by the retrieved context
  0.5 = answer mostly uses context but adds some outside knowledge
  0.0 = answer ignores context and invents facts

answer_relevance: Does the answer directly address what was asked?
  1.0 = answer completely and precisely answers the question
  0.5 = answer is partially relevant but drifts or is incomplete
  0.0 = answer ignores the question entirely

Return ONLY valid JSON — no explanation outside the JSON:
{{
  "context_relevance": <float 0.0-1.0>,
  "faithfulness": <float 0.0-1.0>,
  "answer_relevance": <float 0.0-1.0>,
  "reasoning": "<one concise sentence summarising retrieval quality>"
}}"""


class RetrievalEvalWorker:
    """Scores retrieval quality for each turn using RAGAS-inspired metrics."""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool
        self._llm = get_extraction_llm(provider=settings.llm_provider)

    async def process(self, turn_metric_id: str, event: TurnEvent) -> None:
        context_parts = []
        if event.kg_texts:
            context_parts.append("Knowledge graph:\n" + "\n".join(event.kg_texts))
        if event.episode_texts:
            context_parts.append("Past episodes:\n" + "\n".join(
                f"- {t[:300]}" for t in event.episode_texts
            ))
        context = "\n\n".join(context_parts) or "(no context retrieved)"

        kg_seed_found = bool(event.kg_texts)
        episode_count = len(event.episode_texts)
        kg_node_count = sum(
            1 for line in event.kg_texts
            if line.startswith("-") or (not line.startswith(" ") and not line.startswith("("))
        )

        context_relevance = faithfulness = answer_relevance = None
        reasoning = None

        try:
            prompt = _EVAL_PROMPT.format(
                question=event.question,
                context=context[:3000],
                answer=event.answer[:1500],
            )
            msg = await self._llm.ainvoke([HumanMessage(content=prompt)])
            raw = extract_text(msg.content)
            cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                context_relevance = float(max(0.0, min(1.0, data.get("context_relevance", 0))))
                faithfulness = float(max(0.0, min(1.0, data.get("faithfulness", 0))))
                answer_relevance = float(max(0.0, min(1.0, data.get("answer_relevance", 0))))
                reasoning = data.get("reasoning", "")
            else:
                logger.warning(
                    "RetrievalEvalWorker: no JSON found in LLM response [session=%s turn=%s] raw=%r",
                    event.session_id, event.turn_number, raw[:200],
                )
        except Exception:
            logger.exception(
                "RetrievalEvalWorker LLM eval failed [session=%s turn=%s]",
                getattr(event, "session_id", "?"),
                getattr(event, "turn_number", "?"),
            )

        try:
            await self._write(
                turn_metric_id=turn_metric_id,
                session_id=event.session_id,
                turn_number=event.turn_number,
                kg_seed_found=kg_seed_found,
                episode_count=episode_count,
                kg_node_count=kg_node_count,
                context_relevance=context_relevance,
                faithfulness=faithfulness,
                answer_relevance=answer_relevance,
                reasoning=reasoning,
            )
        except Exception:
            logger.exception(
                "RetrievalEvalWorker DB write failed [session=%s turn=%s]",
                getattr(event, "session_id", "?"),
                getattr(event, "turn_number", "?"),
            )

    async def write_structural(self, turn_metric_id: str, event: TurnEvent) -> None:
        """Write only structural metrics (no LLM call) — fast path for question mode."""
        try:
            await self._write(
                turn_metric_id=turn_metric_id,
                session_id=event.session_id,
                turn_number=event.turn_number,
                kg_seed_found=bool(event.kg_texts),
                episode_count=len(event.episode_texts),
                kg_node_count=0,
            )
        except Exception:
            logger.exception(
                "RetrievalEvalWorker DB write failed [session=%s turn=%s]",
                getattr(event, "session_id", "?"),
                getattr(event, "turn_number", "?"),
            )

    async def _write(
        self,
        turn_metric_id: str,
        session_id: str,
        turn_number: int,
        kg_seed_found: bool,
        episode_count: int,
        kg_node_count: int = 0,
        context_relevance: float | None = None,
        faithfulness: float | None = None,
        answer_relevance: float | None = None,
        reasoning: str | None = None,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO retrieval_evals (
                    id, turn_metric_id, session_id, turn_number,
                    kg_seed_found, episode_count, kg_node_count,
                    context_relevance, faithfulness, answer_relevance, reasoning
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT DO NOTHING
                """,
                new_uuid(), turn_metric_id, session_id, turn_number,
                kg_seed_found, episode_count, kg_node_count,
                context_relevance, faithfulness, answer_relevance, reasoning,
            )
