"""Paper models for Hilbert."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class Author(BaseModel):
    """Author of a paper."""

    name: str
    affiliation: Optional[str] = None
    author_id: Optional[str] = None


class Paper(BaseModel):
    """Academic paper from ArXiv or Semantic Scholar."""

    paper_id: str
    title: str
    abstract: str
    authors: list[Author]
    published_date: Optional[date] = None
    url: HttpUrl
    arxiv_id: Optional[str] = None
    doi: Optional[str] = None
    venue: Optional[str] = None
    citation_count: int = 0
    is_open_access: bool = True

    def citation_key(self) -> str:
        """Generate BibTeX citation key."""
        if self.doi:
            return self.doi.replace("/", "-").replace(".", "-")
        if self.arxiv_id:
            return f"arxiv-{self.arxiv_id}"
        return f"paper-{self.paper_id[:8]}"

    def to_bibtex(self) -> str:
        """Convert to BibTeX format."""
        first_author = self.authors[0].name.split()[-1] if self.authors else "Unknown"
        year = self.published_date.year if self.published_date else "n.d."
        key = f"{first_author}{year}"

        entries = [
            f"@article{{{key},",
            f"  author = {{{' and '.join(a.name for a in self.authors)}}},",
            f"  title = {{{self.title}}},",
        ]

        if self.venue:
            entries.append(f"  journal = {{{self.venue}}},")
        if self.published_date:
            entries.append(f"  year = {{{self.published_date.year}}},")
        if self.doi:
            entries.append(f"  doi = {{{self.doi}}},")
        if self.url:
            entries.append(f"  url = {{{self.url}}},")

        entries.append("}")
        return "\n".join(entries)