import * as fs from "fs";
import * as path from "path";
import { getSettings } from "../config";
import { getClient } from "../llm/client";
import { getHypothesisPrompt } from "../llm/prompts";
import { parseJsonList } from "../llm/utils";
import type { ResearchState } from "../state";
import type { Hypothesis } from "../models/hypothesis";

function hypothesesToMarkdown(hypotheses: Hypothesis[]): string {
  if (!hypotheses.length) return "";

  const lines = [
    "",
    "---",
    "",
    "## Open Hypotheses & Research Directions",
    "",
    "> *The following hypotheses were generated from the verified findings above.*",
    "> *They are speculative and intended to guide future investigation.*",
    "",
  ];

  for (let i = 0; i < hypotheses.length; i++) {
    const h = hypotheses[i];
    const confPct = Math.round(h.confidence * 100);
    lines.push(`**${i + 1}. ${h.text}**`);
    if (h.basis) {
      lines.push(`> *Basis:* ${h.basis}`);
    }
    lines.push(`> *Plausibility:* ${confPct}%`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function hypothesisNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const { query, findings } = state;

  const callback = state.progressCallback;
  if (callback) {
    callback("hypothesis", { findings: findings.length });
  }

  const findingsData = findings.map((f) => ({
    finding_id: f.finding_id,
    claim: f.claim,
    confidence: Math.round(f.confidence * 1000) / 1000,
    is_verified: f.is_verified,
  }));

  const [systemPrompt, userPrompt] = getHypothesisPrompt(query, findingsData);

  const hypotheses: Hypothesis[] = [];
  try {
    const client = getClient();
    const content = await client.completeText(userPrompt, systemPrompt);

    const hypList = parseJsonList(content);
    for (const h of hypList) {
      if (h && typeof h === "object" && (h as Record<string, unknown>).text) {
        const hp = h as Record<string, unknown>;
        hypotheses.push({
          hypothesis_id: `hyp-${Math.random().toString(36).slice(2, 10)}`,
          text: hp.text as string,
          basis: (hp.basis as string) || "",
          related_finding_ids: (hp.related_finding_ids as string[]) || [],
          confidence: typeof hp.confidence === "number" ? hp.confidence : 0.5,
        });
      }
    }
  } catch {
    // non-fatal
  }

  if (hypotheses.length > 0) {
    const settings = getSettings();
    const reportPath = path.join(settings.outputDir, "report.md");
    try {
      const existing = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf-8") : "";
      fs.writeFileSync(reportPath, existing + hypothesesToMarkdown(hypotheses));
    } catch {
      // ignore
    }
  }

  if (callback) {
    callback("hypothesis", { generated: hypotheses.length });
  }

  return { hypotheses };
}

export function createHypothesisNode() {
  return hypothesisNode;
}