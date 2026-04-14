import { v4 as uuidv4 } from "uuid";
import { getSettings } from "./config.js";
import { getSessionManager } from "./persistence/sessionManager.js";
import { createInitialState, type ResearchState, type ProgressCallback } from "./state.js";
import { plannerNode } from "./nodes/planner.js";
import { searchNode } from "./nodes/search.js";
import { mergerNode } from "./nodes/merger.js";
import { synthesisNode } from "./nodes/synthesis.js";
import { contradictionNode } from "./nodes/contradiction.js";
import { verifierNode } from "./nodes/verifier.js";
import { reviewerNode } from "./nodes/reviewer.js";
import { writerNode } from "./nodes/writer.js";
import { hypothesisNode } from "./nodes/hypothesis.js";
import type { Session } from "./models/session.js";

export interface ResearchOptions {
  rounds?: number;
  model?: string;
  output?: string;
  subQuestions?: number;
  topK?: number;
  confidence?: number;
  sessionId?: string;
  incrementalSince?: Date;
}

function log(node: string, data: Record<string, unknown>, verbose = true): void {
  if (verbose) {
    console.log(`[${node}]`, JSON.stringify(data));
  }
}

export async function runResearch(
  query: string,
  options?: ResearchOptions,
  progressCallback?: ProgressCallback
): Promise<ResearchState> {
  const settings = getSettings();
  const sessionManager = getSessionManager();

  const sessionId = options?.sessionId || `session-${uuidv4()}`;
  const maxRounds = options?.rounds || settings.maxRounds;

  const session: Session = {
    session_id: sessionId,
    query,
    max_rounds: maxRounds,
    current_round: 0,
    status: "planning",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
  };
  sessionManager.createSession(session);

  let state = createInitialState(query, maxRounds, progressCallback || ((node, data) => log(node, data)));

  state = { ...state, priorSessionId: options?.incrementalSince ? sessionId : null };
  state.incrementalSince = options?.incrementalSince || null;

  log("research", { sessionId, query, maxRounds });

  // Phase 1: Planner
  log("planner", { status: "starting" });
  const plannerUpdate = await plannerNode(state);
  state = { ...state, ...plannerUpdate };
  sessionManager.updateSession(sessionId, { status: "searching", current_round: state.round });
  log("planner", { status: "done", subQuestions: state.subQuestions.length });

  // Phase 2: Search loop
  while (state.status === "searching" && state.round <= state.maxRounds && !state.converged) {
    log("search", { round: state.round, maxRounds: state.maxRounds });

    const searchUpdate = await searchNode(state);
    state = { ...state, ...searchUpdate };
    sessionManager.savePapers(sessionId, state.papers);
    log("search", { papers: state.papers.length, consulted: state.papersConsulted });

    const mergerUpdate = await mergerNode(state);
    state = { ...state, ...mergerUpdate };
    log("merger", { papers: state.papers.length, converged: state.converged });

    if (state.status === "synthesizing" || state.round > state.maxRounds || state.converged) {
      break;
    }

    state.round++;
    sessionManager.updateSession(sessionId, { current_round: state.round });
  }

  // Phase 3: Synthesis → Contradiction → Verifier → Reviewer → Writer → Hypothesis
  log("synthesis", { status: "starting" });
  const synthesisUpdate = await synthesisNode(state);
  state = { ...state, ...synthesisUpdate };
  sessionManager.saveFindings(sessionId, state.findings);
  log("synthesis", { findings: state.findings.length });

  log("contradiction", { status: "starting" });
  const contradictionUpdate = await contradictionNode(state);
  state = { ...state, ...contradictionUpdate };
  log("contradiction", { contradictions: state.contradictions.length });

  log("verifier", { status: "starting" });
  const verifierUpdate = await verifierNode(state);
  state = { ...state, ...verifierUpdate };
  log("verifier", { verified: state.findings.filter((f) => f.is_verified).length });

  log("reviewer", { status: "starting" });
  const reviewerUpdate = await reviewerNode(state);
  state = { ...state, ...reviewerUpdate };
  log("reviewer", { status: "done" });

  log("writer", { status: "starting" });
  const writerUpdate = await writerNode(state);
  state = { ...state, ...writerUpdate };
  log("writer", { status: "done" });

  log("hypothesis", { status: "starting" });
  const hypothesisUpdate = await hypothesisNode(state);
  state = { ...state, ...hypothesisUpdate };
  log("hypothesis", { hypotheses: state.hypotheses.length });

  sessionManager.updateSession(sessionId, {
    status: "done",
    current_round: state.round,
  });
  sessionManager.updateLastSearchedAt(sessionId);

  log("research", { status: "complete", rounds: state.round, findings: state.findings.length });

  return state;
}

export async function continueResearch(
  sessionId: string,
  options?: ResearchOptions,
  progressCallback?: ProgressCallback
): Promise<ResearchState> {
  const sessionManager = getSessionManager();
  const session = sessionManager.getSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status === "done") {
    throw new Error("Cannot resume a completed session. Start a new research instead.");
  }

  const checkpoint = sessionManager.getLatestCheckpoint(sessionId);
  if (!checkpoint) {
    throw new Error(`No checkpoint found for session: ${sessionId}`);
  }

  const state = JSON.parse(checkpoint.state_json) as ResearchState;
  state.progressCallback = progressCallback || ((node, data) => log(node, data));
  state.priorSessionId = sessionId;
  state.incrementalSince = session.last_searched_at ? new Date(session.last_searched_at) : null;

  log("continue", { sessionId, round: state.round, maxRounds: state.maxRounds });

  return runResearch(state.query, { ...options, sessionId }, state.progressCallback);
}