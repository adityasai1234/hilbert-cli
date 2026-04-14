import { Paper } from "./models/paper";
import { Finding, Contradiction, Gap } from "./models/finding";
import { Hypothesis } from "./models/hypothesis";
import { Report } from "./models/report";
import { ResearchDimension } from "./llm/prompts";

export type ProgressCallback = (node: string, data: Record<string, unknown>) => void;

export interface ResearchState {
  query: string;
  round: number;
  maxRounds: number;
  subQuestions: string[];
  researchDimensions: ResearchDimension[];
  papers: Paper[];
  papersConsulted: number;
  findings: Finding[];
  contradictions: Contradiction[];
  citationGraph: Record<string, string[]>;
  report: Report | null;
  status: "planning" | "searching" | "merging" | "synthesizing" | "reviewing" | "verifying" | "writing" | "done" | "error";
  errorMessage: string | null;
  startedAt: Date | null;
  findingsCentroid: number[] | null;
  converged: boolean;
  hypotheses: Hypothesis[];
  priorSessionId: string | null;
  incrementalSince: Date | null;
  progressCallback: ProgressCallback | null;
  gaps?: Gap[];
}

export function createInitialState(
  query: string,
  maxRounds?: number,
  progressCallback?: ProgressCallback
): ResearchState {
  return {
    query,
    round: 0,
    maxRounds: maxRounds || 3,
    subQuestions: [],
    researchDimensions: [],
    papers: [],
    papersConsulted: 0,
    findings: [],
    contradictions: [],
    citationGraph: {},
    report: null,
    status: "planning",
    errorMessage: null,
    startedAt: new Date(),
    findingsCentroid: null,
    converged: false,
    hypotheses: [],
    priorSessionId: null,
    incrementalSince: null,
    progressCallback: progressCallback || null,
  };
}

export function mergeState(
  current: ResearchState,
  update: Partial<ResearchState>
): ResearchState {
  return { ...current, ...update };
}