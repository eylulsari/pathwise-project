import { Injectable, Logger } from '@nestjs/common';
import { ChatTurn } from '../../domain/assistant.types';

// Groq speaks the OpenAI chat-completions dialect. Model + key are supplied per
// call; the key rides in the `Authorization` header (never the URL, so it can't
// leak into logs/proxies) — same discipline as GeminiClient.
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** A tool in OpenAI function-calling form (JSON-Schema `parameters`). */
export interface GroqTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface GroqCallInput {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: ChatTurn[];
  tools?: GroqTool[];
}

/** A tool call the model emitted (e.g. suggest_place). */
export interface GroqFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GroqResult {
  text: string;
  functionCall?: GroqFunctionCall;
}

interface GroqResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: {
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
}

/** OpenAI message shape — what Groq accepts on the wire. */
interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin fetcher over Groq's `chat/completions`. Pure transport — it throws on any
 * non-OK response; caching/fallback/place-validation are the service's job.
 *
 * Deliberately exposes the SAME result contract as GeminiClient (`text` +
 * optional `functionCall`) so AssistantService can swap providers without
 * caring about wire formats. The Gemini↔OpenAI shape translation (role naming,
 * parts→content, tool_calls→functionCall) is contained here.
 */
@Injectable()
export class GroqClient {
  private readonly logger = new Logger(GroqClient.name);

  async generate(input: GroqCallInput): Promise<GroqResult> {
    const messages: OpenAiMessage[] = [
      { role: 'system', content: input.systemInstruction },
      ...input.contents.map(toOpenAiMessage),
    ];

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        // `tool_choice: auto` lets the model answer in prose, call suggest_place,
        // or do both — matching how the Gemini path behaves.
        ...(input.tools?.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
        temperature: 0.6,
        max_tokens: 800,
      }),
      // Keep the request bounded so a hung upstream can't stall the chat request.
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Groq responded ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as GroqResponse;
    const message = body.choices?.[0]?.message;

    const text = (message?.content ?? '').trim();

    let functionCall: GroqFunctionCall | undefined;
    const call = message?.tool_calls?.[0]?.function;
    if (call?.name) {
      functionCall = { name: call.name, args: parseArgs(call.arguments, this.logger) };
    }

    return { text, functionCall };
  }
}

/**
 * Domain history is stored in Gemini's content shape. Translate it: 'model' is
 * OpenAI's 'assistant', and the text parts collapse into one string.
 */
function toOpenAiMessage(turn: ChatTurn): OpenAiMessage {
  return {
    role: turn.role === 'model' ? 'assistant' : 'user',
    content: turn.parts.map((p) => p.text).join('\n'),
  };
}

/**
 * OpenAI-dialect tool arguments arrive as a JSON *string*, not an object (unlike
 * Gemini). A malformed blob must not take the whole turn down — the service
 * simply drops the suggestion card when the args are unusable.
 */
function parseArgs(raw: string | undefined, logger: Logger): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    logger.warn('Groq returned unparseable tool arguments — dropping card');
    return {};
  }
}
