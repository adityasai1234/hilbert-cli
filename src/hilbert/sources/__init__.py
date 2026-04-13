"""Data sources for Hilbert."""

from hilbert.sources.arxiv import ArXivClient, ArXivError, get_arxiv_client
from hilbert.sources.semantic_scholar import (
    SemanticScholarClient,
    SemanticScholarError,
    get_semantic_scholar_client,
)
from hilbert.sources.embeddings import (
    EmbeddingClient,
    cosine_similarity,
    compute_similarities,
    embed_papers,
    get_embedding_client,
)

__all__ = [
    "ArXivClient",
    "ArXivError",
    "get_arxiv_client",
    "SemanticScholarClient",
    "SemanticScholarError",
    "get_semantic_scholar_client",
    "EmbeddingClient",
    "cosine_similarity",
    "compute_similarities",
    "embed_papers",
    "get_embedding_client",
]