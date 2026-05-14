from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3.5:9b"

    langsmith_api_key: str = ""
    langsmith_tracing: bool = False
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_project: str = "memory-weave"

    # Working memory
    working_memory_max_turns: int = 10

    # Episodic memory
    episodic_importance_threshold: float = 0.4
    episodic_decay_lambda: float = 0.05
    episodic_top_k: int = 5
    episodic_min_importance: float = 0.05
    episodic_decay_interval: int = 5

    # Knowledge graph
    kg_reinforcement_factor: float = 1.2
    kg_decay_factor: float = 0.95
    kg_min_edge_weight: float = 0.1
    kg_traversal_hops: int = 2
    kg_decay_interval: int = 5

    # Orchestrator
    context_token_budget: int = 2000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
