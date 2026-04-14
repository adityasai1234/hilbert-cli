import { getSettings } from "../config";
import type { Paper } from "../models/paper";

const SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1";

export class SemanticScholarClient {
  private apiKey: string | undefined;
  private maxResults: number;

  constructor(apiKey?: string, maxResults: number = 25) {
    const settings = getSettings();
    this.apiKey = apiKey || settings.semanticScholarApiKey;
    this.maxResults = maxResults;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  private parsePaper(data: Record<string, unknown>): Paper {
    const paperId = (data.paperId as string) || `sem-${data.paperId || ""}`;
    const title = (data.title as string) || "Untitled";
    const abstract = (data.abstract as string) || "";

    const authors: { name: string; affiliation?: string; author_id?: string }[] = [];
    const authorData = data.authors;
    if (Array.isArray(authorData)) {
      for (const a of authorData) {
        if (a && typeof a === "object") {
          const name = (a as Record<string, unknown>).name as string;
          if (name) authors.push({ name });
        }
      }
    }

    let publishedDate: string | undefined;
    const year = data.year;
    if (year) {
      publishedDate = String(year);
    }

    let url = (data.url as string) || "";
    if (!url && paperId) {
      url = `https://www.semanticscholar.org/paper/${paperId}`;
    }

    const venue = (data.venue as string) || "";
    const doi = (data.doi as string) || "";
    const citationCount = (data.citationCount as number) || 0;
    const isOpenAccess = (data.isOpenAccess as boolean) || false;

    return {
      paper_id: paperId,
      title,
      abstract,
      authors,
      published_date: publishedDate,
      url,
      doi: doi || undefined,
      venue: venue || undefined,
      citation_count: citationCount,
      is_open_access: isOpenAccess,
    };
  }

  async search(query: string, maxResults?: number, yearFrom?: number): Promise<Paper[]> {
    const max = maxResults || this.maxResults;

    const params = new URLSearchParams({
      query,
      limit: String(max),
      fields: "title,abstract,authors,year,url,venue,doi,citationCount,isOpenAccess",
    });

    if (yearFrom !== undefined) {
      params.set("year", `${yearFrom}-`);
    }

    const url = `${SEMANTIC_SCHOLAR_API_URL}/paper/search?${params.toString()}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Semantic Scholar API error: ${response.status}: ${text}`);
      }

      const data = (await response.json()) as { data?: Record<string, unknown>[] };
      const items = data?.data;
      if (!items) return [];

      return items.map((item) => this.parsePaper(item));
    } catch (error) {
      throw new Error(`Failed to search Semantic Scholar: ${error}`);
    }
  }

  async getPaper(paperId: string): Promise<Paper | null> {
    const params = new URLSearchParams({
      fields: "title,abstract,authors,year,url,venue,doi,citationCount,isOpenAccess",
    });

    const url = `${SEMANTIC_SCHOLAR_API_URL}/paper/${paperId}?${params.toString()}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Semantic Scholar API error: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      return this.parsePaper(data);
    } catch (error) {
      throw new Error(`Failed to get paper: ${error}`);
    }
  }

  async getCitations(paperId: string, limit: number = 10): Promise<Paper[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: "title,abstract,authors,year,url,venue,doi,citationCount",
    });

    const url = `${SEMANTIC_SCHOLAR_API_URL}/paper/${paperId}/citations?${params.toString()}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];

      const data = (await response.json()) as { data?: Record<string, unknown>[] };
      const citations = data?.data;
      if (!citations) return [];

      return citations
        .map((c) => (c as Record<string, unknown>).citingPaper)
        .filter((p): p is Record<string, unknown> => !!p)
        .map((p) => this.parsePaper(p));
    } catch {
      return [];
    }
  }

  async getReferences(paperId: string, limit: number = 20): Promise<string[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: "paperId",
    });

    const url = `${SEMANTIC_SCHOLAR_API_URL}/paper/${paperId}/references?${params.toString()}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) return [];

      const data = (await response.json()) as { data?: Record<string, unknown>[] };
      const refs = data?.data;
      if (!refs) return [];

      return refs
        .map((r) => (r as Record<string, unknown>).citedPaper)
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p) => p.paperId as string);
    } catch {
      return [];
    }
  }
}

let clientInstance: SemanticScholarClient | null = null;

export function getSemanticScholarClient(): SemanticScholarClient {
  if (!clientInstance) {
    clientInstance = new SemanticScholarClient();
  }
  return clientInstance;
}

export function setSemanticScholarClient(client: SemanticScholarClient): void {
  clientInstance = client;
}