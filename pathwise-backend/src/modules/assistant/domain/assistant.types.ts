/**
 * Domain shapes for the AI assistant. Deliberately provider-agnostic — each
 * provider's wire format lives in its infrastructure client, not here.
 */

/**
 * One turn of chat history (role + text parts). This is Gemini's content shape
 * and it stays the canonical internal format — the client already ships it and
 * GroqClient translates it to OpenAI messages on the way out.
 */
export interface ChatTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * A structured suggestion card. Mirrors the frontend `AiSuggestion` and carries
 * exactly what the "Add to Today's Path" action needs (`placeId`). Every field
 * is derived from a REAL place in the dataset — never invented by the model.
 */
export interface PlaceSuggestion {
  placeId: string;
  name: string;
  reason: string;
  costTry: number;
  safety: 'safe' | 'caution';
}

/** Which path produced an answer: a live LLM, or the canned fallback. */
export type AssistantSource = 'groq' | 'gemini' | 'fallback';

/** What POST /assistant/chat returns. `source` lets the client/tests tell a
 *  live LLM answer from the canned fallback, and which provider served it. */
export interface AssistantReply {
  answer: string;
  suggestion?: PlaceSuggestion;
  source: AssistantSource;
}

/** Normalised input the service works with (after DTO validation). */
export interface ChatInput {
  message: string;
  conversationHistory: ChatTurn[];
  /** Place names on the user's active Today's Path, for personalisation. */
  activePlan: string[];
}
