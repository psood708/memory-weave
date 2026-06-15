import pytest


def _ollama_running() -> bool:
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:11434", timeout=1)
        return True
    except Exception:
        return False


@pytest.fixture
def require_ollama():
    if not _ollama_running():
        pytest.skip("Ollama not running (start with `ollama serve`)")
