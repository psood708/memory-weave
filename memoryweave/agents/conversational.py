from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from memoryweave.agents.orchestrator import MemoryOrchestrator
from memoryweave.core.llm import extract_text, get_llm

_BASE_SYSTEM = "You are a helpful, context-aware assistant with access to prior conversation memory."


class ConversationalAgent:
    """User-facing agent — receives pre-built memory context, generates responses."""

    def __init__(self, orchestrator: MemoryOrchestrator):
        self._orchestrator = orchestrator
        self._llm = get_llm()

    def chat(self, user_input: str) -> tuple[str, int]:
        """Returns (response_text, context_token_estimate)."""
        result = self._orchestrator.build_context(user_input)

        system_content = _BASE_SYSTEM
        if result.formatted_context:
            system_content += f"\n\n{result.formatted_context}"

        response = self._llm.invoke([
            SystemMessage(content=system_content),
            HumanMessage(content=user_input),
        ])
        response_text = extract_text(response.content)

        self._orchestrator.write_turn([
            HumanMessage(content=user_input),
            AIMessage(content=response_text),
        ])

        return response_text, result.token_estimate
