"""ArXiv API client for Hilbert."""

import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
import xml.etree.ElementTree as ET

import aiohttp

from hilbert.models.paper import Author, Paper


ARXIV_API_URL = "http://export.arxiv.org/api/query"


class ArXivError(Exception):
    """ArXiv API error."""
    pass


class ArXivClient:
    """ArXiv API client."""

    MAX_RESULTS = 30
    DELAY_SECONDS = 3

    def __init__(self, max_results: int = 30):
        self.max_results = max_results
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self) -> None:
        """Close the session."""
        if self._session and not self._session.closed:
            await self._session.close()

    def _parse_entry(self, entry: ET.Element) -> Optional[Paper]:
        """Parse an ArXiv entry into a Paper."""
        try:
            namespace = {"atom": "http://www.w3.org/2005/Atom"}

            title = entry.find("atom:title", namespace)
            title = title.text.strip() if title is not None else "Untitled"

            summary = entry.find("atom:summary", namespace)
            abstract = summary.text.strip() if summary is not None else ""

            authors = []
            for author in entry.findall("atom:author", namespace):
                name = author.find("atom:name", namespace)
                if name is not None:
                    authors.append(Author(name=name.text.strip()))

            published = entry.find("atom:published", namespace)
            published_date = None
            if published is not None:
                try:
                    published_date = datetime.strptime(published.text[:10], "%Y-%m-%d").date()
                except ValueError:
                    pass

            link = entry.find("atom:id", namespace)
            url = link.text.strip() if link is not None else ""

            arxiv_id = ""
            if link is not None:
                match = re.search(r"(\d+\.\d+)", link.text)
                if match:
                    arxiv_id = match.group(1)

            paper_id = f"arxiv-{arxiv_id}" if arxiv_id else f"arxiv-{int(time.time())}"

            category = entry.find("arxiv:primary_category", namespace)
            venue = category.attrib.get("term", "arXiv") if category is not None else "arXiv"

            return Paper(
                paper_id=paper_id,
                title=title,
                abstract=abstract,
                authors=authors,
                published_date=published_date,
                url=url,
                arxiv_id=arxiv_id,
                venue=venue,
            )

        except Exception as e:
            return None

    async def search(
        self,
        query: str,
        max_results: Optional[int] = None,
    ) -> List[Paper]:
        """Search ArXiv for papers."""
        max_results = max_results or self.max_results

        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": max_results,
            "sortBy": "relevance",
            "sortOrder": "descending",
        }

        url = f"{ARXIV_API_URL}?{urlencode(params)}"

        try:
            session = await self._get_session()
            async with session.get(url) as response:
                if response.status != 200:
                    raise ArXivError(f"ArXiv API error: {response.status}")

                text = await response.text()
                root = ET.fromstring(text)

            namespace = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/atom/v1"}
            entries = root.findall(".//atom:entry", namespace)

            papers = []
            for entry in entries:
                paper = self._parse_entry(entry)
                if paper:
                    papers.append(paper)

            await asyncio.sleep(self.DELAY_SECONDS)

            return papers

        except ArXivError:
            raise
        except Exception as e:
            raise ArXivError(f"Failed to search ArXiv: {e}") from e

    async def get_paper(self, arxiv_id: str) -> Optional[Paper]:
        """Get a specific paper by ArXiv ID."""
        papers = await self.search(f"id:{arxiv_id}", max_results=1)
        return papers[0] if papers else None


import asyncio


_client: Optional[ArXivClient] = None


def get_arxiv_client() -> ArXivClient:
    """Get ArXiv client singleton."""
    global _client
    if _client is None:
        _client = ArXivClient()
    return _client


def set_arxiv_client(client: ArXivClient) -> None:
    """Set ArXiv client singleton."""
    global _client
    _client = client