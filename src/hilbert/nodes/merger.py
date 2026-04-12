"""Merger node for Hilbert."""

import uuid
from typing import List

from hilbert.models import Paper
from hilbert.state.research import ResearchState


def deduplicate_papers(papers: List[Paper]) -> List[Paper]:
    """Deduplicate papers by DOI or arXiv ID."""
    seen = set()
    unique = []

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
    """Rank papers by basic relevance (citation count + recency)."""
    def score(paper: Paper) -> float:
        s = paper.citation_count * 0.1
        if paper.published_date:
            import datetime
            try:
                age = (datetime.datetime.now().date() - paper.published_date).days
                s += max(0, 1 - age / 3650)
            except Exception:
                pass
        return s

    return sorted(papers, key=score, reverse=True)


async def merger_node(state: ResearchState) -> dict:
    """Dedup, rank, and decide next phase."""
    papers = state.get("papers", [])
    query = state["query"]
    round_num = state["round"]
    max_rounds = state["max_rounds"]

    papers = deduplicate_papers(papers)
    papers = rank_papers(papers, query)

    top_k = 20
    papers = papers[:top_k]

    if round_num >= max_rounds:
        next_status = "synthesizing"
    else:
        next_status = "searching"

    return {
        "papers": papers,
        "round": round_num + 1,
        "status": next_status,
    }


def create_merger_node():
    """Create merger node function."""
    return merger_node