"""CLI test harness — run a conversation and inspect memory state.

Usage:
    uv run python cli.py                   # Ollama (default)
    uv run python cli.py --provider hf     # HuggingFace Inference API
"""
import argparse
import json
import os
import uuid

from dotenv import load_dotenv

load_dotenv()

from memoryweave.agents.graph import build_read_graph_with_state
from memoryweave.core.state import MemoryWeaveState


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


def _print_stats(last_tokens: int) -> None:
    print(f"\n[Stats] Context tokens last turn: ~{last_tokens}")
    if os.path.exists("kg_store.json"):
        with open("kg_store.json") as f:
            kg = json.load(f)
        nodes = kg.get("nodes", [])
        links = kg.get("links", [])
        print(f"        KG nodes: {len(nodes)} | KG edges: {len(links)}")
        if nodes:
            print("        Nodes:")
            for n in nodes:
                print(f"          [{n.get('type', '?')}] {n['id']} — {n.get('description', '')[:60]}")
        if links:
            print("        Edges:")
            for e in links:
                print(f"          {e['source']} --{e.get('rel_type', '?')}--> {e['target']} (w={e.get('weight', 0):.2f})")
    else:
        print("        KG: no graph persisted yet")
    print()


def run_interactive(provider: str = "ollama"):
    print(f"MemoryWeave — interactive session [provider: {provider}]")
    print("Commands: 'quit' to exit · 'stats' for memory state\n")
    bundle = build_read_graph_with_state(session_id=str(uuid.uuid4()), provider=provider)
    graph = bundle.graph
    last_tokens = 0

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() == "quit":
            break
        if user_input.lower() == "stats":
            _print_stats(last_tokens)
            continue

        result = graph.invoke(_initial_state(user_input))

        from langchain_core.messages import AIMessage, HumanMessage
        msgs = [HumanMessage(content=user_input), AIMessage(content=result["response"])]
        for m in msgs:
            bundle.working.add(m)
        turn_content = f"{user_input}\n{result['response']}"
        fused = bundle.kg.fused_extract(turn_content)
        episode = bundle.episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = bundle.kg.update_graph(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            bundle.episodic.update_entity_links(episode.id, entity_names)

        last_tokens = result["token_estimate"]
        print(f"Assistant: {result['response']}")
        print(f"  [provider: {provider} · context tokens: ~{last_tokens}]\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MemoryWeave CLI")
    parser.add_argument(
        "--provider", choices=["ollama", "hf"], default="ollama",
        help="LLM provider: 'ollama' (local) or 'hf' (HuggingFace Inference API)"
    )
    args = parser.parse_args()
    run_interactive(provider="huggingface" if args.provider == "hf" else "ollama")
