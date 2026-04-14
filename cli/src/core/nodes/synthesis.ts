import { getClient } from "../llm/client";
import { getSynthesisPrompt } from "../llm/prompts";
import { parseJsonList } from "../llm/utils";
import { getEmbeddingClient, cosineSimilarity } from "../sources/embeddings";
import { FINDING_DEDUP_THRESHOLD, CHUNK_SIZE } from "../constants";
import type { ResearchState } from "../state";
import type { Paper } from "../models/paper";
import type { Finding } from "../models/finding";

const TOP_SENTENCES = 3;

function splitSentences(text: string): string[] {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.map((s) => s.trim()).filter((s) => s.length > 20);
}

async function compressAbstracts(papers: Paper[], query: string): Promise<{ paper_id: string; title: string; abstract: string }[]> {
  try {
    const client = getEmbeddingClient();
    const queryEmbeds = await client.embedTexts([query]);
    const queryEmb = queryEmbeds[0];

    const compressed: { paper_id: string; title: string; abstract: string }[] = [];

    for (const paper of papers) {
      const sentences = splitSentences(paper.abstract || "");
      if (sentences.length <= TOP_SENTENCES) {
        compressed.push({
          paper_id: paper.paper_id,
          title: paper.title,
          abstract: paper.abstract,
        });
        continue;
      }

      const sentEmbeds = await client.embedTexts(sentences);
      const scored = sentences
        .map((s, i) => ({ text: s, emb: sentEmbeds[i] }))
        .sort((a, b) => cosineSimilarity(b.emb, queryEmb) - cosineSimilarity(a.emb, queryEmb));

      const topSentences = scored.slice(0, TOP_SENTENCES).map((s) => s.text);
      compressed.push({
        paper_id: paper.paper_id,
        title: paper.title,
        abstract: topSentences.join(" "),
      });
    }

    return compressed;
  } catch {
    return papers.map((p) => ({
      paper_id: p.paper_id,
      title: p.title,
      abstract: p.abstract,
    }));
  }
}

async function synthesiseChunk(
  query: string,
  chunk: { paper_id: string; title: string; abstract: string }[]
): Promise<Finding[]> {
  const [systemPrompt, userPrompt] = getSynthesisPrompt(query, chunk);
  try {
    const client = getClient();
    const content = await client.completeText(userPrompt, systemPrompt);
    const findingsData = parseJsonList(content);

    return findingsData
      .filter((fd) => (fd as Record<string, unknown>).claim)
      .map((fd) => {
        const f = fd as Record<string, unknown>;
        return {
          finding_id: `finding-${Math.random().toString(36).slice(2, 10)}`,
          claim: f.claim as string,
          source_paper_id: f.source_paper_id as string,
          evidence_text: f.evidence_text as string,
          confidence: 0,
          is_verified: false,
          created_at: new Date().toISOString(),
        } as Finding;
      });
  } catch {
    return [];
  }
}

async function dedupFindings(findings: Finding[]): Promise<Finding[]> {
  if (findings.length < 2) return findings;

  try {
    const client = getEmbeddingClient();
    const claimEmbeds = await client.embedTexts(findings.map((f) => f.claim));

    const n = findings.length;
    const mergedInto = Array.from({ length: n }, (_, i) => i);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (mergedInto[j] !== j) continue;
        if (cosineSimilarity(claimEmbeds[i], claimEmbeds[j]) >= FINDING_DEDUP_THRESHOLD) {
          if (findings[j].confidence > findings[i].confidence) {
            findings[i].confidence = findings[j].confidence;
            findings[i].claim = findings[j].claim;
          }
          findings[i].evidence_text = [findings[i].evidence_text, findings[j].evidence_text]
            .filter(Boolean)
            .join(" ")
            .trim();
          mergedInto[j] = i;
        }
      }
    }

    return findings.filter((_, i) => mergedInto[i] === i);
  } catch {
    return findings;
  }
}

export async function synthesisNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { query, papers } = state;

  const callback = state.progressCallback;
  if (callback) {
    callback("synthesis", { papers: papers.length });
  }

  if (!papers.length) {
    return { findings: [], status: "verifying" as const };
  }

  const paperData = await compressAbstracts(papers, query);

  const chunks: { paper_id: string; title: string; abstract: string }[][] = [];
  for (let i = 0; i < paperData.length; i += CHUNK_SIZE) {
    chunks.push(paperData.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => synthesiseChunk(query, chunk))
  );

  const allFindings: Finding[] = chunkResults.flat();

  const findings = await dedupFindings(allFindings);

  return {
    findings,
    status: "verifying" as const,
  };
}

export function createSynthesisNode() {
  return synthesisNode;
}