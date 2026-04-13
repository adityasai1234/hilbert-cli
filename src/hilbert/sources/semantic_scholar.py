"""Semantic Scholar API client for Hilbert."""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional
import aiohttp

from hilbert.models.paper import Author, Paper


SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1"


class SemanticScholarError(Exception):
    """Semantic Scholar API error."""
    pass


class SemanticScholarClient:
    """Semantic Scholar API client."""

    MAX_RESULTS = 25

    def __init__(self, api_key: Optional[str] = None, max_results: int = 25):
        self.api_key = api_key or os.getenv("SEMANTIC_SCHOLAR_API_KEY")
        self.max_results = max_results
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            headers = {}
            if self.api_key:
                headers["x-api-key"] = self.api_key
            self._session = aiohttp.ClientSession(headers=headers)
        return self._session

    async def close(self) -> None:
        """Close the session."""
        if self._session and not self._session.closed:
            await self._session.close()

    def _parse_paper(self, data: Dict[str, Any]) -> Paper:
        """Parse Semantic Scholar paper data."""
        paper_id = data.get("paperId", f"sem-{data.get('paperId', '')}")

        title = data.get("title", "Untitled")
        abstract = data.get("abstract", "")

        authors = []
        for author in data.get("authors", []):
            name = author.get("name", "")
            if name:
                authors.append(Author(name=name))

        year = data.get("year")
        published_date = None
        if year:
            try:
                published_date = datetime.strptime(str(year), "%Y").date()
            except ValueError:
                pass

        url = data.get("url", "")
        if not url and paper_id:
            url = f"https://www.semanticscholar.org/paper/{paper_id}"

        venue = data.get("venue", "")

        doi = data.get("doi", "")

        citation_count = data.get("citationCount", 0)

        is_open = data.get("isOpenAccess", False)

        return Paper(
            paper_id=paper_id,
            title=title,
            abstract=abstract,
            authors=authors,
            published_date=published_date,
            url=url,
            doi=doi,
            venue=venue,
            citation_count=citation_count,
            is_open_access=is_open,
        )

    async def search(
        self,
        query: str,
        max_results: Optional[int] = None,
        year_from: Optional[int] = None,
    ) -> List[Paper]:
        """Search Semantic Scholar for papers.

        Args:
            query: Search terms.
            max_results: Maximum number of results.
            year_from: If given, restrict results to papers published in this
                year or later.  Passed as the ``year`` range parameter
                (e.g. ``year_from=2023`` → ``year=2023-``).
        """
        max_results = max_results or self.max_results

        params: Dict[str, Any] = {
            "query": query,
            "limit": max_results,
            "fields": "title,abstract,authors,year,url,venue,doi,citationCount,isOpenAccess",
        }

        if year_from is not None:
            params["year"] = f"{year_from}-"

        url = f"{SEMANTIC_SCHOLAR_API_URL}/paper/search"

        try:
            session = await self._get_session()
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    text = await response.text()
                    raise SemanticScholarError(f"Semantic Scholar API error: {response.status}: {text}")

                data = await response.json()

            papers = []
            for item in data.get("data", []):
                paper = self._parse_paper(item)
                papers.append(paper)

            return papers

        except SemanticScholarError:
            raise
        except Exception as e:
            raise SemanticScholarError(f"Failed to search Semantic Scholar: {e}") from e

    async def get_paper(self, paper_id: str) -> Optional[Paper]:
        """Get a specific paper by ID."""
        url = f"{SEMANTIC_SCHOLAR_API_URL}/paper/{paper_id}"

        params = {
            "fields": "title,abstract,authors,year,url,venue,doi,citationCount,isOpenAccess",
        }

        try:
            session = await self._get_session()
            async with session.get(url, params=params) as response:
                if response.status == 404:
                    return None
                if response.status != 200:
                    raise SemanticScholarError(f"Semantic Scholar API error: {response.status}")

                data = await response.json()
                return self._parse_paper(data)

        except SemanticScholarError:
            raise
        except Exception as e:
            raise SemanticScholarError(f"Failed to get paper: {e}") from e

    async def get_citations(self, paper_id: str, limit: int = 10) -> List[Paper]:
        """Get papers citing the given paper."""
        url = f"{SEMANTIC_SCHOLAR_API_URL}/paper/{paper_id}/citations"

        params = {
            "limit": limit,
            "fields": "title,abstract,authors,year,url,venue,doi,citationCount",
        }

        try:
            session = await self._get_session()
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    return []

                data = await response.json()

            papers = []
            for cite in data.get("data", []):
                citing_paper = cite.get("citingPaper", {})
                if citing_paper:
                    paper = self._parse_paper(citing_paper)
                    papers.append(paper)

            return papers

        except Exception:
            return []


    async def get_references(self, paper_id: str, limit: int = 20) -> list[str]:
        """Return Semantic Scholar paper IDs that this paper cites (references).

        Returns a list of paperId strings, not full Paper objects, to keep
        this cheap — we only need IDs for the within-corpus citation graph.
        """
        url = f"{SEMANTIC_SCHOLAR_API_URL}/paper/{paper_id}/references"
        params = {"limit": limit, "fields": "paperId"}

        try:
            session = await self._get_session()
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    return []
                data = await response.json()
            return [
                ref["citedPaper"]["paperId"]
                for ref in data.get("data", [])
                if ref.get("citedPaper", {}).get("paperId")
            ]
        except Exception:
            return []


_client: Optional[SemanticScholarClient] = None


def get_semantic_scholar_client() -> SemanticScholarClient:
    """Get Semantic Scholar client singleton."""
    global _client
    if _client is None:
        _client = SemanticScholarClient()
    return _client


def set_semantic_scholar_client(client: SemanticScholarClient) -> None:
    """Set Semantic Scholar client singleton."""
    global _client
    _client = client