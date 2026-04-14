import { getSettings } from "../config";
import { getEmbeddingClient, cosineSimilarity } from "../sources/embeddings";
import { getSemanticScholarClient } from "../sources/semanticScholar";
import { SEMANTIC_DEDUP_THRESHOLD, CONVERGENCE_THRESHOLD, CITATION_AUTHORITY_WEIGHT, CHUNK_SIZE } from "../constants";
import type { ResearchState } from "../state";
import type { Paper } from "../models/paper";

const TIER_SCORE: Record<number, number> = { 1: 2.0, 2: 1.0, 3: 0.0 };

function sourceQualityTier(paper: Paper): number {
  if (paper.doi) return 1;
  if (paper.arxiv_id) return 2;
  return 3;
}

export function deduplicatePapers(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  const unique: Paper[] = [];

  for (const paper of papers) {
    let key: string | null = null;
    if (paper.doi) key = `doi:${paper.doi}`;
    else if (paper.arxiv_id) key = `arxiv:${paper.arxiv_id}`;

    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(paper);
    } else if (!key) {
      unique.push(paper);
    }
  }

  return unique;
}

export function rankPapers(
  papers: Paper[],
  _query: string,
  citationGraph?: Record<string, string[]>
): Paper[] {
  const now = new Date();

  const inCorpusCitedBy: Record<string, number> = {};
  if (citationGraph) {
    for (const citedList of Object.values(citationGraph)) {
      for (const citedId of citedList) {
        inCorpusCitedBy[citedId] = (inCorpusCitedBy[citedId] || 0) + 1;
      }
    }
  }

  function score(paper: Paper): number {
    let s = paper.citation_count * 0.1;

    if (paper.published_date) {
      try {
        const pubDate = new Date(paper.published_date);
        const ageDays = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
        s += Math.max(0, 1 - ageDays / 3650);
      } catch {
        // ignore
      }
    }

    s += TIER_SCORE[sourceQualityTier(paper)];
    s += (inCorpusCitedBy[paper.paper_id] || 0) * CITATION_AUTHORITY_WEIGHT;
    return s;
  }

  return [...papers].sort((a, b) => score(b) - score(a));
}

export async function semanticDeduplicate(papers: Paper[]): Promise<Paper[]> {
  if (papers.length < 2) return papers;

  try {
    const client = getEmbeddingClient();
    const embeddings = await client.embedPapers(papers);

    const indexed = papers
      .map((p, i) => ({ paper: p, idx: i, citations: p.citation_count }))
      .sort((a, b) => b.citations - a.citations);

    const keptIndices: number[] = [];
    const keptEmbeddings: number[][] = [];

    for (const { paper, idx } of indexed) {
      const emb = embeddings[idx];
      const isDup = keptEmbeddings.some((keptEmb) => cosineSimilarity(emb, keptEmb) >= SEMANTIC_DEDUP_THRESHOLD);
      if (!isDup) {
        keptIndices.push(idx);
        keptEmbeddings.push(emb);
      }
    }

    const keptSet = new Set(keptIndices);
    return papers.filter((_, i) => keptSet.has(i));
  } catch {
    return papers;
  }
}

export async function mmrSelect(
  papers: Paper[],
  query: string,
  k: number,
  lam: number = 0.6
): Promise<Paper[]> {
  if (papers.length <= k) return papers;

  try {
    const client = getEmbeddingClient();
    const paperEmbeds = await client.embedPapers(papers);
    const queryEmbeds = await client.embedTexts([query]);
    const queryEmb = queryEmbeds[0];

    const relevance = paperEmbeds.map((e) => cosineSimilarity(e, queryEmb));

    const selectedIndices: number[] = [];
    const remaining = papers.map((_, i) => i);

    while (selectedIndices.length < k && remaining.length > 0) {
      let bestIdx: number | null = null;
      let bestScore = -Infinity;

      for (const i of remaining) {
        const rel = lam * relevance[i];
        let div = 0;
        if (selectedIndices.length > 0) {
          const maxSim = Math.max(
            ...selectedIndices.map((j) => cosineSimilarity(paperEmbeds[i], paperEmbeds[j]))
          );
          div = (1 - lam) * maxSim;
        }
        const score = rel - div;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx !== null) {
        selectedIndices.push(bestIdx);
        const remIdx = remaining.indexOf(bestIdx);
        if (remIdx > -1) remaining.splice(remIdx, 1);
      }
    }

    return selectedIndices.map((i) => papers[i]);
  } catch {
    return papers.slice(0, k);
  }
}

export async function buildCitationGraph(papers: Paper[]): Promise<Record<string, string[]>> {
  const corpusIds = new Set(papers.map((p) => p.paper_id).filter(Boolean));
  if (corpusIds.size === 0) return {};

  const client = getSemanticScholarClient();

  const results = await Promise.all(
    papers
      .filter((p) => p.paper_id)
      .map(async (paper) => {
        try {
          const refs = await client.getReferences(paper.paper_id, 50);
          const inCorpus = refs.filter((r) => corpusIds.has(r));
          return { id: paper.paper_id, cited: inCorpus };
        } catch {
          return { id: paper.paper_id, cited: [] };
        }
      })
  );

  const graph: Record<string, string[]> = {};
  for (const r of results) {
    if (r.cited.length > 0) {
      graph[r.id] = r.cited;
    }
  }

  return graph;
}

function computeCentroid(embeddings: number[][]): number[] {
  if (!embeddings.length) return [];
  const dim = embeddings[0].length;
  const centroid = Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }
  return centroid.map((v) => v / embeddings.length);
}

export async function mergerNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const settings = getSettings();
  const papers = state.papers;
  const { query, round: roundNum, maxRounds } = state;
  const findings = state.findings;

  const beforeExact = papers.length;
  let deduped = deduplicatePapers(papers);
  deduped = await semanticDeduplicate(deduped);

  const citationGraph = await buildCitationGraph(deduped);

  deduped = rankPapers(deduped, query, citationGraph);

  const topK = settings.topK;
  deduped = await mmrSelect(deduped, query, topK, settings.mmrLambda);

  const callback = state.progressCallback;
  if (callback) {
    callback("merger", {
      papers_before_dedup: beforeExact,
      papers_after_filter: deduped.length,
      citation_edges: Object.values(citationGraph).reduce((sum, v) => sum + v.length, 0),
    });
  }

  let newCentroid: number[] | null = null;
  let converged = false;

  if (findings.length > 0) {
    try {
      const embClient = getEmbeddingClient();
      const claimEmbeds = await embClient.embedTexts(findings.map((f) => f.claim));
      newCentroid = computeCentroid(claimEmbeds);

      if (state.findingsCentroid) {
        const sim = cosineSimilarity(newCentroid, state.findingsCentroid);
        if (sim >= CONVERGENCE_THRESHOLD) {
          converged = true;
        }
      }
    } catch {
      // ignore
    }
  }

  const nextStatus = roundNum >= maxRounds || converged ? "synthesizing" : "searching";

  if (callback) {
    callback("merger", {
      papers_before_dedup: beforeExact,
      papers_after_filter: deduped.length,
      converged,
    });
  }

  return {
    papers: deduped,
    round: roundNum + 1,
    status: nextStatus,
    findingsCentroid: newCentroid,
    converged,
    citationGraph,
  };
}

export function createMergerNode() {
  return mergerNode;
}