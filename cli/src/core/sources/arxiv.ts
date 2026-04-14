import { XMLParser } from "fast-xml-parser";
import { getSettings } from "../config";
import { ARXIV_RATE_LIMIT_MS } from "../constants";
import type { Paper } from "../models/paper";

const ARXIV_API_URL = "http://export.arxiv.org/api/query";

export class ArXivClient {
  private maxResults: number;
  private lastRequest: number = 0;

  constructor(maxResults: number = 30) {
    this.maxResults = maxResults;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < ARXIV_RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, ARXIV_RATE_LIMIT_MS - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private parseEntry(entry: Record<string, unknown>): Paper | null {
    try {
      const getText = (path: string): string => {
        const parts = path.split(".");
        let result: unknown = entry;
        for (const part of parts) {
          if (result && typeof result === "object") {
            result = (result as Record<string, unknown>)[part];
          } else {
            return "";
          }
        }
        return typeof result === "string" ? result : "";
      };

      const title = getText("title").trim() || "Untitled";
      const abstract = getText("summary").trim() || "";

      const authors: { name: string; affiliation?: string; author_id?: string }[] = [];
      const authorData = entry.author;
      if (Array.isArray(authorData)) {
        for (const a of authorData) {
          if (a && typeof a === "object") {
            const name = (a as Record<string, unknown>).name as string;
            if (name) authors.push({ name: name.trim() });
          }
        }
      }

      let publishedDate: string | undefined;
      const published = getText("published");
      if (published) {
        publishedDate = published.slice(0, 10);
      }

      const url = getText("id");
      const arxivIdMatch = url.match(/(\d+\.\d+)/);
      const arxivId = arxivIdMatch ? arxivIdMatch[1] : "";
      const paperId = arxivId ? `arxiv-${arxivId}` : `arxiv-${Date.now()}`;

      let venue = "arXiv";
      const primaryCategory = entry["arxiv:primary_category"];
      if (primaryCategory && typeof primaryCategory === "object") {
        const term = (primaryCategory as Record<string, unknown>).term;
        if (typeof term === "string") venue = term;
      }

      return {
        paper_id: paperId,
        title,
        abstract,
        authors,
        published_date: publishedDate,
        url,
        arxiv_id: arxivId || undefined,
        doi: undefined,
        venue,
        citation_count: 0,
        is_open_access: true,
      };
    } catch {
      return null;
    }
  }

  async search(
    query: string,
    maxResults?: number,
    submittedAfter?: Date
  ): Promise<Paper[]> {
    await this.rateLimit();

    const max = maxResults || this.maxResults;
    let searchQuery = `all:${query}`;

    if (submittedAfter) {
      const dateStr = submittedAfter.toISOString().slice(0, 10).replace(/-/g, "");
      searchQuery += ` AND submittedDate:[${dateStr}000000 TO 99991231235959]`;
    }

    const params = new URLSearchParams({
      search_query: searchQuery,
      start: "0",
      max_results: String(max),
      sortBy: "relevance",
      sortOrder: "descending",
    });

    const url = `${ARXIV_API_URL}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ArXiv API error: ${response.status}`);
      }

      const text = await response.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      const parsed = parser.parse(text);

      const entries = parsed.feed?.entry;
      if (!entries) return [];

      const entryList = Array.isArray(entries) ? entries : [entries];

      const papers: Paper[] = [];
      for (const entry of entryList) {
        const paper = this.parseEntry(entry);
        if (paper) papers.push(paper);
      }

      return papers;
    } catch (error) {
      throw new Error(`Failed to search ArXiv: ${error}`);
    }
  }

  async getPaper(arxivId: string): Promise<Paper | null> {
    const papers = await this.search(`id:${arxivId}`, 1);
    return papers[0] || null;
  }
}

let clientInstance: ArXivClient | null = null;

export function getArxivClient(): ArXivClient {
  if (!clientInstance) {
    clientInstance = new ArXivClient();
  }
  return clientInstance;
}

export function setArxivClient(client: ArXivClient): void {
  clientInstance = client;
}