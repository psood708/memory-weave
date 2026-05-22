from enum import Enum


class ModelRole(str, Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"
    JUDGE = "judge"


_CATALOG: dict[ModelRole, list[dict]] = {
    ModelRole.CHAT: [
        {"id": "meta-llama/Llama-3.1-8B-Instruct", "label": "Llama 3.1 8B Instruct"},
        {"id": "mistralai/Mistral-7B-Instruct-v0.3", "label": "Mistral 7B Instruct v0.3"},
        {"id": "Qwen/Qwen2.5-7B-Instruct", "label": "Qwen 2.5 7B Instruct"},
        {"id": "microsoft/Phi-3-mini-4k-instruct", "label": "Phi-3 Mini 4K Instruct"},
    ],
    ModelRole.EMBEDDING: [
        {"id": "BAAI/bge-small-en-v1.5", "label": "BGE Small EN v1.5 (recommended)"},
        {"id": "sentence-transformers/all-MiniLM-L6-v2", "label": "all-MiniLM-L6-v2"},
        {"id": "thenlper/gte-large", "label": "GTE Large"},
    ],
    ModelRole.JUDGE: [
        {"id": "prometheus-eval/prometheus-7b-v2.0", "label": "Prometheus 7B v2.0 (recommended)"},
        {"id": "meta-llama/Llama-3.1-8B-Instruct", "label": "Llama 3.1 8B Instruct"},
    ],
}


def get_catalog() -> dict[ModelRole, list[dict]]:
    return _CATALOG
