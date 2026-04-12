"""Search node for Hilbert."""

import uuid
from typing import List

from hilbert.models import Paper
from hilbert.sources import get_arxiv_client, get_semantic_scholar_client
from hilbert.state.research import ResearchState


async def search_agent(sub_question: str) -> List[Paper]:
    """Search for papers matching a sub-question."""
    papers = []

    try:
        arxiv_client = get_arxiv_client()
        arxiv_papers = await arxiv_client.search(sub_question, max_results=10)
        papers.extend(arxiv_papers)
    except Exception:
        pass

    try:
        semantic_client = get_semantic_scholar_client()
        semantic_papers = await semantic_client.search(sub_question, max_results=10)
        papers.extend(semantic_papers)
    except Exception:
        pass

    return papers


async def search_node(state: ResearchState) -> dict:
    """Execute search for sub-questions."""
    sub_questions = state.get("sub_questions", [])
    all_papers = []

    for sq in sub_questions:
        try:
            papers = await search_agent(sq)
            all_papers.extend(papers)
        except Exception:
            continue

    return {
        "papers": all_papers,
        "status": "merging",
    }


def create_search_node():
    """Create search node function."""
    return search_node