import { getSettings } from "../config";
import { getEmbeddingClient } from "../sources/embeddings";
import type { ResearchState } from "../state";
import type { Finding } from "../models/finding";

export async function verifierNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const settings = getSettings();
  const threshold = settings.confidenceThreshold;

  const findings = state.findings;
  const papers = state.papers;

  if (!findings.length || !papers.length) {
    return { findings, status: "writing" as const };
  }

  const paperMap = new Map(papers.map((p) => [p.paper_id, p]));

  try {
    const embClient = getEmbeddingClient();

    const claimTexts = findings.map((f) => f.claim);
    const contextTexts = findings.map((f) => f.evidence_text);

    const similarities = await embClient.computeSimilarities(claimTexts, contextTexts);

    for (let i = 0; i < findings.length; i++) {
      if (i < similarities.length) {
        findings[i].confidence = similarities[i];
      }
      findings[i].is_verified = findings[i].confidence >= threshold;
    }
  } catch {
    for (const finding of findings) {
      finding.is_verified = false;
      finding.confidence = 0.5;
    }
  }

  return {
    findings,
    status: "writing" as const,
  };
}

export function createVerifierNode() {
  return verifierNode;
}