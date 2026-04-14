import { getArxivClient } from "../sources/arxiv";
import { getSemanticScholarClient } from "../sources/semanticScholar";
import type { ResearchState } from "../state";
import type { Paper } from "../models/paper";
import type { ResearchDimension } from "../llm/prompts";

const STRATEGY_AUGMENTS: Record<string, string> = {
  applied: "experiment evaluation benchmark",
  survey: "survey review overview",
};

const ARXIV_DATE_FILTER: Record<string, string> = {
  recent: " AND submittedDate:[20230101 TO *]",
};

function augmentQuery(base: string, strategy: string): string {
  const suffix = STRATEGY_AUGMENTS[strategy];
  return suffix ? `${base} ${suffix}`.trim() : base;
}

async function searchArxiv(
  query: string,
  strategy: string,
  maxResults: number = 12,
  submittedAfter?: Date
): Promise<Paper[]> {
  const q = augmentQuery(query, strategy) + (ARXIV_DATE_FILTER[strategy] || "");
  try {
    const client = getArxivClient();
    return await client.search(q, maxResults, submittedAfter);
  } catch {
    return [];
  }
}

async function searchSemantic(
  query: string,
  strategy: string,
  maxResults: number = 12,
  yearFrom?: number
): Promise<Paper[]> {
  const q = augmentQuery(query, strategy);
  try {
    const client = getSemanticScholarClient();
    return await client.search(q, maxResults, yearFrom);
  } catch {
    return [];
  }
}

async function searchDimension(
  dim: ResearchDimension,
  baseQuery: string,
  submittedAfter?: Date
): Promise<Paper[]> {
  const strategy = dim.strategy;
  const focus = dim.focus || baseQuery;
  const query = focus !== baseQuery ? `${baseQuery} ${focus}`.trim() : baseQuery;

  const yearFrom = submittedAfter ? submittedAfter.getFullYear() : undefined;

  const [arxivPapers, semanticPapers] = await Promise.all([
    searchArxiv(query, strategy, 12, submittedAfter),
    searchSemantic(query, strategy, 12, yearFrom),
  ]);

  return [...arxivPapers, ...semanticPapers];
}

export async function searchNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { query, subQuestions, researchDimensions, incrementalSince } = state;

  const callback = state.progressCallback;
  if (callback) {
    callback("search", { status: "searching", dimensions: researchDimensions.length });
  }

  const tasks: Promise<Paper[]>[] = [];

  for (const sq of subQuestions) {
    tasks.push(searchArxiv(sq, "recent", 12, incrementalSince || undefined));
  }

  for (const dim of researchDimensions) {
    tasks.push(searchDimension(dim, query, incrementalSince || undefined));
  }

  const results = await Promise.all(tasks);

  const allPapers: Paper[] = [];
  let papersConsulted = 0;

  for (const r of results) {
    if (Array.isArray(r)) {
      papersConsulted += r.length;
      allPapers.push(...r);
    }
  }

  return {
    papers: allPapers,
    papersConsulted,
    status: "merging" as const,
  };
}

export function createSearchNode() {
  return searchNode;
}