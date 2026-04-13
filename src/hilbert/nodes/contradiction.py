"""Contradiction detection node for Hilbert.

Two-pass pipeline:
  Pass 1 — pairwise cosine similarity between claim embeddings.
            Any pair with similarity < CONTRADICTION_THRESHOLD is flagged.
  Pass 2 — LLM confirmation: for each flagged pair, ask the LLM whether
            the claims genuinely contradict each other or are merely about
            different aspects. Only confirmed pairs are kept.
"""

import asyncio
import uuid
from typing import List, Tuple

from hilbert.llm import get_client
from hilbert.models.finding import Contradiction, Finding
from hilbert.sources import cosine_similarity, get_embedding_client
from hilbert.state.research import ResearchState

# Cosine similarity below which two claims are suspected contradictories
_CONTRADICTION_THRESHOLD = 0.15
# Maximum pairs to send for LLM confirmation (cost guard)
_MAX_LLM_PAIRS = 10

_CONFIRM_SYSTEM = """You are a research integrity checker.
You will be given two research claims. Decide if they genuinely contradict
each other — i.e., one asserts something that the other explicitly denies.
Answer with a JSON object: {"contradicts": true/false, "explanation": "..."}
Output ONLY the JSON. No other text."""


async def _detect_pairs(findings: List[Finding]) -> List[Tuple[int, int, float]]:
    """Return (i, j, similarity) for pairs with similarity < threshold."""
    if len(findings) < 2:
        return []

    try:
        client = get_embedding_client()
        embs = await client.embed_texts([f.claim for f in findings])
    except Exception:
        return []

    pairs = []
    for i in range(len(findings)):
        for j in range(i + 1, len(findings)):
            sim = cosine_similarity(embs[i], embs[j])
            if sim < _CONTRADICTION_THRESHOLD:
                pairs.append((i, j, sim))

    # Sort by similarity ascending (most contradictory first)
    pairs.sort(key=lambda t: t[2])
    return pairs[:_MAX_LLM_PAIRS]


async def _confirm_pair(
    finding_a: Finding, finding_b: Finding, similarity: float
) -> Contradiction:
    """Ask LLM whether two claims genuinely contradict; return Contradiction."""
    contradiction = Contradiction(
        contradiction_id=f"contra-{uuid.uuid4().hex[:8]}",
        finding_id_a=finding_a.finding_id,
        finding_id_b=finding_b.finding_id,
        claim_a=finding_a.claim,
        claim_b=finding_b.claim,
        similarity=similarity,
        confirmed=False,
    )

    prompt = (
        f'Claim A: "{finding_a.claim}"\n'
        f'Claim B: "{finding_b.claim}"\n\n'
        "Do these claims genuinely contradict each other?"
    )

    try:
        from hilbert.llm.utils import parse_json_object
        client = get_client()
        content = await client.complete_text(
            prompt=prompt,
            system_prompt=_CONFIRM_SYSTEM,
        )
        result = parse_json_object(content)
        if result:
            contradiction.confirmed = bool(result.get("contradicts", False))
            contradiction.description = str(result.get("explanation", ""))
    except Exception:
        pass

    return contradiction


async def contradiction_node(state: ResearchState) -> dict:
    """Detect and LLM-confirm contradictions between synthesised findings."""
    findings: List[Finding] = state.get("findings", [])
    callback = state.get("progress_callback")

    if callback:
        callback("contradiction", {"findings": len(findings)})

    if len(findings) < 2:
        return {"contradictions": [], "status": "verifying"}

    # Pass 1 — embedding-based detection
    suspect_pairs = await _detect_pairs(findings)

    if not suspect_pairs:
        return {"contradictions": [], "status": "verifying"}

    # Pass 2 — LLM confirmation (concurrent)
    tasks = [
        _confirm_pair(findings[i], findings[j], sim)
        for i, j, sim in suspect_pairs
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    contradictions: List[Contradiction] = [
        r for r in results
        if isinstance(r, Contradiction) and r.confirmed
    ]

    return {"contradictions": contradictions, "status": "verifying"}


def create_contradiction_node():
    """Create contradiction node function."""
    return contradiction_node
