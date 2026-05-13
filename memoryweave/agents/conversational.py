from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from memoryweave.agents.orchestrator import MemoryOrchestrator
from memoryweave.core.config import settings

_BASE_SYSTEM = "You are a helpful, context-aware assistant with access to prior conversation memory."


class ConversationalAgent:
    """User-facing agent that receives pre-built context and generates responses."""

    def __init__(self, orchestrator: MemoryOrchestrator):
        self._orchestrator = orchestrator
        self._llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=settings.anthropic_api_key,
            max_tokens=1024,
        )

    def chat(self, user_input: str) -> tuple[str, int]:
        """Returns (response_text, context_token_estimate)."""
        result = self._orchestrator.build_context(user_input)

        system_content = _BASE_SYSTEM
        if result.formatted_context:
            system_content += f"\n\n{result.formatted_context}"

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_input),
        ]
        response = self._llm.invoke(messages)
        response_text = response.content

        human_msg = HumanMessage(content=user_input)
        from langchain_core.messages import AIMessage
        ai_msg = AIMessage(content=response_text)
        self._orchestrator.write_turn([human_msg, ai_msg])

        return response_text, result.token_estimate
