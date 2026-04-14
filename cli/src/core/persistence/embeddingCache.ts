import crypto from "crypto";
import { getDb } from "./schema.js";
import { getSettings } from "../config";

let cacheInstance: EmbeddingCache | null = null;

export class EmbeddingCache {
  private model: string;

  constructor(model?: string) {
    const settings = getSettings();
    this.model = model || settings.embeddingModel;
  }

  private hash(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  get(text: string): number[] | null {
    const db = getDb();
    const key = this.hash(text);
    const stmt = db.prepare(`
      SELECT embedding FROM embedding_cache 
      WHERE content_hash = ? AND model = ?
    `);
    const row = stmt.get(key, this.model) as { embedding: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.embedding);
  }

  set(text: string, embedding: number[]): void {
    const db = getDb();
    const key = this.hash(text);
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO embedding_cache (content_hash, text_preview, embedding, model, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(key, text.slice(0, 120), JSON.stringify(embedding), this.model, new Date().toISOString());
  }

  getBatch(texts: string[]): Map<string, number[] | null> {
    const results = new Map<string, number[] | null>();
    const keys = texts.map((t) => this.hash(t));
    if (keys.length === 0) return results;

    const db = getDb();
    const placeholders = keys.map(() => "?").join(",");
    const stmt = db.prepare(`
      SELECT content_hash, embedding FROM embedding_cache 
      WHERE content_hash IN (${placeholders}) AND model = ?
    `);
    const rows = stmt.all(...keys, this.model) as { content_hash: string; embedding: string }[];

    const cache: Record<string, number[]> = {};
    for (const row of rows) {
      cache[row.content_hash] = JSON.parse(row.embedding);
    }

    for (let i = 0; i < texts.length; i++) {
      results.set(texts[i], cache[keys[i]] || null);
    }

    return results;
  }

  setBatch(texts: string[], embeddings: number[][]): void {
    if (texts.length !== embeddings.length || texts.length === 0) return;

    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO embedding_cache (content_hash, text_preview, embedding, model, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (let i = 0; i < texts.length; i++) {
        const key = this.hash(texts[i]);
        stmt.run(key, texts[i].slice(0, 120), JSON.stringify(embeddings[i]), this.model, new Date().toISOString());
      }
    });
    insertMany();
  }
}

export function getEmbeddingCache(): EmbeddingCache {
  if (!cacheInstance) {
    cacheInstance = new EmbeddingCache();
  }
  return cacheInstance;
}