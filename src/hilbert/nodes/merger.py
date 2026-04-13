"""Merger node for Hilbert."""

import asyncio
import datetime
from typing import Dict, List, Optional

from hilbert.config.settings import get_settings
from hilbert.models import Paper
from hilbert.sources import cosine_similarity, embed_papers, get_embedding_client
from hilbert.sources.semantic_scholar import get_semantic_scholar_client
from hilbert.state.research import ResearchState

# Cosine similarity threshold above which two papers are near-duplicates
_SEMANTIC_DEDUP_THRESHOLD = 0.92

# Centroid similarity above which we consider findings converged and stop early
_CONVERGENCE_THRESHOLD = 0.90

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


def rank_papers(
    papers: List[Paper],
    query: str,
    citation_graph: Optional[Dict[str, List[str]]] = None,
) -> List[Paper]:
    """Rank papers by citation count, recency, source quality tier, and within-corpus authority.

    Within-corpus authority: how many other papers in the result set cite this
    paper.  Each in-corpus citation adds +1.5 to the score, making topically
    central papers rise above globally popular-but-off-topic ones.
    """
    now = datetime.datetime.now().date()

    # Build reverse-index: paper_id → how many corpus papers cite it
    in_corpus_cited_by: Dict[str, int] = {}
    if citation_graph:
        for cited_list in citation_graph.values():
            for cited_id in cited_list:
                in_corpus_cited_by[cited_id] = in_corpus_cited_by.get(cited_id, 0) + 1

    def score(paper: Paper) -> float:
        s = paper.citation_count * 0.1
        if paper.published_date:
            try:
                age_days = (now - paper.published_date).days
                s += max(0.0, 1.0 - age_days / 3650)
            except Exception:
                pass
        s += _TIER_SCORE[source_quality_tier(paper)]
        # Within-corpus authority boost (1.5 per in-corpus citation)
        s += in_corpus_cited_by.get(paper.paper_id, 0) * 1.5
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


async def build_citation_graph(papers: List[Paper]) -> Dict[str, List[str]]:
    """Build a within-corpus citation graph.

    For each paper that has a Semantic Scholar paper_id, fetch the IDs of
    papers it references.  Filter those IDs to only those present in the
    current corpus so the graph represents intra-corpus connections only.

    Returns {paper_id: [cited_paper_ids_in_corpus]}.
    """
    corpus_ids: set = {p.paper_id for p in papers if p.paper_id}
    if not corpus_ids:
        return {}

    client = get_semantic_scholar_client()

    async def _fetch(paper: Paper) -> tuple[str, List[str]]:
        try:
            refs = await client.get_references(paper.paper_id, limit=50)
            in_corpus = [r for r in refs if r in corpus_ids]
            return paper.paper_id, in_corpus
        except Exception:
            return paper.paper_id, []

    results = await asyncio.gather(*[_fetch(p) for p in papers if p.paper_id])
    return {pid: cited for pid, cited in results if cited}


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

    # Build citation graph on the post-dedup pool (before top-k trim) so we
    # capture intra-corpus links among all unique candidates.
    citation_graph = await build_citation_graph(papers)

    # Rank with within-corpus authority boost, then MMR-trim to top_k.
    papers = rank_papers(papers, query, citation_graph=citation_graph)

    top_k = settings.top_k
    papers = await mmr_select(papers, query, k=top_k, lam=settings.mmr_lambda)

    if callback:
        callback("merger", {
            "papers_before_dedup": before_exact,
            "papers_after_filter": len(papers),
            "citation_edges": sum(len(v) for v in citation_graph.values()),
        })

    # --- Convergence detection ---
    # Embed current findings (from prior round), compare centroid to last round.
    # If the research "stopped moving", skip further rounds.
    prev_centroid: Optional[List[float]] = state.get("findings_centroid")
    findings = state.get("findings", [])
    new_centroid: Optional[List[float]] = None
    converged = False

    if findings:
        try:
            emb_client = get_embedding_client()
            claim_embs = await emb_client.embed_texts([f.claim for f in findings])
            import numpy as np
            new_centroid = np.mean(claim_embs, axis=0).tolist()

            if prev_centroid is not None:
                sim = cosine_similarity(new_centroid, prev_centroid)
                if sim >= _CONVERGENCE_THRESHOLD:
                    converged = True
        except Exception:
            pass

    if round_num >= max_rounds or converged:
        next_status = "synthesizing"
    else:
        next_status = "searching"

    if callback:
        callback("merger", {
            "papers_before_dedup": before_exact,
            "papers_after_filter": len(papers),
            "converged": converged,
        })

    return {
        "papers": papers,
        "round": round_num + 1,
        "status": next_status,
        "findings_centroid": new_centroid,
        "converged": converged,
        "citation_graph": citation_graph,
    }


def create_merger_node():
    """Create merger node function."""
    return merger_node