import { getClient } from "../llm/client";
import { getPlannerPrompt, getDimensionsFallback, type ResearchDimension } from "../llm/prompts";
import { parseJsonObject } from "../llm/utils";
import type { ResearchState } from "../state";

const STRATEGY_AUGMENTS: Record<string, string> = {
  applied: "experiment evaluation benchmark",
  survey: "survey review overview",
};

const ARXIV_DATE_FILTER: Record<string, string> = {
  recent: " AND submittedDate:[20230101 TO *]",
};

export async function plannerNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { query, maxRounds } = state;
  const n = Math.max(maxRounds * 2, 4);

  const callback = state.progressCallback;
  if (callback) {
    callback("planner", { status: "planning", query });
  }

  const [systemPrompt, userPrompt] = getPlannerPrompt(query, n);

  let subQuestions = [query];
  let dimensions = getDimensionsFallback(query);

  try {
    const client = getClient();
    const content = await client.completeText(userPrompt, systemPrompt);
    const parsed = parseJsonObject(content);

    if (parsed) {
      const qs = parsed.sub_questions as string[] | undefined;
      const dims = parsed.dimensions as Record<string, unknown>[] | undefined;
      if (qs && qs.length > 0) {
        subQuestions = qs.map(String);
      }
      if (dims && dims.length === 4) {
        dimensions = dims as unknown as ResearchDimension[];
      }
    }
  } catch {
    // keep fallbacks
  }

  return {
    subQuestions,
    researchDimensions: dimensions,
    round: 1,
    status: "searching" as const,
  };
}

export function createPlannerNode() {
  return plannerNode;
}