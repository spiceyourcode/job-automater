"""Embedding helpers — dim gate, no live API."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from lib.embeddings import EMBED_DIM, embed_texts, vector_literal


def test_vector_literal_rejects_wrong_dim():
    assert vector_literal([0.1, 0.2]) is None
    assert vector_literal(None) is None


def test_vector_literal_1536():
    vec = [0.01] * EMBED_DIM
    lit = vector_literal(vec)
    assert lit is not None
    assert lit.startswith("[")
    assert lit.count(",") == EMBED_DIM - 1


def test_embed_texts_empty_without_keys():
    with patch("lib.embeddings.settings") as s:
        s.openai_api_key = ""
        s.google_api_key = ""
        assert embed_texts(["hello"]) == [None]


def test_embed_texts_openai_batch():
    fake_vec = [0.0] * EMBED_DIM
    fake_vec[0] = 1.0
    payload = {
        "data": [{"index": 0, "embedding": fake_vec}, {"index": 1, "embedding": fake_vec}],
        "usage": {"total_tokens": 8},
    }
    mock_res = MagicMock()
    mock_res.json.return_value = payload
    mock_res.raise_for_status = MagicMock()

    with (
        patch("lib.embeddings.settings") as s,
        patch("lib.embeddings.httpx.Client") as client_cls,
    ):
        s.openai_api_key = "sk-test"
        s.google_api_key = ""
        client_cls.return_value.__enter__.return_value.post.return_value = mock_res
        out = embed_texts(["a", "b"])
    assert len(out) == 2
    assert out[0] is not None
    assert len(out[0]) == EMBED_DIM
