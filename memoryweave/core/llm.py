from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_ollama import ChatOllama

from memoryweave.core.config import settings

if TYPE_CHECKING:
    from memoryweave.models.config_repo import UserModelConfig


def get_llm(temperature: float = 0.7, provider: str | None = None, user_config: UserModelConfig | None = None):
    if user_config and user_config.provider in ("huggingface", "custom") and user_config.chat_model:
        return _hf_llm(temperature, model=user_config.chat_model, api_key=user_config.hf_api_key)
    p = provider or settings.llm_provider
    if p in ("huggingface", "custom"):
        return _hf_llm(temperature)
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=temperature,
        num_gpu=99,
        num_ctx=4096,
        num_batch=512,
        repeat_penalty=1.0,
    )


def get_extraction_llm(provider: str | None = None, user_config: UserModelConfig | None = None):
    """JSON-mode LLM for entity extraction and importance scoring."""
    if user_config and user_config.provider in ("huggingface", "custom") and user_config.hf_api_key:
        return _hf_extraction_llm(api_key=user_config.hf_api_key)
    p = provider or settings.llm_provider
    if p in ("huggingface", "custom"):
        return _hf_extraction_llm()
    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        format="json",
        num_gpu=99,
        num_ctx=4096,
        num_batch=512,
        repeat_penalty=1.0,
    )


def _hf_llm(temperature: float = 0.7, model: str | None = None, api_key: str | None = None):
    endpoint = HuggingFaceEndpoint(
        repo_id=model or settings.hf_model,
        huggingfacehub_api_token=api_key or settings.hf_api_key or None,
        temperature=temperature,
        max_new_tokens=512,
        task="text-generation",
    )
    return ChatHuggingFace(llm=endpoint)


def _hf_extraction_llm(api_key: str | None = None):
    endpoint = HuggingFaceEndpoint(
        repo_id=settings.hf_extraction_model,
        huggingfacehub_api_token=api_key or settings.hf_api_key or None,
        temperature=0,
        max_new_tokens=512,
        task="text-generation",
    )
    return ChatHuggingFace(llm=endpoint)


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
