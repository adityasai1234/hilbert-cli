import Database from "better-sqlite3";
import { getSettings } from "../config";

const dbCache = new Map<string, Database.Database>();

export function getDb(dbPath?: string): Database.Database {
  const settings = getSettings();
  const path = dbPath || settings.dbPath;

  if (dbCache.has(path)) {
    return dbCache.get(path)!;
  }

  const db = new Database(path);
  db.pragma("journal_mode = WAL");

  initTables(db);

  dbCache.set(path, db);
  return db;
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      max_rounds INTEGER DEFAULT 3,
      current_round INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_searched_at TEXT,
      error_message TEXT,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS papers (
      paper_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      abstract TEXT,
      authors TEXT,
      published_date TEXT,
      url TEXT,
      arxiv_id TEXT,
      doi TEXT,
      venue TEXT,
      citation_count INTEGER DEFAULT 0,
      is_open_access INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS findings (
      finding_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      claim TEXT NOT NULL,
      source_paper_id TEXT NOT NULL,
      evidence_text TEXT,
      confidence REAL DEFAULT 0.0,
      is_verified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS embedding_cache (
      content_hash TEXT PRIMARY KEY,
      text_preview TEXT,
      embedding TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_papers_session ON papers(session_id);
    CREATE INDEX IF NOT EXISTS idx_findings_session ON findings(session_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_session_round ON checkpoints(session_id, round DESC);
  `);
}

export function closeDb(dbPath?: string): void {
  const settings = getSettings();
  const path = dbPath || settings.dbPath;
  const db = dbCache.get(path);
  if (db) {
    db.close();
    dbCache.delete(path);
  }
}