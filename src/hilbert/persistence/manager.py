"""Session manager for Hilbert SQLite persistence."""

import hashlib
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as SqlSession

from hilbert.config.settings import get_settings
from hilbert.models.session import Session, SessionStatus
from hilbert.models import Paper, Finding
from hilbert.state.research import ResearchState
from hilbert.persistence.schema import (
    get_engine, SessionTable, PaperTable, FindingTable,
    CheckpointTable, EmbeddingCacheTable,
)


class SessionManagerError(Exception):
    """Session manager error."""
    pass


class SessionManager:
    """Manages research sessions in SQLite."""

    def __init__(self, db_path: Optional[str] = None):
        settings = get_settings()
        self.db_path = str(db_path or settings.db_path)
        self.engine = get_engine(self.db_path)

    def create_session(self, query: str, max_rounds: int = 3) -> Session:
        """Create a new research session."""
        session_id = f"session-{uuid.uuid4().hex[:8]}"
        now = datetime.now()

        session = Session(
            session_id=session_id,
            query=query,
            max_rounds=max_rounds,
            current_round=0,
            status=SessionStatus.PLANNING,
            created_at=now,
            updated_at=now,
        )

        try:
            with SqlSession(self.engine) as db:
                db.add(SessionTable(
                    session_id=session.session_id,
                    query=session.query,
                    max_rounds=session.max_rounds,
                    current_round=session.current_round,
                    status=session.status.value,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                ))
                db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to create session: {e}") from e

        return session

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get session by ID."""
        try:
            with SqlSession(self.engine) as db:
                row = db.get(SessionTable, session_id)
                if not row:
                    return None
                return Session(
                    session_id=row.session_id,
                    query=row.query,
                    max_rounds=row.max_rounds,
                    current_round=row.current_round,
                    status=SessionStatus(row.status),
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                    error_message=row.error_message,
                )
        except Exception as e:
            raise SessionManagerError(f"Failed to get session: {e}") from e

    def list_sessions(self) -> List[Session]:
        """List all sessions."""
        try:
            with SqlSession(self.engine) as db:
                rows = db.execute(
                    select(SessionTable).order_by(SessionTable.created_at.desc())
                ).scalars().all()
                return [
                    Session(
                        session_id=r.session_id,
                        query=r.query,
                        max_rounds=r.max_rounds,
                        current_round=r.current_round,
                        status=SessionStatus(r.status),
                        created_at=r.created_at,
                        updated_at=r.updated_at,
                        error_message=r.error_message,
                    )
                    for r in rows
                ]
        except Exception as e:
            raise SessionManagerError(f"Failed to list sessions: {e}") from e

    def update_session(self, session: Session) -> None:
        """Update session status."""
        try:
            with SqlSession(self.engine) as db:
                row = db.get(SessionTable, session.session_id)
                if row:
                    row.status = session.status.value
                    row.current_round = session.current_round
                    row.updated_at = datetime.now()
                    row.error_message = session.error_message
                    db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to update session: {e}") from e

    def delete_session(self, session_id: str) -> None:
        """Delete a session and all related data."""
        try:
            with SqlSession(self.engine) as db:
                db.execute(delete(CheckpointTable).where(CheckpointTable.session_id == session_id))
                db.execute(delete(FindingTable).where(FindingTable.session_id == session_id))
                db.execute(delete(PaperTable).where(PaperTable.session_id == session_id))
                db.execute(delete(SessionTable).where(SessionTable.session_id == session_id))
                db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to delete session: {e}") from e

    def save_checkpoint(self, session_id: str, state: ResearchState) -> None:
        """Save state checkpoint."""
        now = datetime.now()
        try:
            state_json = json.dumps(state, default=str, sort_keys=True)
        except (TypeError, ValueError) as e:
            state_json = json.dumps({"error": str(e)}, default=str)

        try:
            with SqlSession(self.engine) as db:
                db.add(CheckpointTable(
                    session_id=session_id,
                    round=state.get("round", 0),
                    state_json=state_json,
                    created_at=now,
                ))
                db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to save checkpoint: {e}") from e

    def get_latest_checkpoint(self, session_id: str) -> Optional[ResearchState]:
        """Get latest checkpoint for session."""
        try:
            with SqlSession(self.engine) as db:
                row = db.execute(
                    select(CheckpointTable)
                    .where(CheckpointTable.session_id == session_id)
                    .order_by(CheckpointTable.round.desc())
                ).first()

                if row:
                    return json.loads(row.state_json)
        except Exception as e:
            raise SessionManagerError(f"Failed to get checkpoint: {e}") from e
        return None

    def save_papers(self, session_id: str, papers: List[Paper]) -> None:
        """Save papers for session."""
        try:
            with SqlSession(self.engine) as db:
                for paper in papers:
                    db.add(PaperTable(
                        paper_id=paper.paper_id,
                        session_id=session_id,
                        title=paper.title,
                        abstract=paper.abstract,
                        authors=[a.model_dump() for a in paper.authors],
                        published_date=str(paper.published_date) if paper.published_date else None,
                        url=str(paper.url),
                        arxiv_id=paper.arxiv_id,
                        doi=paper.doi,
                        venue=paper.venue,
                        citation_count=paper.citation_count,
                        is_open_access=paper.is_open_access,
                    ))
                db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to save papers: {e}") from e

    def get_papers(self, session_id: str) -> List[Paper]:
        """Get papers for session."""
        from hilbert.models.paper import Author

        try:
            with SqlSession(self.engine) as db:
                rows = db.execute(
                    select(PaperTable).where(PaperTable.session_id == session_id)
                ).scalars().all()

                return [
                    Paper(
                        paper_id=r.paper_id,
                        title=r.title,
                        abstract=r.abstract,
                        authors=[Author(**a) for a in (r.authors or [])],
                        published_date=r.published_date,
                        url=r.url,
                        arxiv_id=r.arxiv_id,
                        doi=r.doi,
                        venue=r.venue,
                        citation_count=r.citation_count,
                        is_open_access=r.is_open_access,
                    )
                    for r in rows
                ]
        except Exception as e:
            raise SessionManagerError(f"Failed to get papers: {e}") from e

    def save_findings(self, session_id: str, findings: List[Finding]) -> None:
        """Save findings for session."""
        try:
            with SqlSession(self.engine) as db:
                for finding in findings:
                    db.add(FindingTable(
                        finding_id=finding.finding_id,
                        session_id=session_id,
                        claim=finding.claim,
                        source_paper_id=finding.source_paper_id,
                        evidence_text=finding.evidence_text,
                        confidence=finding.confidence,
                        is_verified=finding.is_verified,
                    ))
                db.commit()
        except Exception as e:
            raise SessionManagerError(f"Failed to save findings: {e}") from e

    def get_findings(self, session_id: str) -> List[Finding]:
        """Get findings for session."""
        try:
            with SqlSession(self.engine) as db:
                rows = db.execute(
                    select(FindingTable).where(FindingTable.session_id == session_id)
                ).scalars().all()

                return [
                    Finding(
                        finding_id=r.finding_id,
                        claim=r.claim,
                        source_paper_id=r.source_paper_id,
                        evidence_text=r.evidence_text,
                        confidence=r.confidence,
                        is_verified=r.is_verified,
                    )
                    for r in rows
                ]
        except Exception as e:
            raise SessionManagerError(f"Failed to get findings: {e}") from e


class EmbeddingCache:
    """SQLite-backed cache for embedding vectors keyed on SHA-256(text)."""

    def __init__(self, db_path: Optional[str] = None):
        settings = get_settings()
        self.db_path = str(db_path or settings.db_path)
        self.engine = get_engine(self.db_path)
        self._model = settings.embedding_model

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[List[float]]:
        """Return cached embedding or None."""
        key = self._hash(text)
        try:
            with SqlSession(self.engine) as db:
                row = db.get(EmbeddingCacheTable, key)
                if row and row.model == self._model:
                    return json.loads(row.embedding)
        except Exception:
            pass
        return None

    def set(self, text: str, embedding: List[float]) -> None:
        """Persist an embedding vector."""
        key = self._hash(text)
        try:
            with SqlSession(self.engine) as db:
                existing = db.get(EmbeddingCacheTable, key)
                if existing:
                    return  # already cached
                db.add(EmbeddingCacheTable(
                    content_hash=key,
                    text_preview=text[:120],
                    embedding=json.dumps(embedding),
                    model=self._model,
                    created_at=datetime.now(),
                ))
                db.commit()
        except Exception:
            pass  # cache failures are non-fatal

    def get_batch(self, texts: List[str]) -> Dict[str, Optional[List[float]]]:
        """Return {text: embedding_or_None} for a batch of texts."""
        return {t: self.get(t) for t in texts}

    def set_batch(self, texts: List[str], embeddings: List[List[float]]) -> None:
        """Persist a batch of (text, embedding) pairs."""
        for text, emb in zip(texts, embeddings):
            self.set(text, emb)


_embedding_cache: Optional[EmbeddingCache] = None


def get_embedding_cache(db_path: Optional[str] = None) -> EmbeddingCache:
    """Get the embedding cache singleton."""
    global _embedding_cache
    if _embedding_cache is None:
        _embedding_cache = EmbeddingCache(db_path=db_path)
    return _embedding_cache


_manager: Optional[SessionManager] = None


def get_session_manager(db_path: Optional[str] = None) -> SessionManager:
    """Get session manager singleton."""
    global _manager
    if _manager is None:
        _manager = SessionManager(db_path=db_path)
    return _manager


def set_session_manager(manager: SessionManager) -> None:
    """Set session manager singleton."""
    global _manager
    _manager = manager