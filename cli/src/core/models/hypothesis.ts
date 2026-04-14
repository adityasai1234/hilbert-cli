import { z } from "zod";

export const HypothesisSchema = z.object({
  hypothesis_id: z.string().default(() => `hyp-${Math.random().toString(36).slice(2, 10)}`),
  text: z.string(),
  basis: z.string().default(""),
  related_finding_ids: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type Hypothesis = z.infer<typeof HypothesisSchema>;

export function toDict(hypothesis: Hypothesis): Record<string, unknown> {
  return {
    hypothesis_id: hypothesis.hypothesis_id,
    text: hypothesis.text,
    basis: hypothesis.basis,
    related_finding_ids: hypothesis.related_finding_ids,
    confidence: hypothesis.confidence,
  };
}