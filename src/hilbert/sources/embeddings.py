"""Embedding client for Hilbert relevance scoring."""

import os
from typing import List, Optional
import numpy as np

from hilbert.config.settings import get_settings


EmbeddingError = Exception


class EmbeddingClient:
    """Client for computing embeddings and similarity."""

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        settings = get_settings()
        self.model = model or settings.embedding_model
        self.api_key = api_key or os.getenv("HILBERT_EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY")
        self._client = None

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for texts."""
        if not texts:
            return []

        if self.model.startswith("openai"):
            return await self._embed_openai(texts)
        elif self.model.startswith("ollama"):
            return await self._embed_ollama(texts)
        else:
            return await self._embed_openai(texts)

    async def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings from OpenAI."""
        try:
            import openai

            client = openai.AsyncOpenAI(api_key=self.api_key)

            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=texts,
            )

            return [item.embedding for item in response.data]

        except Exception as e:
            raise EmbeddingError(f"OpenAI embedding failed: {e}") from e

    async def _embed_ollama(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings from Ollama."""
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                embeddings = []
                for text in texts:
                    async with session.post(
                        "http://localhost:11434/api/embeddings",
                        json={"model": "nomic-embed-text", "prompt": text},
                    ) as response:
                        if response.status != 200:
                            raise EmbeddingError(f"Ollama API error: {response.status}")
                        data = await response.json()
                        embeddings.append(data.get("embedding", []))
                return embeddings

        except Exception as e:
            raise EmbeddingError(f"Ollama embedding failed: {e}") from e


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b:
        return 0.0

    a = np.array(a)
    b = np.array(b)

    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


async def compute_similarities(
    claims: List[str],
    contexts: List[str],
    client: Optional[EmbeddingClient] = None,
) -> List[float]:
    """Compute cosine similarities between claims and contexts."""
    if not claims or not contexts:
        return []

    client = client or EmbeddingClient()

    claim_embeddings = await client.embed_texts(claims)
    context_embeddings = await client.embed_texts(contexts)

    similarities = []
    for claim_emb in claim_embeddings:
        best_sim = 0.0
        for ctx_emb in context_embeddings:
            sim = cosine_similarity(claim_emb, ctx_emb)
            if sim > best_sim:
                best_sim = sim
        similarities.append(best_sim)

    return similarities


async def embed_papers(papers: list, client: Optional[EmbeddingClient] = None) -> List[List[float]]:
    """Embed a list of Paper objects using title + abstract.

    Returns one embedding vector per paper, in the same order.
    Falls back to a zero vector on failure so callers don't need to handle None.
    """
    client = client or get_embedding_client()
    texts = [f"{p.title}. {p.abstract}"[:2000] for p in papers]  # cap at 2k chars
    try:
        return await client.embed_texts(texts)
    except Exception:
        dim = 1536  # text-embedding-3-small dimensionality
        return [[0.0] * dim for _ in papers]


_client: Optional[EmbeddingClient] = None


def get_embedding_client() -> EmbeddingClient:
    """Get embedding client singleton."""
    global _client
    if _client is None:
        _client = EmbeddingClient()
    return _client


def set_embedding_client(client: EmbeddingClient) -> None:
    """Set embedding client singleton."""
    global _client
    _client = client