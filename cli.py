"""CLI test harness — run a conversation and inspect memory state."""
import uuid
from dotenv import load_dotenv

load_dotenv()

from memoryweave.agents.conversational import ConversationalAgent
from memoryweave.agents.episodic_memory import EpisodicMemoryAgent
from memoryweave.agents.orchestrator import MemoryOrchestrator
from memoryweave.agents.working_memory import WorkingMemoryAgent


def build_agent(session_id: str | None = None) -> ConversationalAgent:
    sid = session_id or str(uuid.uuid4())
    working = WorkingMemoryAgent()
    episodic = EpisodicMemoryAgent(session_id=sid)
    orchestrator = MemoryOrchestrator(working=working, episodic=episodic)
    return ConversationalAgent(orchestrator=orchestrator)


def run_interactive():
    print("MemoryWeave — interactive session (type 'quit' to exit, 'stats' for memory stats)\n")
    agent = build_agent()
    turn = 0

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() == "quit":
            break
        if user_input.lower() == "stats":
            store = agent._orchestrator._episodic.store
            print(f"\n[Stats] Episodes stored: {store.count()} | Turns: {store.turn_count}\n")
            continue

        response, tokens = agent.chat(user_input)
        turn += 1
        print(f"Assistant: {response}")
        print(f"  [context tokens used: ~{tokens}]\n")


if __name__ == "__main__":
    run_interactive()
