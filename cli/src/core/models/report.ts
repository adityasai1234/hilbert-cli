import { z } from "zod";

export const ReportSchema = z.object({
  report_id: z.string(),
  title: z.string(),
  query: z.string(),
  executive_summary: z.string().default(""),
  sections: z.record(z.string(), z.string()).default({}),
  sources: z.array(z.record(z.string(), z.unknown())).default([]),
  source_index: z.record(z.string(), z.string()).default({}),
  findings_summary: z.array(z.record(z.string(), z.unknown())).default([]),
  bibliography: z.string().default(""),
  created_at: z.string().default(() => new Date().toISOString()),
  status: z.enum(["draft", "final"]).default("draft"),
});

export type Report = z.infer<typeof ReportSchema>;

function escapeLatex(text: string): string {
  text = text.replace(/\\/g, "\\textbackslash{}");
  const replacements: [string, string][] = [
    ["&", "\\&"],
    ["%", "\\%"],
    ["$", "\\$"],
    ["#", "\\#"],
    ["_", "\\_"],
    ["{", "\\{"],
    ["}", "\\}"],
    ["~", "\\textasciitilde{}"],
    ["^", "\\textasciicircum{}"],
  ];
  for (const [char, repl] of replacements) {
    text = text.replace(new RegExp(char, "g"), repl);
  }
  return text;
}

function formatAuthors(authors: unknown[] | unknown): string {
  if (Array.isArray(authors)) {
    const firstTwo = authors.slice(0, 2).map(String);
    return firstTwo.join(", ") + (authors.length > 2 ? " et al." : "");
  }
  return String(authors);
}

export function toMarkdown(report: Report): string {
  const lines = [
    `# ${report.title}`,
    "",
    `**Query:** ${report.query}`,
    `**Date:** ${new Date(report.created_at).toISOString().split("T")[0]}`,
    "",
  ];

  if (report.executive_summary) {
    lines.push("## Executive Summary", report.executive_summary, "");
  }

  for (const [sectionName, sectionContent] of Object.entries(report.sections)) {
    lines.push(`## ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}`, sectionContent, "");
  }

  if (report.findings_summary.length > 0) {
    lines.push("## Key Findings", "");
    for (const f of report.findings_summary) {
      const conf = (f.confidence as number) || 0;
      const label = (f.confidence_label as string) || "unverified";
      const verifiedIcon = f.is_verified ? "✓" : "○";
      lines.push(
        `- ${verifiedIcon} ${f.claim as string} *(confidence: ${conf.toFixed(2)}, ${label})*`
      );
    }
    lines.push("");
  }

  if (report.sources.length > 0) {
    lines.push("## References", "");
    for (let i = 0; i < report.sources.length; i++) {
      const src = report.sources[i];
      const title = (src.title as string) || "Unknown";
      const authors = formatAuthors(src.authors);
      const year = (src.published_date as string) || "n.d.";
      const url = (src.url as string) || "";
      const doi = (src.doi as string) || "";

      let ref = `[${i + 1}] ${authors} (${year}). *${title}*.`;
      if (doi) ref += ` https://doi.org/${doi}`;
      else if (url) ref += ` ${url}`;
      lines.push(ref);
    }
  }

  return lines.join("\n");
}

export function toJson(report: Report): Record<string, unknown> {
  return {
    report_id: report.report_id,
    title: report.title,
    query: report.query,
    executive_summary: report.executive_summary,
    sections: report.sections,
    sources: report.sources,
    source_index: report.source_index,
    findings_summary: report.findings_summary,
    created_at: report.created_at,
    status: report.status,
  };
}

export function toBibtex(report: Report): string {
  return report.bibliography;
}

export function toLatex(report: Report): string {
  const lines = [
    "\\documentclass[12pt,a4paper]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{hyperref}",
    "\\hypersetup{colorlinks=true,linkcolor=blue,filecolor=magenta,urlcolor=cyan}",
    "",
    `\\title{${escapeLatex(report.title)}}`,
    `\\date{${new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}}`,
    "",
    "\\begin{document}",
    "",
    "\\maketitle",
    "",
  ];

  if (report.executive_summary) {
    lines.push(
      "\\section*{Executive Summary}",
      escapeLatex(report.executive_summary),
      ""
    );
  }

  for (const [sectionName, sectionContent] of Object.entries(report.sections)) {
    const escapedName = escapeLatex(
      sectionName.charAt(0).toUpperCase() + sectionName.slice(1)
    );
    lines.push(
      `\\section{${escapedName}}`,
      escapeLatex(sectionContent),
      ""
    );
  }

  if (report.findings_summary.length > 0) {
    lines.push("\\section*{Key Findings}", "\\begin{itemize}", "");
    for (const f of report.findings_summary) {
      const verified = f.is_verified ? "$\\checkmark$" : "$\\circ$";
      const conf = (f.confidence as number) || 0;
      const claim = escapeLatex((f.claim as string) || "");
      lines.push(`  \\item ${verified} ${claim} \\textit{(confidence: ${conf.toFixed(2)})}`);
    }
    lines.push("", "\\end{itemize}", "");
  }

  if (report.sources.length > 0) {
    lines.push("\\section*{References}", "\\begin{thebibliography}{99}", "");
    for (let i = 0; i < report.sources.length; i++) {
      const src = report.sources[i];
      const title = escapeLatex((src.title as string) || "Unknown");
      const authors = formatAuthors(src.authors);
      const year = (src.published_date as string) || "n.d.";
      const doi = (src.doi as string) || "";
      const url = (src.url as string) || "";

      let ref = `\\bibitem{ref${i + 1}} ${escapeLatex(authors)} (${year}). ${title}.`;
      if (doi) ref += ` DOI: \\href{https://doi.org/${doi}}{${doi}}`;
      else if (url) ref += ` URL: \\url{${url}}`;
      lines.push(ref);
    }
    lines.push("", "\\end{thebibliography}", "");
  }

  lines.push("\\end{document}");
  return lines.join("\n");
}