"""Finding models for Hilbert."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Finding(BaseModel):
    """A finding extracted from a paper during research."""

    finding_id: str
    claim: str = Field(description="The claim or finding statement")
    source_paper_id: str = Field(description="ID of the source paper")
    evidence_text: str = Field(description="Text from paper supporting the claim")
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score from verifier (0.0-1.0)"
    )
    created_at: datetime = Field(default_factory=datetime.now)
    is_verified: bool = False

    def confidence_label(self) -> str:
        """Human-readable confidence label."""
        if self.confidence >= 0.9:
            return "high"
        elif self.confidence >= 0.75:
            return "medium"
        elif self.confidence > 0:
            return "low"
        return "unverified"


class Gap(BaseModel):
    """A gap in coverage identified by the reviewer."""

    gap_id: str
    description: str
    sub_question: Optional[str] = None
    severity: str = "minor"  # minor, major, critical
    related_findings: list[str] = Field(default_factory=list)