"""
Demo script — runs a scripted conversation to seed the knowledge graph.

Usage:
    uv run python demo.py                  # Ollama (default)
    uv run python demo.py --provider hf    # HuggingFace Inference API
"""
import argparse
import json
import uuid

from dotenv import load_dotenv

load_dotenv()

from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.graph import build_read_graph_with_state
from memoryweave.core.state import MemoryWeaveState

TURNS = [
    # Identity and background
    "My name is Parth. I'm a data scientist at Cohere transitioning into applied AI engineering.",
    "I'm building a project called MemoryWeave. It's a conversational AI agent with a three-tier memory system: working memory, episodic memory, and a knowledge graph.",
    "My manager at Cohere is Sarah Chen. She's been pushing me to move into ML engineering and publish something portfolio-worthy before Q3.",

    # Tech stack — many entities
    "MemoryWeave uses ChromaDB for episodic memory, NetworkX for the knowledge graph, and LangGraph for orchestration.",
    "I prefer Python over all other languages. I use uv for package management and Ruff for linting.",
    "For the LLM backbone I'm using Ollama locally with Qwen3.5 9B, and HuggingFace Inference API as a cloud fallback.",

    # People and their roles
    "My friend Aditya works at Mistral AI as a research engineer. He helped me think through the Hebbian weight reinforcement idea for the KG.",
    "I talked to Priya last week — she's a founding engineer at a Series B startup called Delphi that builds memory-augmented assistants. She said ChromaDB doesn't scale past 10M docs.",
    "My mentor James Lee runs AI infrastructure at Anthropic. He reviewed my two-phase retrieval design and said the graph traversal hop limit should be configurable.",

    # Projects and decisions
    "I decided to use LangSmith for observability after trying both Langfuse and Weights & Biases. LangSmith won because it traces LangGraph node boundaries natively.",
    "The eval harness compares MemoryWeave against a naive full-buffer baseline. I'm measuring token efficiency, retrieval accuracy, and graph contribution rate.",
    "I'm also building a Next.js frontend with a three-panel layout — memory state on the left, chat in the center, and a live force-graph visualization of the knowledge graph on the right.",

    # Goals and constraints
    "My target companies are Cohere, Cartesia, Imbue, and Character.AI. I want a role that's 70% engineering and 30% research.",
    "I have a hard deadline of June 30th to finish MemoryWeave and write up the benchmark results. Sarah wants to see a demo before then.",
    "The biggest technical risk is latency — two sequential LLM calls per turn makes the agent feel slow. I'm working on making the write node async.",

    # Preferences and tools
    "I use Cursor as my primary editor and Claude for coding help. I prefer dark mode and mono fonts for everything.",
    "For deployment I'm planning Docker Compose with a FastAPI backend on port 8000 and the Next.js frontend on port 3000.",
    "I track issues in Linear and use Notion for documentation. The MemoryWeave spec lives in a Notion page Aditya and I share.",

    # Cross-entity relationships
    "Priya's company Delphi actually uses a similar architecture to MemoryWeave — she told me they replaced ChromaDB with Qdrant after hitting scale issues.",
    "James suggested I look at the MemGPT paper by Packer et al. and the Cognitive Architectures for Language Agents survey as references for the episodic memory design.",
    "Sarah wants me to open-source MemoryWeave on GitHub after the benchmark paper is done. She thinks it could get traction in the LangChain community.",
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


def run_demo(provider: str = "ollama"):
    print(f"MemoryWeave Demo — seeding knowledge graph [{provider}]\n")
    bundle = build_read_graph_with_state(session_id=str(uuid.uuid4()), provider=provider)
    graph = bundle.graph

    for i, turn in enumerate(TURNS, 1):
        print(f"[{i}/{len(TURNS)}] You: {turn}")
        result = graph.invoke(_initial_state(turn))
        response = result["response"]
        print(f"       Agent: {response[:120]}{'...' if len(response) > 120 else ''}")
        print(f"       tokens: ~{result['token_estimate']}  kg_context: {'yes' if result['kg_context'] else 'none'}")

        # Write memory (sync, same as CLI)
        msgs = [HumanMessage(content=turn), AIMessage(content=response)]
        for m in msgs:
            bundle.working.add(m)
        fused = bundle.kg.fused_extract(f"{turn}\n{response}")
        episode = bundle.episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = bundle.kg.update_graph(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            bundle.episodic.update_entity_links(episode.id, entity_names)
        print(f"       entities extracted: {entity_names or '—'}\n")

    _print_kg_summary()
    print(f"Done. KG written to kg_store.json.")
    print(f"Run  uv run python cli.py --provider {provider}  to continue chatting.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MemoryWeave demo seeder")
    parser.add_argument(
        "--provider", choices=["ollama", "hf"], default="ollama",
        help="LLM provider: 'ollama' (local) or 'hf' (HuggingFace Inference API)"
    )
    args = parser.parse_args()
    run_demo(provider="huggingface" if args.provider == "hf" else "ollama")
