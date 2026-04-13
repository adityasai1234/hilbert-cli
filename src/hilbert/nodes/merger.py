"""Merger node for Hilbert."""

import datetime
from typing import List

from hilbert.models import Paper
from hilbert.state.research import ResearchState

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


async def merger_node(state: ResearchState) -> dict:
    """Dedup, rank by quality tier + citations, and decide next phase."""
    papers = state.get("papers", [])
    query = state["query"]
    round_num = state["round"]
    max_rounds = state["max_rounds"]

    callback = state.get("progress_callback")

    papers = deduplicate_papers(papers)
    papers = rank_papers(papers, query)

    top_k = 20
    papers = papers[:top_k]

    if callback:
        callback("merger", {"papers_after_filter": len(papers)})

    next_status = "synthesizing" if round_num >= max_rounds else "searching"

    return {
        "papers": papers,
        "round": round_num + 1,
        "status": next_status,
    }


def create_merger_node():
    """Create merger node function."""
    return merger_node