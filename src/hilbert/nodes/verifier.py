"""Verifier node for Hilbert."""

from typing import List

from hilbert.config.settings import get_settings
from hilbert.models import Finding, Paper
from hilbert.sources import cosine_similarity, compute_similarities, get_embedding_client
from hilbert.state.research import ResearchState


async def verifier_node(state: ResearchState) -> dict:
    """Verify claims against paper abstracts with embeddings."""
    settings = get_settings()
    threshold = settings.confidence_threshold

    findings = state.get("findings", [])
    papers = state.get("papers", [])

    if not findings or not papers:
        return {
            "findings": findings,
            "status": "writing",
        }

    paper_map = {p.paper_id: p for p in papers}

    try:
        emb_client = get_embedding_client()

        claim_texts = [f.claim for f in findings]
        context_texts = [f.evidence_text for f in findings]

        similarities = await compute_similarities(
            claims=claim_texts,
            contexts=context_texts,
            client=emb_client,
        )

        for i, finding in enumerate(findings):
            if i < len(similarities):
                finding.confidence = similarities[i]

            finding.is_verified = finding.confidence >= threshold

    except Exception:
        for finding in findings:
            finding.is_verified = False
            finding.confidence = 0.5

    return {
        "findings": findings,
        "status": "writing",
    }


def create_verifier_node():
    """Create verifier node function."""
    return verifier_node