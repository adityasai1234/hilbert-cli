"""Synthesis node for Hilbert.

Pipeline:
  1. Abstract compression — extract top-3 sentences per abstract by
     cosine similarity to the query embedding (no LLM call).
  2. Chunked synthesis — split papers into batches of CHUNK_SIZE and
     run synthesis LLM calls concurrently via asyncio.gather.
  3. Finding deduplication — embed all claims, merge any pair with
     cosine similarity > FINDING_DEDUP_THRESHOLD.
"""

import asyncio
import re
import uuid
from typing import List

from hilbert.llm import get_client, get_synthesis_prompt
from hilbert.llm.utils import parse_json_list
from hilbert.models import Finding, Paper
from hilbert.sources import cosine_similarity, get_embedding_client
from hilbert.state.research import ResearchState

_CHUNK_SIZE = 4               # papers per synthesis LLM call
_FINDING_DEDUP_THRESHOLD = 0.88   # claim similarity above which findings are merged
_TOP_SENTENCES = 3            # sentences to keep per abstract after compression


# ---------------------------------------------------------------------------
# Step 1 — Abstract compression
# ---------------------------------------------------------------------------

def _split_sentences(text: str) -> List[str]:
    """Split text into sentences using punctuation heuristics."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 20]


async def _compress_abstracts(papers: List[Paper], query: str) -> List[dict]:
    """Return paper_data dicts with abstracts compressed to top-N sentences."""
    try:
        client = get_embedding_client()
        query_emb = (await client.embed_texts([query]))[0]

        compressed = []
        for paper in papers:
            sentences = _split_sentences(paper.abstract or "")
            if len(sentences) <= _TOP_SENTENCES:
                compressed.append({
                    "paper_id": paper.paper_id,
                    "title": paper.title,
                    "abstract": paper.abstract,
                })
                continue

            sent_embs = await client.embed_texts(sentences)
            scored = sorted(
                zip(sentences, sent_embs),
                key=lambda t: cosine_similarity(t[1], query_emb),
                reverse=True,
            )
            top_sentences = [s for s, _ in scored[:_TOP_SENTENCES]]
            compressed.append({
                "paper_id": paper.paper_id,
                "title": paper.title,
                "abstract": " ".join(top_sentences),
            })
        return compressed

    except Exception:
        # Fallback: return uncompressed
        return [
            {"paper_id": p.paper_id, "title": p.title, "abstract": p.abstract}
            for p in papers
        ]


# ---------------------------------------------------------------------------
# Step 2 — Chunked synthesis
# ---------------------------------------------------------------------------

async def _synthesise_chunk(query: str, chunk: List[dict]) -> List[Finding]:
    """Run one synthesis LLM call for a chunk of papers."""
    system_prompt, user_prompt = get_synthesis_prompt(query, chunk)
    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )
        findings_data = parse_json_list(content)
        return [
            Finding(
                finding_id=f"finding-{uuid.uuid4().hex[:8]}",
                claim=fd.get("claim", ""),
                source_paper_id=fd.get("source_paper_id", ""),
                evidence_text=fd.get("evidence_text", ""),
            )
            for fd in findings_data
            if fd.get("claim")
        ]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Step 3 — Finding deduplication via claim embeddings
# ---------------------------------------------------------------------------

async def _dedup_findings(findings: List[Finding]) -> List[Finding]:
    """Merge near-duplicate findings (claim similarity > threshold).

    Keeps the finding with the higher confidence; concatenates evidence
    texts so no supporting detail is lost.
    """
    if len(findings) < 2:
        return findings

    try:
        client = get_embedding_client()
        claim_embs = await client.embed_texts([f.claim for f in findings])
    except Exception:
        return findings

    n = len(findings)
    merged_into: List[int] = list(range(n))  # union-find (flat)

    for i in range(n):
        for j in range(i + 1, n):
            if merged_into[j] != j:
                continue
            if cosine_similarity(claim_embs[i], claim_embs[j]) >= _FINDING_DEDUP_THRESHOLD:
                # Merge j into i — keep whichever has higher confidence
                if findings[j].confidence > findings[i].confidence:
                    findings[i].confidence = findings[j].confidence
                    findings[i].claim = findings[j].claim
                findings[i].evidence_text = (
                    findings[i].evidence_text + " " + findings[j].evidence_text
                ).strip()
                merged_into[j] = i

    return [f for i, f in enumerate(findings) if merged_into[i] == i]


# ---------------------------------------------------------------------------
# Main node
# ---------------------------------------------------------------------------

async def synthesis_node(state: ResearchState) -> dict:
    """Compress abstracts, chunk-synthesise in parallel, dedup findings."""
    query = state["query"]
    papers = state.get("papers", [])

    callback = state.get("progress_callback")
    if callback:
        callback("synthesis", {"papers": len(papers)})

    if not papers:
        return {"findings": [], "status": "verifying"}

    # Step 1: compress abstracts
    paper_data = await _compress_abstracts(papers, query)

    # Step 2: chunked parallel synthesis
    chunks = [
        paper_data[i: i + _CHUNK_SIZE]
        for i in range(0, len(paper_data), _CHUNK_SIZE)
    ]
    chunk_results = await asyncio.gather(
        *[_synthesise_chunk(query, chunk) for chunk in chunks],
        return_exceptions=True,
    )
    all_findings: List[Finding] = []
    for result in chunk_results:
        if isinstance(result, list):
            all_findings.extend(result)

    # Step 3: dedup by claim similarity
    findings = await _dedup_findings(all_findings)

    return {
        "findings": findings,
        "status": "verifying",
    }


def create_synthesis_node():
    """Create synthesis node function."""
    return synthesis_node