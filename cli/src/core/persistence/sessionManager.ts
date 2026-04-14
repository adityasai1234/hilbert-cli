import { getDb } from "./schema";
import { SessionSchema, type Session, CheckpointSchema, type Checkpoint } from "../models/session";
import type { Paper } from "../models/paper";
import type { Finding } from "../models/finding";

let sessionManagerInstance: SessionManager | null = null;

export class SessionManager {
  createSession(session: Session): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, query, max_rounds, current_round, status, created_at, updated_at, tags, last_searched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.session_id,
      session.query,
      session.max_rounds,
      session.current_round,
      session.status,
      session.created_at,
      session.updated_at,
      JSON.stringify(session.tags),
      session.last_searched_at || null
    );
  }

  getSession(sessionId: string): Session | null {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM sessions WHERE session_id = ?");
    const row = stmt.get(sessionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  getSessionByQuery(query: string): Session | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE query = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const row = stmt.get(query) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  listSessions(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    tags?: string[];
  }): Session[] {
    const db = getDb();
    let sql = "SELECT * FROM sessions WHERE 1=1";
    const params: unknown[] = [];

    if (options?.status) {
      sql += " AND status = ?";
      params.push(options.status);
    }

    if (options?.tags?.length) {
      for (const tag of options.tags) {
        sql += " AND tags LIKE ?";
        params.push(`%"${tag}"%`);
      }
    }

    sql += " ORDER BY created_at DESC";

    if (options?.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += " OFFSET ?";
      params.push(options.offset);
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.rowToSession(row));
  }

  updateSession(sessionId: string, updates: Partial<Session>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.current_round !== undefined) {
      fields.push("current_round = ?");
      values.push(updates.current_round);
    }
    if (updates.error_message !== undefined) {
      fields.push("error_message = ?");
      values.push(updates.error_message);
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.last_searched_at !== undefined) {
      fields.push("last_searched_at = ?");
      values.push(updates.last_searched_at);
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(sessionId);

    const stmt = db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE session_id = ?`);
    stmt.run(...values);
  }

  deleteSession(sessionId: string): void {
    const db = getDb();
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM findings WHERE session_id = ?").run(sessionId);
      db.prepare("DELETE FROM papers WHERE session_id = ?").run(sessionId);
      db.prepare("DELETE FROM checkpoints WHERE session_id = ?").run(sessionId);
      db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
    });
    transaction();
  }

  addTag(sessionId: string, tag: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    if (!session.tags.includes(tag)) {
      session.tags.push(tag);
      this.updateSession(sessionId, { tags: session.tags });
    }
  }

  removeTag(sessionId: string, tag: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    session.tags = session.tags.filter((t) => t !== tag);
    this.updateSession(sessionId, { tags: session.tags });
  }

  updateLastSearchedAt(sessionId: string): void {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE sessions 
      SET last_searched_at = ?, updated_at = ? 
      WHERE session_id = ?
    `);
    stmt.run(new Date().toISOString(), new Date().toISOString(), sessionId);
  }

  saveCheckpoint(sessionId: string, round: number, state: Record<string, unknown>): void {
    const db = getDb();
    const stateJson = JSON.stringify(state, (key, value) => {
      if (key === "progressCallback") return undefined;
      return value;
    });
    const stmt = db.prepare(`
      INSERT INTO checkpoints (session_id, round, state_json, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, round, stateJson, new Date().toISOString());
  }

  getLatestCheckpoint(sessionId: string): Checkpoint | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM checkpoints 
      WHERE session_id = ? 
      ORDER BY round DESC 
      LIMIT 1
    `);
    const row = stmt.get(sessionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToCheckpoint(row);
  }

  savePapers(sessionId: string, papers: Paper[]): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO papers 
      (paper_id, session_id, title, abstract, authors, published_date, url, arxiv_id, doi, venue, citation_count, is_open_access)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((papers: Paper[]) => {
      for (const p of papers) {
        stmt.run(
          p.paper_id,
          sessionId,
          p.title,
          p.abstract,
          JSON.stringify(p.authors),
          p.published_date || null,
          p.url,
          p.arxiv_id || null,
          p.doi || null,
          p.venue || null,
          p.citation_count,
          p.is_open_access ? 1 : 0
        );
      }
    });
    insertMany(papers);
  }

  getPapers(sessionId: string): Paper[] {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM papers WHERE session_id = ?");
    const rows = stmt.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToPaper(row));
  }

  saveFindings(sessionId: string, findings: Finding[]): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO findings 
      (finding_id, session_id, claim, source_paper_id, evidence_text, confidence, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((findings: Finding[]) => {
      for (const f of findings) {
        stmt.run(
          f.finding_id,
          sessionId,
          f.claim,
          f.source_paper_id,
          f.evidence_text,
          f.confidence,
          f.is_verified ? 1 : 0
        );
      }
    });
    insertMany(findings);
  }

  getFindings(sessionId: string): Finding[] {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM findings WHERE session_id = ?");
    const rows = stmt.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToFinding(row));
  }

  private rowToSession(row: Record<string, unknown>): Session {
    return {
      session_id: row.session_id as string,
      query: row.query as string,
      max_rounds: row.max_rounds as number,
      current_round: row.current_round as number,
      status: row.status as Session["status"],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      error_message: row.error_message as string | undefined,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      last_searched_at: row.last_searched_at as string | undefined,
    };
  }

  private rowToCheckpoint(row: Record<string, unknown>): Checkpoint {
    return {
      checkpoint_id: row.id as number,
      session_id: row.session_id as string,
      round: row.round as number,
      state_json: row.state_json as string,
      created_at: row.created_at as string,
    };
  }

  private rowToPaper(row: Record<string, unknown>): Paper {
    return {
      paper_id: row.paper_id as string,
      title: row.title as string,
      abstract: row.abstract as string,
      authors: row.authors ? JSON.parse(row.authors as string) : [],
      published_date: row.published_date as string | undefined,
      url: row.url as string,
      arxiv_id: row.arxiv_id as string | undefined,
      doi: row.doi as string | undefined,
      venue: row.venue as string | undefined,
      citation_count: row.citation_count as number,
      is_open_access: Boolean(row.is_open_access),
    };
  }

  private rowToFinding(row: Record<string, unknown>): Finding {
    return {
      finding_id: row.finding_id as string,
      claim: row.claim as string,
      source_paper_id: row.source_paper_id as string,
      evidence_text: row.evidence_text as string,
      confidence: row.confidence as number,
      is_verified: Boolean(row.is_verified),
      created_at: row.created_at as string || new Date().toISOString(),
    };
  }
}

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}