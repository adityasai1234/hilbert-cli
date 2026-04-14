import { getClient } from "../llm/client";
import { getReviewerPrompt } from "../llm/prompts";
import { parseJsonObject } from "../llm/utils";
import type { ResearchState } from "../state";
import type { Gap } from "../models/finding";

const VALID_SEVERITIES = new Set(["FATAL", "MAJOR", "MINOR", "minor", "major", "critical"]);
const SEVERITY_MAP: Record<string, string> = { critical: "FATAL", major: "MAJOR", minor: "MINOR" };

function normaliseSeverity(raw: string): string {
  const upper = raw.toUpperCase();
  if (VALID_SEVERITIES.has(upper)) {
    return SEVERITY_MAP[upper.toLowerCase()] || upper;
  }
  return "MINOR";
}

export async function reviewerNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { query, subQuestions, findings, contradictions } = state;

  const callback = state.progressCallback;
  if (callback) {
    callback("reviewer", { findings: findings.length });
  }

  const findingsData = findings.map((f) => ({
    finding_id: f.finding_id,
    claim: f.claim,
    source_paper_id: f.source_paper_id,
    confidence: Math.round(f.confidence * 1000) / 1000,
    is_verified: f.is_verified,
  }));

  const contradictionsData = contradictions.map((c) => ({
    claim_a: c.claim_a,
    claim_b: c.claim_b,
    similarity: Math.round(c.similarity * 1000) / 1000,
    description: c.description,
    severity: c.similarity < 0.05 ? "FATAL" : c.similarity < 0.1 ? "MAJOR" : "MINOR",
  }));

  const [systemPrompt, userPrompt] = getReviewerPrompt(query, subQuestions, findingsData, contradictionsData);

  const gaps: Gap[] = [];
  try {
    const client = getClient();
    const content = await client.completeText(userPrompt, systemPrompt);

    const gapData = parseJsonObject(content);
    const gapList = (gapData?.gaps as Record<string, unknown>[]) || [];

    for (const gd of gapList) {
      const severityRaw = (gd.severity as string) || "MINOR";
      gaps.push({
        gap_id: `gap-${Math.random().toString(36).slice(2, 10)}`,
        description: (gd.description as string) || "",
        severity: normaliseSeverity(severityRaw) as "minor" | "major" | "critical",
        related_findings: (gd.affected_finding_ids as string[]) || [],
      });
    }
  } catch {
    // ignore
  }

  return {
    gaps,
    status: "writing" as const,
  };
}

export function createReviewerNode() {
  return reviewerNode;
}