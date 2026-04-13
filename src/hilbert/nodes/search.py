"""Search node for Hilbert — parallel dimension fan-out."""

import asyncio
from typing import Dict, List, Optional

from hilbert.models import Paper
from hilbert.sources import get_arxiv_client, get_semantic_scholar_client
from hilbert.state.research import ResearchDimension, ResearchState

# Keywords appended to queries per strategy
_STRATEGY_AUGMENTS: Dict[str, str] = {
    "applied": "experiment evaluation benchmark",
    "survey": "survey review overview",
}

# ArXiv date filter suffix per strategy (empty = no filter)
_ARXIV_DATE_FILTER: Dict[str, str] = {
    "recent": " AND submittedDate:[20230101 TO *]",
}


from datetime import datetime


def _augment_query(base: str, strategy: str) -> str:
    """Append strategy-specific keywords to the search query."""
    suffix = _STRATEGY_AUGMENTS.get(strategy, "")
    return f"{base} {suffix}".strip() if suffix else base


async def _search_arxiv(
    query: str, strategy: str, max_results: int = 12, submitted_after: Optional[datetime] = None
) -> List[Paper]:
    """Search ArXiv with optional strategy filtering."""
    q = _augment_query(query, strategy) + _ARXIV_DATE_FILTER.get(strategy, "")
    try:
        client = get_arxiv_client()
        return await client.search(q, max_results=max_results, submitted_after=submitted_after)
    except Exception:
        return []


async def _search_semantic(
    query: str, strategy: str, max_results: int = 12, year_from: Optional[int] = None
) -> List[Paper]:
    """Search Semantic Scholar, applying citation-sort for foundational strategy."""
    q = _augment_query(query, strategy)
    try:
        client = get_semantic_scholar_client()
        sort = "citationCount" if strategy == "foundational" else None
        kwargs = {"sort": sort} if sort else {}
        return await client.search(q, max_results=max_results, year_from=year_from, **kwargs)
    except Exception:
        return []


async def _search_dimension(
    dim: ResearchDimension, base_query: str, submitted_after: Optional[datetime] = None
) -> List[Paper]:
    """Run both ArXiv and Semantic Scholar for a single dimension in parallel."""
    strategy = dim.get("strategy", "recent")
    focus = dim.get("focus") or base_query
    query = f"{base_query} {focus}".strip() if focus != base_query else base_query

    year_from = submitted_after.year if submitted_after else None
    arxiv_papers, semantic_papers = await asyncio.gather(
        _search_arxiv(query, strategy, submitted_after=submitted_after),
        _search_semantic(query, strategy, year_from=year_from),
    )
    return arxiv_papers + semantic_papers


async def search_node(state: ResearchState) -> dict:
    """Fan-out search across sub-questions and research dimensions in parallel."""
    query = state["query"]
    sub_questions: List[str] = state.get("sub_questions", [query])
    dimensions: List[ResearchDimension] = state.get("research_dimensions", [])
    incremental_since = state.get("incremental_since")

    callback = state.get("progress_callback")
    if callback:
        callback("search", {"status": "searching", "dimensions": len(dimensions)})

    # Build tasks: one per sub-question (plain search) + one per dimension
    tasks = [_search_arxiv(sq, "recent", max_results=12, submitted_after=incremental_since) for sq in sub_questions]
    tasks += [_search_dimension(dim, query, incremental_since) for dim in dimensions]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_papers: List[Paper] = []
    papers_consulted = 0
    for r in results:
        if isinstance(r, list):
            papers_consulted += len(r)
            all_papers.extend(r)

    return {
        "papers": all_papers,
        "papers_consulted": papers_consulted,
        "status": "merging",
    }


def create_search_node():
    """Create search node function."""
    return search_node