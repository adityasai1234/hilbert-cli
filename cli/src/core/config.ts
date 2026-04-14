export const DEFAULT_MODELS = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
  azure: "gpt-4o",
} as const;

export type LLMProvider = "openai" | "anthropic" | "google" | "azure";

export interface HilbertSettings {
  provider: LLMProvider;
  model: string;
  embeddingModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  azureApiKey?: string;
  azureEndpoint?: string;
  azureApiVersion?: string;
  semanticScholarApiKey?: string;
  maxRounds: number;
  subQuestions: number;
  topK: number;
  confidenceThreshold: number;
  mmrLambda: number;
  outputDir: string;
  dbPath: string;
  logLevel: string;
}

let settings: HilbertSettings | null = null;

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

export function getSettings(): HilbertSettings {
  if (settings) return settings;

  const provider = (getEnv("HILBERT_PROVIDER", "openai") || "openai") as LLMProvider;
  const defaultModel = DEFAULT_MODELS[provider];

  settings = {
    provider,
    model: getEnv("HILBERT_MODEL", defaultModel),
    embeddingModel: getEnv("HILBERT_EMBEDDING_MODEL", "text-embedding-3-small"),
    openaiApiKey: getOptionalEnv("OPENAI_API_KEY"),
    anthropicApiKey: getOptionalEnv("ANTHROPIC_API_KEY"),
    googleApiKey: getOptionalEnv("GOOGLE_API_KEY"),
    azureApiKey: getOptionalEnv("AZURE_API_KEY"),
    azureEndpoint: getOptionalEnv("AZURE_ENDPOINT"),
    azureApiVersion: getOptionalEnv("AZURE_API_VERSION"),
    semanticScholarApiKey: getOptionalEnv("SEMANTIC_SCHOLAR_API_KEY"),
    maxRounds: parseInt(getEnv("HILBERT_MAX_ROUNDS", "3"), 10),
    subQuestions: parseInt(getEnv("HILBERT_SUB_QUESTIONS", "4"), 10),
    topK: parseInt(getEnv("HILBERT_TOP_K", "20"), 10),
    confidenceThreshold: parseFloat(getEnv("HILBERT_CONFIDENCE", "0.75")),
    mmrLambda: parseFloat(getEnv("HILBERT_MMR_LAMBDA", "0.6")),
    outputDir: getEnv("HILBERT_OUTPUT_DIR", "./outputs"),
    dbPath: getEnv("HILBERT_DB_PATH", "hilbert.db"),
    logLevel: getEnv("HILBERT_LOG_LEVEL", "INFO"),
  };

  return settings;
}

export function ensureDirs(): void {
  const s = getSettings();
  const fs = require("fs");
  if (!fs.existsSync(s.outputDir)) {
    fs.mkdirSync(s.outputDir, { recursive: true });
  }
  const dbDir = s.dbPath.includes("/") ? s.dbPath.slice(0, s.dbPath.lastIndexOf("/")) : ".";
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export function setSettings(newSettings: Partial<HilbertSettings>): void {
  if (!settings) {
    settings = getSettings();
  }
  settings = { ...settings, ...newSettings };
}