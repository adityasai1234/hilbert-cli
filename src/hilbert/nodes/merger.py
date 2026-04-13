"""Merger node for Hilbert."""

import datetime
from typing import List

from hilbert.config.settings import get_settings
from hilbert.models import Paper
from hilbert.sources import cosine_similarity, embed_papers, get_embedding_client
from hilbert.state.research import ResearchState

# Cosine similarity threshold above which two papers are near-duplicates
_SEMANTIC_DEDUP_THRESHOLD = 0.92

# Source quality tiers used in ranking (higher = better)
# Tier 1: published in a venue with a DOI — peer-reviewed
# Tier 2: ArXiv preprint (no DOI, has arxiv_id)
# Tier 3: unknown provenance
_TIER_SCORE = {1: 2.0, 2: 1.0, 3: 0.0}


def source_quality_tier(paper: Paper) -> int:
    """Return quality tier 1-3 for a paper."""
    if paper.doi:
        return 1
    if paper.arxiv_id:
        return 2
    return 3


def deduplicate_papers(papers: List[Paper]) -> List[Paper]:
    """Deduplicate papers by DOI or arXiv ID."""
    seen: set = set()
    unique: List[Paper] = []

    for paper in papers:
        key = None
        if paper.doi:
            key = f"doi:{paper.doi}"
        elif paper.arxiv_id:
            key = f"arxiv:{paper.arxiv_id}"

        if key and key not in seen:
            seen.add(key)
            unique.append(paper)
        elif not key:
            unique.append(paper)

    return unique


def rank_papers(papers: List[Paper], query: str) -> List[Paper]:
    """Rank papers by citation count, recency, and source quality tier."""
    now = datetime.datetime.now().date()

    def score(paper: Paper) -> float:
        s = paper.citation_count * 0.1
        if paper.published_date:
            try:
                age_days = (now - paper.published_date).days
                s += max(0.0, 1.0 - age_days / 3650)
            except Exception:
                pass
        s += _TIER_SCORE[source_quality_tier(paper)]
        return s

    return sorted(papers, key=score, reverse=True)


async def semantic_deduplicate(papers: List[Paper]) -> List[Paper]:
    """Remove near-duplicate papers using abstract embedding similarity.

    After exact dedup, embed all remaining abstracts and drop any paper
    whose embedding is within _SEMANTIC_DEDUP_THRESHOLD of a higher-ranked
    paper (by citation count). O(n²) on the post-exact-dedup list which is
    typically 30-60 papers — acceptable cost.
    """
    if len(papers) < 2:
        return papers

    try:
        client = get_embedding_client()
        embeddings = await embed_papers(papers, client)
    except Exception:
        return papers  # fall back gracefully

    # Sort by citation count descending so we keep the better-cited version
    indexed = sorted(enumerate(papers), key=lambda t: t[1].citation_count, reverse=True)
    kept_indices: List[int] = []
    kept_embeddings: List[List[float]] = []

    for orig_idx, paper in indexed:
        emb = embeddings[orig_idx]
        is_dup = any(
            cosine_similarity(emb, kept_emb) >= _SEMANTIC_DEDUP_THRESHOLD
            for kept_emb in kept_embeddings
        )
        if not is_dup:
            kept_indices.append(orig_idx)
            kept_embeddings.append(emb)

    # Preserve original ordering among kept papers
    kept_set = set(kept_indices)
    return [p for i, p in enumerate(papers) if i in kept_set]


async def mmr_select(
    papers: List[Paper],
    query: str,
    k: int,
    lam: float = 0.6,
) -> List[Paper]:
    """Select k papers via Maximum Marginal Relevance.

    Balances relevance to the query (weight λ) against diversity from
    already-selected papers (weight 1-λ). Falls back to score-ranked
    top-k if embedding fails.
    """
    if len(papers) <= k:
        return papers

    try:
        client = get_embedding_client()
        paper_embs = await embed_papers(papers, client)
        query_embs = await client.embed_texts([query])
        query_emb = query_embs[0]
    except Exception:
        return papers[:k]

    relevance = [cosine_similarity(e, query_emb) for e in paper_embs]

    selected_indices: List[int] = []
    remaining = list(range(len(papers)))

    while len(selected_indices) < k and remaining:
        best_idx = None
        best_score = float("-inf")

        for i in remaining:
            rel = lam * relevance[i]
            if selected_indices:
                max_sim = max(
                    cosine_similarity(paper_embs[i], paper_embs[j])
                    for j in selected_indices
                )
                div = (1 - lam) * max_sim
            else:
                div = 0.0
            score = rel - div
            if score > best_score:
                best_score = score
                best_idx = i

        if best_idx is not None:
            selected_indices.append(best_idx)
            remaining.remove(best_idx)

    return [papers[i] for i in selected_indices]


async def merger_node(state: ResearchState) -> dict:
    """Exact dedup → semantic dedup → rank → MMR select → decide next phase."""
    settings = get_settings()
    papers = state.get("papers", [])
    query = state["query"]
    round_num = state["round"]
    max_rounds = state["max_rounds"]
    callback = state.get("progress_callback")

    before_exact = len(papers)
    papers = deduplicate_papers(papers)
    papers = await semantic_deduplicate(papers)
    papers = rank_papers(papers, query)

    top_k = settings.top_k
    papers = await mmr_select(papers, query, k=top_k, lam=settings.mmr_lambda)

    if callback:
        callback("merger", {
            "papers_before_dedup": before_exact,
            "papers_after_filter": len(papers),
        })

    next_status = "synthesizing" if round_num >= max_rounds else "searching"

    return {
        "papers": papers,
        "round": round_num + 1,
        "status": next_status,
    }


def create_merger_node():
    """Create merger node function."""
    return merger_node