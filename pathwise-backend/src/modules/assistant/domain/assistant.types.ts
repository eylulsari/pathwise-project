/**
 * Domain shapes for the AI assistant. Deliberately provider-agnostic — the
 * Gemini wire format lives in the infrastructure client, not here.
 */

/** One turn of chat history, in Gemini's content shape (role + text parts). */
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

/** What POST /assistant/chat returns. `source` lets the client/tests tell a
 *  live Gemini answer from the canned fallback. */
export interface AssistantReply {
  answer: string;
  suggestion?: PlaceSuggestion;
  source: 'gemini' | 'fallback';
}

/** Normalised input the service works with (after DTO validation). */
export interface ChatInput {
  message: string;
  conversationHistory: ChatTurn[];
  /** Place names on the user's active Today's Path, for personalisation. */
  activePlan: string[];
}
