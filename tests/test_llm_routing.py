from unittest.mock import patch, MagicMock
from memoryweave.models.config_repo import UserModelConfig
from memoryweave.core.llm import get_llm


def _hf_config(model="Qwen/Qwen2.5-7B-Instruct", key="hf_test"):
    return UserModelConfig(
        user_id="u1", provider="huggingface",
        chat_model=model, embedding_model=None,
        judge_model=None, hf_api_key=key,
    )


def test_get_llm_uses_ollama_by_default():
    with patch("memoryweave.core.llm.ChatOllama") as mock:
        get_llm()
        mock.assert_called_once()


def test_get_llm_uses_hf_when_config_provided():
    with patch("memoryweave.core.llm.HuggingFaceEndpoint") as mock_ep, \
         patch("memoryweave.core.llm.ChatHuggingFace") as mock_chat:
        mock_ep.return_value = MagicMock()
        get_llm(user_config=_hf_config())
        mock_ep.assert_called_once()
        assert mock_ep.call_args.kwargs["repo_id"] == "Qwen/Qwen2.5-7B-Instruct"
        assert mock_ep.call_args.kwargs["huggingfacehub_api_token"] == "hf_test"
