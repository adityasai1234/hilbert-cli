"""Hypothesis model for Hilbert."""

from typing import List, Optional
from pydantic import BaseModel, Field
import uuid


class Hypothesis(BaseModel):
    """A novel hypothesis or open research question derived from verified findings."""

    hypothesis_id: str = Field(default_factory=lambda: f"hyp-{uuid.uuid4().hex[:8]}")
    text: str
    basis: str = ""                          # brief rationale, e.g. "gap between finding X and Y"
    related_finding_ids: List[str] = Field(default_factory=list)
    confidence: float = 0.5                  # 0-1, how plausible the LLM rates this hypothesis

    def to_dict(self) -> dict:
        return {
            "hypothesis_id": self.hypothesis_id,
            "text": self.text,
            "basis": self.basis,
            "related_finding_ids": self.related_finding_ids,
            "confidence": round(self.confidence, 3),
        }
