"""Session and state models for Hilbert."""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    """Status of a research session."""

    PLANNING = "planning"
    SEARCHING = "searching"
    MERGING = "merging"
    SYNTHESIZING = "synthesizing"
    REVIEWING = "reviewing"
    VERIFYING = "verifying"
    WRITING = "writing"
    DONE = "done"
    ERROR = "error"


class Session(BaseModel):
    """Research session stored in SQLite."""

    session_id: str
    query: str
    max_rounds: int = 3
    current_round: int = 0
    status: SessionStatus = SessionStatus.PLANNING
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    error_message: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    def is_resumable(self) -> bool:
        """Check if session can be resumed."""
        return self.status not in (SessionStatus.DONE, SessionStatus.ERROR)


class Checkpoint(BaseModel):
    """State checkpoint for session resume."""

    checkpoint_id: int = 0
    session_id: str
    round: int
    state_json: str
    created_at: datetime = Field(default_factory=datetime.now)