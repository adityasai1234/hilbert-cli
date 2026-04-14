import { getSettings } from "../config";

export const PLANNER_SYSTEM = `You are the Planner node of Hilbert, a research agent.
Your task is to decompose a research query into sub-questions AND define four
research dimensions that will each be searched in parallel with a different strategy.

Research dimensions must use exactly these four strategies:
- "recent"       — papers from the last 2 years, ArXiv-heavy
- "foundational" — high-citation classic papers, Semantic Scholar focus
- "applied"      — experimental/benchmark papers, augment query with "experiment evaluation benchmark"
- "survey"       — review and survey papers, augment query with "survey review overview"

Output ONLY a valid JSON object. No other text.`;

export const PLANNER_USER = `Decompose this research query into {n} sub-questions and four research dimensions:

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
}}`;

export const SYNTHESIS_SYSTEM = `You are the Synthesis node of Hilbert, a research agent.
Your task is to extract key findings from research papers based on the user's query.
Each finding should be:
- A specific claim or fact from the papers
- Grounded in evidence from at least one paper
- Relevant to the original query

Output ONLY a JSON array of findings, one per line. No other text.`;

export const SYNTHESIS_USER = `Extract key findings from these papers for the query: "{query}"

Papers:
{papers}

Output format:
[{{
  "claim": "finding statement",
  "source_paper_id": "paper-id",
  "evidence_text": "relevant excerpt from paper"
}}, ...]`;

export const REVIEWER_SYSTEM = `You are the Reviewer node of Hilbert, a research agent.
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

Output ONLY a valid JSON object. No other text.`;

export const REVIEWER_USER = `Review this research output for integrity and coverage.

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
}}`;

export const WRITER_SYSTEM = `You are the Writer node of Hilbert, a research agent.
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

Output ONLY the markdown body (sections 1-2). No preamble, no trailing notes.`;

export const WRITER_USER = `Write a research report for: "{query}"

Verified findings (each has a citation_number for inline [N] use):
{findings}

Numbered sources:
{sources}

Remember: cite every factual claim with [N] from the citation_number field.`;

export const HYPOTHESIS_SYSTEM = `You are the Hypothesis node of Hilbert, a research agent.
Given a set of verified research findings, generate 3-5 novel hypotheses or open
research questions that follow naturally from the evidence but are not yet answered.

Each hypothesis should:
- Build on at least one specific finding
- Identify a gap, tension, or logical extension in the current evidence
- Be testable or researchable in principle
- Be distinct from the other hypotheses

Output ONLY a valid JSON array. No other text.`;

export const HYPOTHESIS_USER = `Generate 3-5 novel hypotheses for this research topic: "{query}"

Verified findings:
{findings}

Output format:
[{{
  "text": "hypothesis or open research question",
  "basis": "brief rationale referencing specific findings",
  "related_finding_ids": ["finding_id_1", "finding_id_2"],
  "confidence": 0.0
}}]

Set confidence to a float 0-1 indicating how plausible the hypothesis is given
the evidence (1.0 = very strongly implied, 0.5 = speculative but reasonable).`;

export const CONTRADICTION_CONFIRM_SYSTEM = `You are a research integrity checker.
You will be given two research claims. Decide if they genuinely contradict
each other — i.e., one asserts something that the other explicitly denies.
Answer with a JSON object: {"contradicts": true/false, "explanation": "..."}
Output ONLY the JSON. No other text.`;

export function getPlannerPrompt(query: string, n?: number): [string, string] {
  const num = n || getSettings().subQuestions;
  return [
    PLANNER_SYSTEM,
    PLANNER_USER.replace("{n}", String(num)).replace("{query}", query),
  ];
}

export function getDimensionsFallback(query: string): ResearchDimension[] {
  return [
    { label: "recent advances", focus: query, strategy: "recent", time_range: "2023-2025" },
    { label: "foundational work", focus: query, strategy: "foundational", time_range: "all" },
    { label: "applied methods", focus: query, strategy: "applied", time_range: "all" },
    { label: "surveys and reviews", focus: query, strategy: "survey", time_range: "all" },
  ];
}

export function getSynthesisPrompt(query: string, papers: Record<string, unknown>[]): [string, string] {
  const papersText = papers
    .map((p) => `Paper: ${p.title || "Unknown"}\n${p.abstract || "No abstract"}`)
    .join("\n\n");
  return [
    SYNTHESIS_SYSTEM,
    SYNTHESIS_USER.replace("{query}", query).replace("{papers}", papersText),
  ];
}

export function getReviewerPrompt(
  query: string,
  subQuestions: string[],
  findings: Record<string, unknown>[],
  contradictions?: Record<string, unknown>[]
): [string, string] {
  const sqText = subQuestions.map((sq) => `- ${sq}`).join("\n");
  const findingsText = JSON.stringify(findings, null, 2);
  const contradictionsText = JSON.stringify(contradictions || [], null, 2);

  return [
    REVIEWER_SYSTEM,
    REVIEWER_USER.replace("{query}", query)
      .replace("{sub_questions}", sqText)
      .replace("{findings}", findingsText)
      .replace("{contradictions}", contradictionsText),
  ];
}

export function getWriterPrompt(
  query: string,
  findings: Record<string, unknown>[],
  sources: Record<string, unknown>[]
): [string, string] {
  const findingsText = JSON.stringify(
    findings.map((f) => ({
      citation_number: f.citation_number || "?",
      claim: f.claim || "",
      confidence: Math.round((f.confidence as number) || 0 * 100) / 100,
      is_verified: f.is_verified || false,
    })),
    null,
    2
  );

  const sourcesText = sources
    .map((s, i) => {
      const citationNumber = s.citation_number || i + 1;
      const title = s.title || "Unknown";
      const authors = (s.authors as string[])?.slice(0, 2).join(", ") || "Unknown";
      const year = s.published_date || "n.d.";
      return `[${citationNumber}] ${title} — ${authors} (${year})`;
    })
    .join("\n");

  return [
    WRITER_SYSTEM,
    WRITER_USER.replace("{query}", query)
      .replace("{findings}", findingsText)
      .replace("{sources}", sourcesText),
  ];
}

export function getHypothesisPrompt(
  query: string,
  findings: Record<string, unknown>[]
): [string, string] {
  const verifiedFindings = findings.filter((f) => f.is_verified);
  const findingsText = JSON.stringify(
    verifiedFindings.map((f) => ({
      finding_id: f.finding_id || "",
      claim: f.claim || "",
      confidence: Math.round((f.confidence as number) || 0 * 100) / 100,
    })),
    null,
    2
  );

  return [
    HYPOTHESIS_SYSTEM,
    HYPOTHESIS_USER.replace("{query}", query).replace("{findings}", findingsText),
  ];
}

export interface ResearchDimension {
  label: string;
  focus: string;
  strategy: "recent" | "foundational" | "applied" | "survey";
  time_range: string;
}