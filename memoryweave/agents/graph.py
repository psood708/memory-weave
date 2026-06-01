import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

_log = logging.getLogger(__name__)

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.kg_agent import KGAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.core.config import settings
from memoryweave.core.context_budget import build_context_block, format_context_block
from memoryweave.core.llm import extract_text, get_llm
from memoryweave.core.state import MemoryWeaveState

_BASE_SYSTEM = """\
You are a memory-aware conversational assistant. You have been given structured \
memory from past conversations — a knowledge graph of people, projects, and facts, \
plus episodic recall of specific things discussed.

Rules you must follow:
1. Answer ONLY using the facts provided in the memory context below. Do not draw on \
your training data or offer to search the web.
2. If the memory context does not contain enough to answer, say: \
"I don't have that in our conversation history yet."
3. When answering, cite the specific memory naturally in prose — \
e.g. "Based on what you told me, ..." or "From our earlier conversation, ..."
4. Do NOT expose raw graph internals (weights, IDs, arrows) in your response. \
Translate all graph facts into natural, conversational language.
5. When the memory shows a chain of connections between people or facts, \
narrate that chain clearly — walk through the links step by step.\
"""

_QUESTION_SYSTEM = """\
You are a knowledge graph query engine. The user is directly querying their \
personal knowledge graph. Your ONLY primary data source is the structured graph \
context in the "Memory — Knowledge Graph" section below.

Rules — follow these strictly:
1. Answer PRIMARILY from the "Memory — Knowledge Graph" section (entity descriptions \
   and relationship triples). If the KG section is populated, it is authoritative.
2. The knowledge graph contains entity descriptions and relationship triples \
   of the form (entity, relationship, entity). Use these to build your answer.
3. You may consult "Memory — Past Episodes" ONLY as a secondary fallback when the \
   knowledge graph section is empty or silent on the question. Never prefer episodes \
   over graph facts when both are available.
4. If neither the graph nor episodes contain enough to answer, respond with: \
   "The knowledge graph doesn't have that information yet. \
   Try telling me more about it in a conversation first."
5. Translate graph facts into natural prose — do not expose node IDs, \
   edge weights, or internal notation.
6. For multi-hop queries (how are X and Y connected?), trace every hop \
   explicitly: "X works on Project A, which is led by Y."
7. Ignore the "Current Conversation" section entirely — it is not \
   relevant to a knowledge graph query.\
"""


@dataclass
class GraphWithAgents:
    graph: object  # compiled LangGraph
    working: WorkingMemoryAgent
    episodic: EpisodicMemoryAgent
    kg: KGAgent


