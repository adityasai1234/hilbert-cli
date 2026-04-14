import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "../config";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "../constants";

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMProvider {
  completeText(prompt: string, systemPrompt?: string, options?: LLMOptions): Promise<string>;
  complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse>;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    const settings = getSettings();
    this.client = new OpenAI({
      apiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
    });
  }

  async completeText(prompt: string, systemPrompt?: string, options?: LLMOptions): Promise<string> {
    const messages: Message[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    return (await this.complete(messages, options)).content;
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const settings = getSettings();
    const model = options?.model || settings.model;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

    const response = await this.client.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    const settings = getSettings();
    this.client = new Anthropic({
      apiKey: settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async completeText(prompt: string, systemPrompt?: string, options?: LLMOptions): Promise<string> {
    const messages: Anthropic.MessageParam[] = [];
    if (systemPrompt) messages.push({ role: "user", content: `${systemPrompt}\n\n${prompt}` });
    else messages.push({ role: "user", content: prompt });
    return (await this.complete(messages as Message[], options)).content;
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const settings = getSettings();
    const model = options?.model || settings.model;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await this.client.messages.create({
      model,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.content[0]?.type === "text" ? response.content[0].text : "",
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

class GoogleProvider implements LLMProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    const settings = getSettings();
    this.client = new GoogleGenerativeAI(settings.googleApiKey || process.env.GOOGLE_API_KEY || "");
  }

  async completeText(prompt: string, systemPrompt?: string, options?: LLMOptions): Promise<string> {
    const settings = getSettings();
    const model = options?.model || settings.model;
    const generationConfig = {
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const result = await this.client.getGenerativeModel({ model }).generateContent(fullPrompt);
    const response = result.response;
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const settings = getSettings();
    const model = options?.model || settings.model;
    const generationConfig = {
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    const systemMessage = messages.find((m) => m.role === "system")?.content;
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const result = await this.client
      .getGenerativeModel({ model })
      .startChat({ history: conversation.slice(0, -1), generationConfig })
      .sendMessage(conversation[conversation.length - 1].parts);

    return {
      content: result.response.candidates?.[0]?.content?.parts?.[0]?.text || "",
      model,
    };
  }
}

class AzureProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    const settings = getSettings();
    this.client = new OpenAI({
      apiKey: settings.azureApiKey || process.env.AZURE_API_KEY,
      baseURL: `${settings.azureEndpoint}/openai/deployments/${settings.model}`,
      defaultQuery: { "api-version": settings.azureApiVersion || "2024-02-15" },
    });
  }

  async completeText(prompt: string, systemPrompt?: string, options?: LLMOptions): Promise<string> {
    const messages: Message[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    return (await this.complete(messages, options)).content;
  }

  async complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse> {
    const settings = getSettings();
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

    const response = await this.client.chat.completions.create({
      model: settings.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}

let providerInstance: LLMProvider | null = null;

export function createProvider(): LLMProvider {
  const settings = getSettings();
  switch (settings.provider) {
    case "anthropic":
      return new AnthropicProvider();
    case "google":
      return new GoogleProvider();
    case "azure":
      return new AzureProvider();
    case "openai":
    default:
      return new OpenAIProvider();
  }
}

export function getClient(): LLMProvider {
  if (!providerInstance) {
    providerInstance = createProvider();
  }
  return providerInstance;
}

export function setClient(client: LLMProvider): void {
  providerInstance = client;
}