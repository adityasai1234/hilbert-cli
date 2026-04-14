import * as fs from "fs";
import * as path from "path";
import { getSettings } from "../config";
import { getClient } from "../llm/client";
import { getWriterPrompt } from "../llm/prompts";
import { toMarkdown, toJson, toLatex } from "../models/report";
import { citationKey, toBibtex } from "../models/paper";
import { confidenceLabel } from "../models/finding";
import type { ResearchState } from "../state";
import type { Paper } from "../models/paper";
import type { Gap } from "../models/finding";
import type { Contradiction } from "../models/finding";

function buildSourceIndex(papers: Paper[]): [{ paper_id: string; title: string; authors: string[]; published_date: string; url: string; doi: string; venue: string; citation_number: string }[], Record<string, string>] {
  const sourceData: { paper_id: string; title: string; authors: string[]; published_date: string; url: string; doi: string; venue: string; citation_number: string }[] = [];
  const sourceIndex: Record<string, string> = {};

  for (let i = 0; i < Math.min(papers.length, 20); i++) {
    const paper = papers[i];
    const num = String(i + 1);
    sourceData.push({
      citation_number: num,
      paper_id: paper.paper_id,
      title: paper.title,
      authors: paper.authors.map((a) => a.name),
      published_date: paper.published_date || "n.d.",
      url: paper.url,
      doi: paper.doi || "",
      venue: paper.venue || "",
    });
    sourceIndex[paper.paper_id] = num;
  }

  return [sourceData, sourceIndex];
}

function generateFallbackReport(query: string, findings: { claim: string }[], papers: Paper[]): string {
  const lines = [
    `# Research Report: ${query}`,
    "",
    `## Summary`,
    `Found ${findings.length} findings from ${papers.length} papers.`,
    "",
    "## Findings",
  ];

  for (const f of findings) {
    lines.push(`- ${f.claim}`);
  }

  return lines.join("\n");
}

function generateBibtex(papers: Paper[]): string {
  return papers.map((p) => toBibtex(p)).filter(Boolean).join("\n\n");
}

function generateProvenance(
  state: ResearchState,
  sourceData: { paper_id: string; title: string }[],
  findingsData: Record<string, unknown>[],
  gaps: Gap[],
  contradictions: Contradiction[]
): string {
  const settings = getSettings();
  const now = new Date();
  const durationS = state.startedAt ? Math.floor((now.getTime() - state.startedAt.getTime()) / 1000) : 0;

  const verifiedCount = findingsData.filter((f) => f.is_verified).length;
  const fatalGaps = gaps.filter((g) => g.severity === "critical");
  const majorGaps = gaps.filter((g) => g.severity === "major");

  const dimLabels = state.researchDimensions.map((d) => d.label || d.strategy);

  const lines = [
    `# Provenance: ${state.query}`,
    "",
    "## Run metadata",
    `- **Date:** ${now.toISOString()}`,
    `- **Duration:** ${durationS}s`,
    `- **Model:** ${settings.model}`,
    `- **Rounds completed:** ${state.round} / ${state.maxRounds}${state.converged ? " *(converged early)*" : ""}`,
    `- **Research dimensions:** ${dimLabels.join(", ") || "default"}`,
    "",
    "## Source pipeline",
    `- **Sources consulted (pre-dedup):** ${state.papersConsulted || sourceData.length}`,
    `- **Sources accepted (post-filter):** ${sourceData.length}`,
    "",
    "## Findings",
    `- **Total findings:** ${findingsData.length}`,
    `- **Verified (confidence ≥ ${settings.confidenceThreshold}):** ${verifiedCount}`,
    `- **Unverified:** ${findingsData.length - verifiedCount}`,
    "",
    "## Reviewer integrity check",
    `- **FATAL gaps:** ${fatalGaps.length}`,
    `- **MAJOR gaps:** ${majorGaps.length}`,
    `- **Confirmed contradictions:** ${contradictions.length}`,
  ];

  if (contradictions.length > 0) {
    lines.push("", "### Contradictions");
    for (const c of contradictions) {
      const sev = c.similarity < 0.05 ? "FATAL" : c.similarity < 0.1 ? "MAJOR" : "MINOR";
      lines.push(`- [${sev}] ${c.description || "No description"}`);
    }
  }

  if (fatalGaps.length > 0 || majorGaps.length > 0) {
    lines.push("", "### Gap details");
    for (const g of [...fatalGaps, ...majorGaps]) {
      lines.push(`- [${g.severity}] ${g.description}`);
    }
  }

  const citationGraph = state.citationGraph;
  if (citationGraph && Object.keys(citationGraph).length > 0) {
    const inCorpusCitedBy: Record<string, number> = {};
    for (const citedList of Object.values(citationGraph)) {
      for (const citedId of citedList) {
        inCorpusCitedBy[citedId] = (inCorpusCitedBy[citedId] || 0) + 1;
      }
    }

    if (Object.keys(inCorpusCitedBy).length > 0) {
      const idToTitle: Record<string, string> = {};
      for (const s of sourceData) {
        idToTitle[s.paper_id] = s.title;
      }

      const topCited = Object.entries(inCorpusCitedBy)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      lines.push("", "## Top cross-cited papers (within corpus)");
      for (const [pid, count] of topCited) {
        const title = idToTitle[pid] || pid;
        lines.push(`- [${count} in-corpus citation${count > 1 ? "s" : ""}] **${title}**`);
      }
    }
  }

  lines.push("", "## Sub-questions");
  for (const sq of state.subQuestions) {
    lines.push(`- ${sq}`);
  }

  return lines.join("\n");
}

