"""SQLite database schema for Hilbert."""

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, Text, create_engine, LargeBinary
from sqlalchemy.orm import DeclarativeBase, Session as SqlSession


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""

    pass


class SessionTable(Base):
    """Research sessions table."""

    __tablename__ = "sessions"

    session_id = Column(String, primary_key=True)
    query = Column(Text, nullable=False)
    max_rounds = Column(Integer, default=3)
    current_round = Column(Integer, default=0)
    status = Column(String, default="planning")
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    last_searched_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)  # list of tag strings, e.g. ["important", "review"]


class PaperTable(Base):
    """Papers table."""

    __tablename__ = "papers"

    paper_id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False)
    title = Column(Text, nullable=False)
    abstract = Column(Text)
    authors = Column(JSON)
    published_date = Column(String, nullable=True)
    url = Column(String)
    arxiv_id = Column(String, nullable=True)
    doi = Column(String, nullable=True)
    venue = Column(String, nullable=True)
    citation_count = Column(Integer, default=0)
    is_open_access = Column(Boolean, default=True)


class FindingTable(Base):
    """Findings table."""

    __tablename__ = "findings"

    finding_id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False)
    claim = Column(Text, nullable=False)
    source_paper_id = Column(String, nullable=False)
    evidence_text = Column(Text)
    confidence = Column(Float, default=0.0)
    is_verified = Column(Boolean, default=False)


class CheckpointTable(Base):
    """State checkpoints table."""

    __tablename__ = "checkpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False)
    round = Column(Integer, nullable=False)
    state_json = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)


class EmbeddingCacheTable(Base):
    """Embedding vectors cached by SHA-256 hash of the source text.

    Keyed on content_hash so the same abstract embedded for two different
    sessions is only sent to the API once.
    """

    __tablename__ = "embedding_cache"

    content_hash = Column(String(64), primary_key=True)  # SHA-256 hex
    text_preview = Column(String(120), nullable=True)     # first 120 chars for debugging
    embedding = Column(Text, nullable=False)              # JSON-encoded float list
    model = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)


def get_engine(db_path: str = "hilbert.db"):
    """Create database engine."""
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(engine)
    return engine


def init_db(db_path: str = "hilbert.db") -> None:
    """Initialize database tables."""
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)