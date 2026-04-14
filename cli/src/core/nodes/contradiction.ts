import { getClient } from "../llm/client";
import { CONTRADICTION_CONFIRM_SYSTEM } from "../llm/prompts";
import { parseJsonObject } from "../llm/utils";
import { getEmbeddingClient, cosineSimilarity } from "../sources/embeddings";
import { CONTRADICTION_THRESHOLD, MAX_CONTRADICTION_PAIRS } from "../constants";
import type { ResearchState } from "../state";
import type { Finding, Contradiction } from "../models/finding";

async function detectPairs(findings: Finding[]): Promise<[number, number, number][]> {
  if (findings.length < 2) return [];

  try {
    const client = getEmbeddingClient();
    const embs = await client.embedTexts(findings.map((f) => f.claim));

    const pairs: [number, number, number][] = [];
    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const sim = cosineSimilarity(embs[i], embs[j]);
        if (sim < CONTRADICTION_THRESHOLD) {
          pairs.push([i, j, sim]);
        }
      }
    }

    pairs.sort((a, b) => a[2] - b[2]);
    return pairs.slice(0, MAX_CONTRADICTION_PAIRS);
  } catch {
    return [];
  }
}

async function confirmPair(
  findingA: Finding,
  findingB: Finding,
  similarity: number
): Promise<Contradiction> {
  const contradiction: Contradiction = {
    contradiction_id: `contra-${Math.random().toString(36).slice(2, 10)}`,
    finding_id_a: findingA.finding_id,
    finding_id_b: findingB.finding_id,
    claim_a: findingA.claim,
    claim_b: findingB.claim,
    similarity,
    description: "",
    confirmed: false,
    created_at: new Date().toISOString(),
  };

  const prompt = `Claim A: "${findingA.claim}"\nClaim B: "${findingB.claim}"\n\nDo these claims genuinely contradict each other?`;

  try {
    const client = getClient();
    const content = await client.completeText(prompt, CONTRADICTION_CONFIRM_SYSTEM);
    const result = parseJsonObject(content);

    if (result) {
      contradiction.confirmed = Boolean(result.contradicts);
      contradiction.description = String(result.explanation || "");
    }
  } catch {
    // ignore
  }

  return contradiction;
}

export async function contradictionNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { findings } = state;

  const callback = state.progressCallback;
  if (callback) {
    callback("contradiction", { findings: findings.length });
  }

  if (findings.length < 2) {
    return { contradictions: [], status: "verifying" as const };
  }

  const suspectPairs = await detectPairs(findings);

  if (!suspectPairs.length) {
    return { contradictions: [], status: "verifying" as const };
  }

  const tasks = suspectPairs.map(([i, j, sim]) =>
    confirmPair(findings[i], findings[j], sim)
  );

  const results = await Promise.all(tasks);

  const contradictions = results.filter((r) => r.confirmed);

  return { contradictions, status: "verifying" as const };
}

export function createContradictionNode() {
  return contradictionNode;
}