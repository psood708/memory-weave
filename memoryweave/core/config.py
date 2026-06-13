import os

from pydantic_settings import BaseSettings, SettingsConfigDict

_APP_ENV = os.getenv("APP_ENV", "development")


class Settings(BaseSettings):
    # Environment
    app_env: str = "development"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3.5:9b"

    # LangSmith
    langsmith_api_key: str = ""
    langsmith_tracing: bool = False
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    langsmith_project: str = "memory-weave"

    # Working memory
    working_memory_max_turns: int = 10
    working_memory_ttl: int = 3600

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

    # LLM provider
    llm_provider: str = "ollama"

    # HuggingFace
    hf_model: str = "Qwen/Qwen2.5-7B-Instruct"
    hf_extraction_model: str = "Qwen/Qwen2.5-7B-Instruct"
    hf_api_key: str = ""

    # Storage paths — differ per environment
    chroma_path: str = "./data/dev/chroma"
    kg_store_path: str = "./data/dev/kg_store.json"
    eval_db_path: str = "./data/dev/metrics.db"

    # PostgreSQL
    database_url: str = "postgresql://memoryweave:memoryweave@localhost:5432/memoryweave"

    # ChromaDB server mode (leave empty to use local PersistentClient)
    chroma_host: str = ""
    chroma_port: int = 8000

    # Redis session cache (leave empty to disable)
    redis_url: str = ""

    # Qdrant Cloud (leave empty to use local ChromaDB)
    qdrant_url: str = ""
    qdrant_api_key: str = ""

    # Groq (leave empty to use Ollama)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # API
    cors_origins: list[str] = []

    # Auth
    auth_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    # Encryption
    encryption_key: str = ""

    # Eval
    kg_contribution_threshold: float = 0.85
    eval_judge_backend: str = "heuristic"
    judge_circuit_breaker_failures: int = 3
    judge_circuit_breaker_timeout: int = 300

    model_config = SettingsConfigDict(
        # Base .env first, then env-specific overrides (e.g. .env.production)
        env_file=(".env", f".env.{_APP_ENV}"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
