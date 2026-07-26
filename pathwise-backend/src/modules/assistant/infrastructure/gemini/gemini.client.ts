import { Injectable, Logger } from '@nestjs/common';
import { ChatTurn } from '../../domain/assistant.types';

// Gemini REST endpoint. Model + key are supplied per call; the key rides in the
// `x-goog-api-key` header (never the URL, so it can't leak into logs/proxies).
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** A Gemini function-calling declaration (OpenAPI-subset schema). */
export interface GeminiTool {
  functionDeclarations: unknown[];
}

export interface GeminiCallInput {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: ChatTurn[];
  tools?: GeminiTool[];
}

/** A tool call the model emitted (e.g. suggest_place). */
export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiResult {
  text: string;
  functionCall?: GeminiFunctionCall;
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        functionCall?: { name: string; args?: Record<string, unknown> };
      }[];
    };
  }[];
}

/**
 * Thin fetcher over Gemini's `generateContent`. Pure transport — it throws on
 * any non-OK response; caching/fallback/place-validation are the service's job
 * (mirrors how OverpassClient/WikipediaClient stay dumb beside EnrichmentService).
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  async generate(input: GeminiCallInput): Promise<GeminiResult> {
    const url = `${BASE_URL}/${input.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemInstruction }] },
        contents: input.contents,
        tools: input.tools,
        generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
      }),
      // Keep the request bounded so a hung upstream can't stall the chat request.
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini responded ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as GeminiResponse;
    const parts = body.candidates?.[0]?.content?.parts ?? [];

    let text = '';
    let functionCall: GeminiFunctionCall | undefined;
    for (const p of parts) {
      if (typeof p.text === 'string') text += p.text;
      if (p.functionCall) {
        functionCall = { name: p.functionCall.name, args: p.functionCall.args ?? {} };
      }
    }

    return { text: text.trim(), functionCall };
  }
}
