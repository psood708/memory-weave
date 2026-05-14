"""
Demo script — runs a scripted conversation to seed the knowledge graph.
Run with:  uv run python demo.py
"""
import json
import uuid

from dotenv import load_dotenv

load_dotenv()

from memoryweave.agents.graph import build_graph
from memoryweave.core.state import MemoryWeaveState

TURNS = [
    "My name is Parth. I'm a data scientist transitioning into applied AI engineering.",
    "I'm building a project called MemoryWeave. It's a conversational AI agent with a three-tier memory system.",
    "MemoryWeave uses ChromaDB for episodic memory and NetworkX for the knowledge graph.",
    "I prefer Python over other languages, and I use uv for package management.",
    "My goal is to get a role at an AI-first startup, preferably Series A to C.",
    "LangGraph is the orchestration framework I chose for MemoryWeave because of its typed state model.",
    "I work with LangSmith for observability — it traces every agent node in the graph.",
    "MemoryWeave has five agents: orchestrator, working memory, episodic memory, knowledge graph, and conversational.",
    "The knowledge graph uses Hebbian-inspired weight reinforcement — edges that get traversed get stronger.",
    "I want to benchmark MemoryWeave against a naive full-buffer baseline to prove token efficiency.",
]


def _initial_state(user_input: str) -> MemoryWeaveState:
    return {
        "user_input": user_input,
        "working_context": "",
        "episodes": [],
        "episode_context": "",
        "kg_context": "",
        "formatted_context": "",
        "response": "",
        "token_estimate": 0,
    }


def _print_kg_summary() -> None:
    try:
        with open("kg_store.json") as f:
            kg = json.load(f)
        nodes = kg.get("nodes", [])
        links = kg.get("links", [])
        print(f"\n{'='*60}")
        print(f"  KG SUMMARY — {len(nodes)} nodes, {len(links)} edges")
        print(f"{'='*60}")
        if nodes:
            print("\n  Nodes:")
            for n in nodes:
                print(f"    [{n.get('type', '?'):12}] {n['id']}")
                if n.get("description"):
                    print(f"                   {n['description'][:70]}")
        if links:
            print("\n  Edges:")
            for e in links:
                print(f"    {e['source']} --{e.get('rel_type', '?')}--> {e['target']}  (w={e.get('weight', 0):.2f})")
        print()
    except FileNotFoundError:
        print("  kg_store.json not found — no entities were extracted.\n")


def run_demo():
    print("MemoryWeave Demo — seeding knowledge graph with scripted turns\n")
    graph = build_graph(session_id=str(uuid.uuid4()))

    for i, turn in enumerate(TURNS, 1):
        print(f"[{i}/{len(TURNS)}] You: {turn}")
        result = graph.invoke(_initial_state(turn))
        print(f"       Agent: {result['response'][:120]}{'...' if len(result['response']) > 120 else ''}")
        print(f"       tokens: ~{result['token_estimate']}  kg_context: {'yes' if result['kg_context'] else 'none'}\n")

    _print_kg_summary()
    print("Done. Run  uv run python cli.py  to chat on top of this graph.")


if __name__ == "__main__":
    run_demo()
