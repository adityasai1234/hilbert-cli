import OpenAI from "openai";
import { getSettings } from "../config";
import { getEmbeddingCache } from "../persistence/embeddingCache";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export class EmbeddingClient {
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    const settings = getSettings();
    this.model = model || settings.embeddingModel;
    this.client = new OpenAI({
      apiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
    });
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const cache = getEmbeddingCache();
    const cached = cache.getBatch(texts);

    const missIndices: number[] = [];
    const missTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (cached.get(texts[i]) === null) {
        missIndices.push(i);
        missTexts.push(texts[i]);
      }
    }

    if (missTexts.length > 0) {
      const fresh = await this.embedOpenAI(missTexts);
      cache.setBatch(missTexts, fresh);

      for (let i = 0; i < missIndices.length; i++) {
        cached.set(texts[missIndices[i]], fresh[i]);
      }
    }

    return texts.map((t) => cached.get(t) || []);
  }

  private async embedOpenAI(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }

  async embedPapers(papers: { title: string; abstract: string }[]): Promise<number[][]> {
    const texts = papers.map((p) => {
      const combined = `${p.title}. ${p.abstract}`;
      return combined.length > 2000 ? combined.slice(0, 2000) + "..." : combined;
    });

    try {
      return await this.embedTexts(texts);
    } catch {
      const dim = 1536;
      return papers.map(() => Array(dim).fill(0));
    }
  }

  async computeSimilarities(claims: string[], contexts: string[]): Promise<number[]> {
    if (!claims.length || !contexts.length) return [];

    const claimEmbeds = await this.embedTexts(claims);
    const contextEmbeds = await this.embedTexts(contexts);

    return claimEmbeds.map((claimEmb) => {
      let bestSim = 0;
      for (const ctxEmb of contextEmbeds) {
        const sim = cosineSimilarity(claimEmb, ctxEmb);
        if (sim > bestSim) bestSim = sim;
      }
      return bestSim;
    });
  }
}

let clientInstance: EmbeddingClient | null = null;

export function getEmbeddingClient(): EmbeddingClient {
  if (!clientInstance) {
    clientInstance = new EmbeddingClient();
  }
  return clientInstance;
}

export function setEmbeddingClient(client: EmbeddingClient): void {
  clientInstance = client;
}