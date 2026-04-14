import { z } from "zod";

export const FindingSchema = z.object({
  finding_id: z.string(),
  claim: z.string().describe("The claim or finding statement"),
  source_paper_id: z.string().describe("ID of the source paper"),
  evidence_text: z.string().describe("Text from paper supporting the claim"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Confidence score from verifier (0.0-1.0)"),
  created_at: z.string().default(() => new Date().toISOString()),
  is_verified: z.boolean().default(false),
});

export type Finding = z.infer<typeof FindingSchema>;

export function confidenceLabel(finding: Finding): string {
  if (finding.confidence >= 0.9) return "high";
  if (finding.confidence >= 0.75) return "medium";
  if (finding.confidence > 0) return "low";
  return "unverified";
}

export const ContradictionSchema = z.object({
  contradiction_id: z.string(),
  finding_id_a: z.string(),
  finding_id_b: z.string(),
  claim_a: z.string().default(""),
  claim_b: z.string().default(""),
  similarity: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Cosine similarity between the two claims (low = more contradictory)"),
  description: z.string().default(""),
  confirmed: z.boolean().default(false),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type Contradiction = z.infer<typeof ContradictionSchema>;

export function severityLabel(contradiction: Contradiction): string {
  if (contradiction.similarity < 0.05) return "FATAL";
  if (contradiction.similarity < 0.1) return "MAJOR";
  return "MINOR";
}

export const GapSchema = z.object({
  gap_id: z.string(),
  description: z.string(),
  sub_question: z.string().optional(),
  severity: z.enum(["minor", "major", "critical"]).default("minor"),
  related_findings: z.array(z.string()).default([]),
});

export type Gap = z.infer<typeof GapSchema>;