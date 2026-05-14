from langchain_ollama import ChatOllama

from memoryweave.core.config import settings


def get_llm(temperature: float = 0.7) -> ChatOllama:
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
        num_gpu=99,
        num_ctx=4096,
    )


def get_extraction_llm() -> ChatOllama:
    """JSON-mode LLM for structured entity extraction and importance scoring — temp=0."""
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json",
        num_gpu=99,
        num_ctx=2048,
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
