import { z } from "zod";

export const SessionStatusSchema = z.enum([
  "planning",
  "searching",
  "merging",
  "synthesizing",
  "reviewing",
  "verifying",
  "writing",
  "done",
  "error",
]);

export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  session_id: z.string(),
  query: z.string(),
  max_rounds: z.number().default(3),
  current_round: z.number().default(0),
  status: SessionStatusSchema.default("planning"),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString()),
  error_message: z.string().optional(),
  tags: z.array(z.string()).default([]),
  last_searched_at: z.string().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export function isResumable(session: Session): boolean {
  return !["done", "error"].includes(session.status);
}

export const CheckpointSchema = z.object({
  checkpoint_id: z.number().default(0),
  session_id: z.string(),
  round: z.number(),
  state_json: z.string(),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;