export async function writerNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const settings = getSettings();
  const { query, findings, papers, startedAt } = state;
  const gaps = (state as unknown as { gaps?: Gap[] }).gaps || [];
  const contradictions = state.contradictions;

  const callback = state.progressCallback;
  if (callback) {
    callback("writer", { status: "writing" });
  }

  const [sourceData, sourceIndex] = buildSourceIndex(papers);

  const findingsData = findings.map((f) => ({
    finding_id: f.finding_id,
    claim: f.claim,
    confidence: f.confidence,
    confidence_label: confidenceLabel(f),
    is_verified: f.is_verified,
    source_paper_id: f.source_paper_id,
    citation_number: sourceIndex[f.source_paper_id] || "?",
  }));

  const [systemPrompt, userPrompt] = getWriterPrompt(query, findingsData, sourceData);

  let content: string;
  try {
    const client = getClient();
    content = await client.completeText(userPrompt, systemPrompt, { maxTokens: 4000 });
  } catch {
    content = generateFallbackReport(query, findings, papers);
  }

  const bibtex = generateBibtex(papers);

  let contradictionsMd = "";
  if (contradictions.length > 0) {
    const lines = ["## Contradictions Detected\n", "> The following claim pairs were identified as potentially contradicting each other.\n"];
    for (const c of contradictions) {
      const sev = c.similarity < 0.05 ? "FATAL" : c.similarity < 0.1 ? "MAJOR" : "MINOR";
      lines.push(`- **${sev}** — *"${c.claim_a}"* vs *"${c.claim_b}"*${c.description ? `\n  ${c.description}` : ""}`);
    }
    contradictionsMd = lines.join("\n");
  }

  const sections: Record<string, string> = { summary: content };
  if (contradictionsMd) {
    sections["contradictions"] = contradictionsMd;
  }

  const report = {
    report_id: `report-${Math.random().toString(36).slice(2, 10)}`,
    title: query,
    query,
    executive_summary: "",
    sections,
    sources: sourceData,
    source_index: sourceIndex,
    findings_summary: findingsData,
    bibliography: bibtex,
    created_at: new Date().toISOString(),
    status: "final" as const,
  };

  const outputDir = settings.outputDir;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, "report.md"), toMarkdown(report as any));
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(toJson(report as any), null, 2));
  fs.writeFileSync(path.join(outputDir, "report.bib"), bibtex);
  fs.writeFileSync(path.join(outputDir, "report.tex"), toLatex(report as any));

  const provenance = generateProvenance(state, sourceData, findingsData, gaps, contradictions);
  fs.writeFileSync(path.join(outputDir, "report.provenance.md"), provenance);

  return {
    report: report as any,
    status: "done" as const,
  };
}

export function createWriterNode() {
  return writerNode;
}