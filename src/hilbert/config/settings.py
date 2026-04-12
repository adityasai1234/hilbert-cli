"""Configuration models for Hilbert."""

from pathlib import Path
from typing import Literal, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class HilbertSettings(BaseSettings):
    """Main configuration for Hilbert."""

    model_config = SettingsConfigDict(
        env_prefix="HILBERT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Research settings
    max_rounds: int = Field(default=3, description="Default research rounds")
    sub_questions: int = Field(default=4, description="Default parallel sub-questions")
    top_k: int = Field(default=20, description="Papers to retain after merger")
    confidence_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    sub_questions_mode: Literal["fixed", "auto"] = Field(default="fixed")

    # Model settings
    model: str = Field(default="openai/gpt-4o")
    embedding_model: str = Field(default="openai/text-embedding-3-small")
    
    # API keys (set via environment)
    litellm_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    # Paths
    output_dir: Path = Field(default=Path("outputs"))
    log_dir: Path = Field(default=Path("logs"))
    db_path: Path = Field(default=Path("hilbert.db"))

    # Logging
    log_level: str = Field(default="INFO")
    verbose: bool = False

    def ensure_dirs(self) -> None:
        """Ensure output directories exist."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)


def get_settings() -> HilbertSettings:
    """Get Hilbert settings singleton."""
    return HilbertSettings()