def build_graph(session_id: str | None = None):
    """Build and compile the MemoryWeave LangGraph StateGraph."""
    sid = session_id or str(uuid.uuid4())
    working = WorkingMemoryAgent()
    episodic = EpisodicMemoryAgent(session_id=sid)
    kg = KGAgent()
    llm = get_llm()

    def working_memory_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        result = {"working_context": working.format_for_context()}
        print(f"[latency] working_memory: {time.perf_counter() - t0:.3f}s")
        return result

    def episodic_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        episodes = episodic.retrieve(state["user_input"])
        result = {
            "episodes": episodes,
            "episode_context": episodic.format_for_context(episodes),
        }
        print(f"[latency] episodic_retrieve: {time.perf_counter() - t0:.3f}s")
        return result

    def kg_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        seeds = kg.find_seed_nodes(state["user_input"])
        result = {"kg_context": kg.retrieve_context(seeds)}
        print(f"[latency] kg_retrieve: {time.perf_counter() - t0:.3f}s")
        return result

    def merge_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        block = build_context_block(
            working=state["working_context"],
            episodes=state["episode_context"],
            kg=state["kg_context"],
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        print(f"[latency] merge: {time.perf_counter() - t0:.3f}s")
        return {"formatted_context": formatted, "token_estimate": len(formatted) // 4}

    def conversational_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        system = _BASE_SYSTEM
        if state.get("formatted_context"):
            system += f"\n\n{state['formatted_context']}"
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=state["user_input"]),
        ])
        print(f"[latency] conversational_llm: {time.perf_counter() - t0:.3f}s")
        return {"response": extract_text(response.content)}

    def write_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        msgs = [
            HumanMessage(content=state["user_input"]),
            AIMessage(content=state["response"]),
        ]
        for msg in msgs:
            working.add(msg)
        turn_content = f"{state['user_input']}\n{state['response']}"

        t_fused = time.perf_counter()
        fused = kg.fused_extract(turn_content)
        print(f"[latency] fused_extract_llm: {time.perf_counter() - t_fused:.3f}s")

        episode = episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = kg.update_graph_sync(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            episodic.update_entity_links(episode.id, entity_names)
        print(f"[latency] write_total: {time.perf_counter() - t0:.3f}s")
        return {}

    builder = StateGraph(MemoryWeaveState)
    builder.add_node("working_memory", working_memory_node)
    builder.add_node("episodic", episodic_node)
    builder.add_node("kg", kg_node)
    builder.add_node("merge", merge_node)
    builder.add_node("conversational", conversational_node)
    builder.add_node("write", write_node)

    builder.add_edge(START, "working_memory")
    builder.add_edge(START, "episodic")
    builder.add_edge(START, "kg")
    builder.add_edge("working_memory", "merge")
    builder.add_edge("episodic", "merge")
    builder.add_edge("kg", "merge")
    builder.add_edge("merge", "conversational")
    builder.add_edge("conversational", "write")
    builder.add_edge("write", END)

    return builder.compile()


def build_graph_with_state(session_id: str | None = None) -> GraphWithAgents:
    """Build graph and return it together with the agent instances it uses."""
    sid = session_id or str(uuid.uuid4())
    working = WorkingMemoryAgent()
    episodic = EpisodicMemoryAgent(session_id=sid)
    kg = KGAgent()
    llm = get_llm()

    def working_memory_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        result = {"working_context": working.format_for_context()}
        print(f"[latency] working_memory: {time.perf_counter() - t0:.3f}s")
        return result

    def episodic_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        episodes = episodic.retrieve(state["user_input"])
        result = {
            "episodes": episodes,
            "episode_context": episodic.format_for_context(episodes),
        }
        print(f"[latency] episodic_retrieve: {time.perf_counter() - t0:.3f}s")
        return result

    def kg_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        seeds = kg.find_seed_nodes(state["user_input"])
        result = {"kg_context": kg.retrieve_context(seeds)}
        print(f"[latency] kg_retrieve: {time.perf_counter() - t0:.3f}s")
        return result

    def merge_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        block = build_context_block(
            working=state["working_context"],
            episodes=state["episode_context"],
            kg=state["kg_context"],
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        print(f"[latency] merge: {time.perf_counter() - t0:.3f}s")
        return {"formatted_context": formatted, "token_estimate": len(formatted) // 4}

    def conversational_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        system = _BASE_SYSTEM
        if state.get("formatted_context"):
            system += f"\n\n{state['formatted_context']}"
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=state["user_input"]),
        ])
        print(f"[latency] conversational_llm: {time.perf_counter() - t0:.3f}s")
        return {"response": extract_text(response.content)}

    def write_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        msgs = [
            HumanMessage(content=state["user_input"]),
            AIMessage(content=state["response"]),
        ]
        for msg in msgs:
            working.add(msg)
        turn_content = f"{state['user_input']}\n{state['response']}"

        t_fused = time.perf_counter()
        fused = kg.fused_extract(turn_content)
        print(f"[latency] fused_extract_llm: {time.perf_counter() - t_fused:.3f}s")

        episode = episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = kg.update_graph_sync(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            episodic.update_entity_links(episode.id, entity_names)
        print(f"[latency] write_total: {time.perf_counter() - t0:.3f}s")
        return {}

    builder = StateGraph(MemoryWeaveState)
    builder.add_node("working_memory", working_memory_node)
    builder.add_node("episodic", episodic_node)
    builder.add_node("kg", kg_node)
    builder.add_node("merge", merge_node)
    builder.add_node("conversational", conversational_node)
    builder.add_node("write", write_node)

    builder.add_edge(START, "working_memory")
    builder.add_edge(START, "episodic")
    builder.add_edge(START, "kg")
    builder.add_edge("working_memory", "merge")
    builder.add_edge("episodic", "merge")
    builder.add_edge("kg", "merge")
    builder.add_edge("merge", "conversational")
    builder.add_edge("conversational", "write")
    builder.add_edge("write", END)

    compiled = builder.compile()
    return GraphWithAgents(graph=compiled, working=working, episodic=episodic, kg=kg)


def _compile_graph(working: WorkingMemoryAgent, episodic: EpisodicMemoryAgent, kg: KGAgent, llm) -> object:
    """Compile a LangGraph from existing agent objects and an LLM client.
    Agents are captured by reference so memory state is preserved across recompiles."""

    def working_memory_node(state: MemoryWeaveState) -> dict:
        return {"working_context": working.format_for_context()}

    def episodic_node(state: MemoryWeaveState) -> dict:
        episodes = episodic.retrieve(state["user_input"])
        return {"episodes": episodes, "episode_context": episodic.format_for_context(episodes)}

    def kg_node(state: MemoryWeaveState) -> dict:
        seeds = kg.find_seed_nodes(state["user_input"])
        ctx = kg.retrieve_context(seeds)
        _log.info("[kg_node] query=%r  seeds=%r  ctx_len=%d", state["user_input"][:80], seeds, len(ctx))
        return {"kg_context": ctx}

    def merge_node(state: MemoryWeaveState) -> dict:
        is_question = state.get("query_mode", "memory") == "question"
        block = build_context_block(
            # Strip working memory for question mode — conversation history
            # is noise that causes the LLM to answer from chat context instead of KG.
            working="" if is_question else state.get("working_context", ""),
            episodes=state.get("episode_context", ""),
            kg=state.get("kg_context", ""),
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        return {"formatted_context": formatted, "token_estimate": len(formatted) // 4}

    def conversational_node(state: MemoryWeaveState) -> dict:
        t0 = time.perf_counter()
        is_question = state.get("query_mode", "memory") == "question"
        system = _QUESTION_SYSTEM if is_question else _BASE_SYSTEM
        if state.get("formatted_context"):
            system += f"\n\n{state['formatted_context']}"
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=state["user_input"]),
        ])
        print(f"[latency] conversational_llm: {time.perf_counter() - t0:.3f}s")
        return {"response": extract_text(response.content)}

    builder = StateGraph(MemoryWeaveState)
    builder.add_node("working_memory", working_memory_node)
    builder.add_node("episodic", episodic_node)
    builder.add_node("kg", kg_node)
    builder.add_node("merge", merge_node)
    builder.add_node("conversational", conversational_node)
    builder.add_edge(START, "working_memory")
    builder.add_edge(START, "episodic")
    builder.add_edge(START, "kg")
    builder.add_edge("working_memory", "merge")
    builder.add_edge("episodic", "merge")
    builder.add_edge("kg", "merge")
    builder.add_edge("merge", "conversational")
    builder.add_edge("conversational", END)
    return builder.compile()


