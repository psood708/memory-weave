"""CLI test harness — run a conversation and inspect memory state."""
import json
import os
import uuid

from dotenv import load_dotenv

load_dotenv()

from memoryweave.agents.graph import build_graph
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
        nodes = len(kg.get("nodes", []))
        links = len(kg.get("links", []))
        print(f"        KG nodes: {nodes} | KG edges: {links}")
    else:
        print("        KG: no graph persisted yet")
    print()


def run_interactive():
    print("MemoryWeave — interactive session (type 'quit' to exit, 'stats' for memory stats)\n")
    graph = build_graph(session_id=str(uuid.uuid4()))
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
        last_tokens = result["token_estimate"]
        print(f"Assistant: {result['response']}")
        print(f"  [context tokens: ~{last_tokens}]\n")


if __name__ == "__main__":
    run_interactive()
