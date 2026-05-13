from langchain_ollama import ChatOllama

from memoryweave.core.config import settings


def get_llm(temperature: float = 0.7) -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
    )


def get_scorer_llm() -> ChatOllama:
    """Deterministic LLM for importance scoring — temp=0, short output."""
    return ChatOllama(
        model=settings.ollama_scorer_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        num_predict=16,
    )


def extract_text(content: str | list) -> str:
    """Safely extract plain string from AIMessage.content (str | list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("text", "")
    return str(content)