async def build_read_graph_with_state(
    session_id: str | None = None,
    provider: str | None = None,
    user_config=None,
    kg_backend=None,
) -> GraphWithAgents:
    """Read-only graph: retrieval + conversational only, no write_node.
    Use for the API hot path; fire writes separately in a background task."""
    from memoryweave.memory.kg_backend import FileKGBackend, PostgresKGBackend
    from memoryweave.memory.kg_store import KnowledgeGraphStore

    sid = session_id or str(uuid.uuid4())
    user_id = user_config.user_id if user_config else ""
    working = WorkingMemoryAgent()
    episodic = EpisodicMemoryAgent(session_id=sid)

    if kg_backend is None:
        try:
            from memoryweave.db.postgres import get_pool
            pool = get_pool()
            kg_backend = PostgresKGBackend(pool) if pool is not None else FileKGBackend(str(Path(settings.kg_store_path).parent))
        except Exception:
            kg_backend = FileKGBackend(str(Path(settings.kg_store_path).parent))

    kg_store = KnowledgeGraphStore(backend=kg_backend, user_id=user_id)
    await kg_store.load()
    kg = KGAgent(store=kg_store, provider=provider, user_config=user_config)

    llm = get_llm(provider=provider, user_config=user_config)
    compiled = _compile_graph(working, episodic, kg, llm)
    return GraphWithAgents(graph=compiled, working=working, episodic=episodic, kg=kg)
