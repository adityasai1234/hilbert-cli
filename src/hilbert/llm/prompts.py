"""Prompt templates for Hilbert agent nodes."""

from typing import Optional


PLANNER_SYSTEM = """You are the Planner node of Hilbert, a research agent.
Your task is to decompose a research query into sub-questions AND define four
research dimensions that will each be searched in parallel with a different strategy.

Research dimensions must use exactly these four strategies:
- "recent"       — papers from the last 2 years, ArXiv-heavy
- "foundational" — high-citation classic papers, Semantic Scholar focus
- "applied"      — experimental/benchmark papers, augment query with "experiment evaluation benchmark"
- "survey"       — review and survey papers, augment query with "survey review overview"

Output ONLY a valid JSON object. No other text."""


PLANNER_USER = """Decompose this research query into {n} sub-questions and four research dimensions:

{query}

Output format:
{{
  "sub_questions": ["sub-question 1", "sub-question 2", ...],
  "dimensions": [
    {{"label": "recent advances", "focus": "brief focus description", "strategy": "recent", "time_range": "2023-2025"}},
    {{"label": "foundational work", "focus": "brief focus description", "strategy": "foundational", "time_range": "all"}},
    {{"label": "applied methods", "focus": "brief focus description", "strategy": "applied", "time_range": "all"}},
    {{"label": "surveys and reviews", "focus": "brief focus description", "strategy": "survey", "time_range": "all"}}
  ]
}}"""


SYNTHESIS_SYSTEM = """You are the Synthesis node of Hilbert, a research agent.
Your task is to extract key findings from research papers based on the user's query.
Each finding should be:
- A specific claim or fact from the papers
- Grounded in evidence from at least one paper
- Relevant to the original query

Output ONLY a JSON array of findings, one per line. No other text."""


SYNTHESIS_USER = """Extract key findings from these papers for the query: "{query}"

Papers:
{papers}

Output format:
[{{
  "claim": "finding statement",
  "source_paper_id": "paper-id",
  "evidence_text": "relevant excerpt from paper"
}}, ...]"""


REVIEWER_SYSTEM = """You are the Reviewer node of Hilbert, a research agent.
You enforce five integrity rules on every research output:

  1. EVIDENCE REQUIRED — every factual claim must be grounded in at least one source.
     Flag any claim with no paper_id as FATAL.
  2. SINGLE-SOURCE RISK — critical or surprising claims backed by only one paper
     are fragile. Flag these as MAJOR.
  3. LOW CONFIDENCE — claims with confidence < 0.6 are weakly supported.
     Flag these as MAJOR unless they are clearly hedged.
  4. COVERAGE GAPS — sub-questions left unanswered or only partially answered
     are MAJOR gaps.
  5. CONTRADICTIONS — findings that directly contradict each other without
     acknowledgement are MAJOR or FATAL depending on centrality.

Severity levels:
  FATAL  — output cannot be trusted without fixing this
  MAJOR  — significant quality issue, must be noted in the report
  MINOR  — worth noting but does not undermine the report

Output ONLY a valid JSON object. No other text."""


REVIEWER_USER = """Review this research output for integrity and coverage.

Query: "{query}"
Sub-questions that should be answered: {sub_questions}

Verified findings (each has confidence 0-1 and is_verified flag):
{findings}

Already-detected contradictions (LLM-confirmed opposing claim pairs):
{contradictions}

Output format:
{{
  "gaps": [
    {{
      "description": "what is missing or wrong",
      "severity": "FATAL|MAJOR|MINOR",
      "affected_finding_ids": ["finding-id or empty list"]
    }}
  ],
  "single_source_claims": ["finding_id"],
  "unresolved_contradictions": ["brief description of any contradiction not yet addressed"]
}}"""


WRITER_SYSTEM = """You are the Writer node of Hilbert, a research agent.
Your task is to synthesise verified research findings into a high-quality report.

Citation rules (MANDATORY):
- Every factual claim MUST end with an inline citation: [N] where N is the
  citation_number from the sources list.
- Use [N, M] for claims supported by multiple sources.
- Never invent a citation number that is not in the provided sources.
- Unsourced claims must NOT appear in the report.

Structure:
1. ## Executive Summary  (2-3 sentences, no citations needed)
2. ## [Thematic Section] (repeat as needed, with inline [N] citations)
3. Do NOT include a References section — it is added automatically.

Output ONLY the markdown body (sections 1-2). No preamble, no trailing notes."""


WRITER_USER = """Write a research report for: "{query}"

Verified findings (each has a citation_number for inline [N] use):
{findings}

Numbered sources:
{sources}

Remember: cite every factual claim with [N] from the citation_number field."""


def get_planner_prompt(query: str, n: int = 4) -> tuple[str, str]:
    """Get planner prompts."""
    return PLANNER_SYSTEM, PLANNER_USER.format(n=n, query=query)


def get_dimensions_fallback(query: str) -> list[dict]:
    """Return default research dimensions when LLM parse fails."""
    return [
        {"label": "recent advances", "focus": query, "strategy": "recent", "time_range": "2023-2025"},
        {"label": "foundational work", "focus": query, "strategy": "foundational", "time_range": "all"},
        {"label": "applied methods", "focus": query, "strategy": "applied", "time_range": "all"},
        {"label": "surveys and reviews", "focus": query, "strategy": "survey", "time_range": "all"},
    ]


def get_synthesis_prompt(query: str, papers: list[dict]) -> tuple[str, str]:
    """Get synthesis prompts."""
    papers_text = "\n\n".join(
        f"Paper: {p.get('title', 'Unknown')}\n{p.get('abstract', 'No abstract')}"
        for p in papers
    )
    return SYNTHESIS_SYSTEM, SYNTHESIS_USER.format(query=query, papers=papers_text)


def get_reviewer_prompt(
    query: str,
    sub_questions: list[str],
    findings: list[dict],
    contradictions: list[dict] | None = None,
) -> tuple[str, str]:
    """Get reviewer prompts, optionally including detected contradictions."""
    import json
    sq_text = "\n".join(f"- {sq}" for sq in sub_questions)
    findings_text = json.dumps(findings, indent=2)
    contradictions_text = json.dumps(contradictions or [], indent=2)

    return REVIEWER_SYSTEM, REVIEWER_USER.format(
        query=query,
        sub_questions=sq_text,
        findings=findings_text,
        contradictions=contradictions_text,
    )


def get_writer_prompt(
    query: str,
    findings: list[dict],
    sources: list[dict],
    title_suggestions: Optional[str] = None,
) -> tuple[str, str]:
    """Get writer prompts with inline citation numbering."""
    import json as _json

    findings_text = _json.dumps(
        [
            {
                "citation_number": f.get("citation_number", "?"),
                "claim": f.get("claim", ""),
                "confidence": round(f.get("confidence", 0.0), 2),
                "is_verified": f.get("is_verified", False),
            }
            for f in findings
        ],
        indent=2,
    )

    sources_text = "\n".join(
        f"[{s.get('citation_number', i+1)}] {s.get('title', 'Unknown')} "
        f"— {', '.join(s.get('authors', [])[:2])} ({s.get('published_date', 'n.d.')})"
        for i, s in enumerate(sources)
    )

    return WRITER_SYSTEM, WRITER_USER.format(
        query=query,
        findings=findings_text,
        sources=sources_text,
    )