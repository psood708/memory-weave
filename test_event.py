"""
Quick test event — seeds a made-up product planning scenario.

Usage:
    uv run python test_event.py                 # Ollama (default)
    uv run python test_event.py --provider hf   # HuggingFace
"""
import argparse
import uuid

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import AIMessage, HumanMessage

from memoryweave.agents.graph import build_read_graph_with_state
from memoryweave.core.state import MemoryWeaveState

TURNS = [
    "I'm the PM for a product called Orion — it's a real-time sports analytics dashboard used by NBA teams.",
    "The lead engineer on Orion is Marcus Webb. He's been pushing to rewrite the ingestion pipeline in Rust for performance.",
    "Our data scientist Nina Kapoor found that the current Python pipeline drops 8% of events under peak load on game nights.",
    "We decided to move the ingestion layer to Rust and use Apache Kafka for the event buffer. Marcus owns this migration.",
    "The deadline for the Kafka migration is August 15th. The Golden State Warriors go live on September 1st.",
    "Nina is also building a shot-quality model using XGBoost. It needs the clean Kafka stream to reduce training noise.",
    "Our infra runs on AWS. We use EKS for orchestration and RDS Postgres for the analytics store.",
    "Marcus prefers Tokio as the async runtime for the Rust service. Nina prefers keeping model training in Python with DVC for versioning.",
    "The Warriors deal is worth $2M ARR. If we miss the September deadline we lose the contract to SportRadar.",
    "I met with David Lowe from the Warriors analytics team last Tuesday. He wants live possession-adjusted plus-minus added before launch.",
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


def run(provider: str):
    print(f"\nOrion test event — provider={provider}\n{'─'*50}")
    bundle = build_read_graph_with_state(session_id=str(uuid.uuid4()), provider=provider)
    graph = bundle.graph

    for i, turn in enumerate(TURNS, 1):
        print(f"[{i}/{len(TURNS)}] You: {turn}")
        result = graph.invoke(_initial_state(turn))
        response = result["response"]
        print(f"       Agent: {response[:120]}{'...' if len(response) > 120 else ''}")
        print(f"       tokens: ~{result['token_estimate']}  kg_context: {'yes' if result['kg_context'] else 'none'}")

        msgs = [HumanMessage(content=turn), AIMessage(content=response)]
        for m in msgs:
            bundle.working.add(m)
        fused = bundle.kg.fused_extract(f"{turn}\n{response}")
        episode = bundle.episodic.write(msgs, importance_score=fused.importance_score)
        entity_names = bundle.kg.update_graph(fused, episode_id=episode.id if episode else "")
        if episode and entity_names:
            bundle.episodic.update_entity_links(episode.id, entity_names)
        print(f"       entities extracted: {entity_names or '—'}\n")

    print(f"Done. Hit the Reload button in Memory State panel to see changes.")
    print(f"Run  uv run python cli.py --provider {'hf' if provider == 'huggingface' else provider}  to continue chatting.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["ollama", "hf"], default="ollama")
    args = parser.parse_args()
    run("huggingface" if args.provider == "hf" else "ollama")
