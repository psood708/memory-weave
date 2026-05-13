import uuid

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.kg_agent import KGAgent
from memoryweave.agents.working_memory import WorkingMemoryAgent
from memoryweave.core.config import settings
from memoryweave.core.context_budget import build_context_block, format_context_block
from memoryweave.core.llm import extract_text, get_llm
from memoryweave.core.state import MemoryWeaveState

_BASE_SYSTEM = "You are a helpful, context-aware assistant with access to prior conversation memory."


def build_graph(session_id: str | None = None):
    """Build and compile the MemoryWeave LangGraph StateGraph."""
    sid = session_id or str(uuid.uuid4())
    working = WorkingMemoryAgent()
    episodic = EpisodicMemoryAgent(session_id=sid)
    kg = KGAgent()
    llm = get_llm()

    def working_memory_node(state: MemoryWeaveState) -> dict:
        return {"working_context": working.format_for_context()}

    def episodic_node(state: MemoryWeaveState) -> dict:
        episodes = episodic.retrieve(state["user_input"])
        return {
            "episodes": episodes,
            "episode_context": episodic.format_for_context(episodes),
        }

    def kg_node(state: MemoryWeaveState) -> dict:
        return {"kg_context": kg.retrieve_context([state["user_input"]])}

    def merge_node(state: MemoryWeaveState) -> dict:
        block = build_context_block(
            working=state["working_context"],
            episodes=state["episode_context"],
            kg=state["kg_context"],
            token_budget=settings.context_token_budget,
        )
        formatted = format_context_block(block)
        return {"formatted_context": formatted, "token_estimate": len(formatted) // 4}

    def conversational_node(state: MemoryWeaveState) -> dict:
        system = _BASE_SYSTEM
        if state.get("formatted_context"):
            system += f"\n\n{state['formatted_context']}"
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=state["user_input"]),
        ])
        return {"response": extract_text(response.content)}

    def write_node(state: MemoryWeaveState) -> dict:
        msgs = [
            HumanMessage(content=state["user_input"]),
            AIMessage(content=state["response"]),
        ]
        for msg in msgs:
            working.add(msg)
        episode = episodic.write(msgs)
        if episode:
            turn_content = f"{state['user_input']}\n{state['response']}"
            entity_names = kg.extract_and_update(turn_content, episode_id=episode.id)
            if entity_names:
                episodic.update_entity_links(episode.id, entity_names)
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
