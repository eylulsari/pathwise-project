import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlacesService } from '../../places/application/places.service';
import { Place } from '../../places/domain/place';
import { GeminiClient, GeminiTool } from '../infrastructure/gemini/gemini.client';
import { GroqClient, GroqTool } from '../infrastructure/groq/groq.client';
import {
  AssistantReply,
  AssistantSource,
  ChatInput,
  PlaceSuggestion,
} from '../domain/assistant.types';

// Verified current + free-tier callable with the project key (2026-07). Cheap,
// fast, no "thinking" token overhead — matters because users share one key.
// Note: gemini-2.5-flash is now 404 for new keys; gemini-flash-latest works but
// burns extra thinking tokens. Override via GEMINI_MODEL if a better one ships.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
// Groq's small gpt-oss tier: the free/fast analogue of Gemini's flash-lite, and
// the migration target Groq names for the llama-3.x models it deprecated on
// 2026-06-17. Override via GROQ_MODEL — see console.groq.com/docs/models.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
// How many real places we inject as grounding data per request.
const MAX_INJECTED_PLACES = 8;

/**
 * Orchestrates a grounded, Istanbul-only chat turn:
 *  1. server-side keyword/hub filter → 5–8 REAL places from the dataset
 *  2. inject them (+ the user's active plan) into the system instruction
 *  3. call the configured LLM with a `suggest_place` tool
 *  4. validate any suggested placeId against the dataset before returning a card
 *
 * Provider is chosen by which key is configured — Groq first, then Gemini. Both
 * clients expose the same result contract, so only the tool declaration and the
 * reported `source` differ between them.
 *
 * Never load-bearing: no key, or any failure, degrades to a canned answer that
 * ALSO references a real place — the chat window must never break.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly places: PlacesService,
    private readonly gemini: GeminiClient,
    private readonly groq: GroqClient,
  ) {}

  async chat(input: ChatInput): Promise<AssistantReply> {
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');

    // Groq wins when both are set: AI Studio now issues `AQ.`-prefixed auth keys
    // and a subset of accounts 401 on every Gemini endpoint (see .env.example).
    const provider: AssistantSource = groqKey ? 'groq' : geminiKey ? 'gemini' : 'fallback';
    const key = provider === 'groq' ? groqKey : geminiKey;

    if (provider === 'fallback' || !key) {
      this.logger.warn('No GROQ_API_KEY or GEMINI_API_KEY set — using fallback assistant');
      return this.fallback(input.message);
    }

    try {
      return await this.callProvider(provider, key, input);
    } catch (err) {
      this.logger.warn(`${provider} call failed, using fallback: ${String(err)}`);
      return this.fallback(input.message);
    }
  }

  // ── Live path ──────────────────────────────────────────────────────
  private async callProvider(
    provider: 'groq' | 'gemini',
    key: string,
    input: ChatInput,
  ): Promise<AssistantReply> {
    const all = await this.places.findAll();
    const relevant = selectRelevantPlaces(input.message, all);
    const systemInstruction = buildSystemInstruction(relevant, input.activePlan);
    const contents = [
      ...input.conversationHistory,
      { role: 'user' as const, parts: [{ text: input.message }] },
    ];

    const result =
      provider === 'groq'
        ? await this.groq.generate({
            apiKey: key,
            model: this.config.get<string>('GROQ_MODEL') || DEFAULT_GROQ_MODEL,
            systemInstruction,
            contents,
            tools: [SUGGEST_PLACE_TOOL_OPENAI],
          })
        : await this.gemini.generate({
            apiKey: key,
            model: this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL,
            systemInstruction,
            contents,
            tools: [SUGGEST_PLACE_TOOL],
          });

    let suggestion: PlaceSuggestion | undefined;
    if (result.functionCall?.name === 'suggest_place') {
      suggestion = await this.resolveSuggestion(result.functionCall.args);
    }

    // If the model only emitted a tool call with no prose, synthesise a line.
    const answer =
      result.text ||
      (suggestion
        ? `I'd suggest ${suggestion.name} — ${suggestion.reason}`
        : 'Tell me what you feel like — a view, a cheap eat, something indoors — and I will point you to a real spot.');

    return { answer, suggestion, source: provider };
  }

  /**
   * Turn a `suggest_place` tool call into a card — but ONLY if the placeId is
   * real. This is the guard against the model inventing a place/price/id.
   */
  private async resolveSuggestion(
    args: Record<string, unknown>,
  ): Promise<PlaceSuggestion | undefined> {
    const placeId = typeof args.placeId === 'string' ? args.placeId : '';
    if (!placeId) return undefined;

    const [place] = await this.places.findByIds([placeId]);
    if (!place) {
      this.logger.warn(`Model suggested unknown placeId "${placeId}" — dropping card`);
      return undefined;
    }

    const reason =
      typeof args.reason === 'string' && args.reason.trim()
        ? args.reason.trim()
        : place.localTip;
    const safety: PlaceSuggestion['safety'] =
      args.safety === 'caution' ? 'caution' : safetyOf(place);

    return {
      placeId: place.placeId,
      name: place.name,
      reason,
      costTry: costOf(place),
      safety,
    };
  }

  // ── Fallback path (no key / API error) ─────────────────────────────
  /**
   * Canned answers preserved from the original frontend mock, but grounded in
   * the live dataset so the suggested place is always real (no hard-coded ids).
   */
  private async fallback(message: string): Promise<AssistantReply> {
    const q = message.toLowerCase();
    const all = await this.places.findAll().catch(() => [] as Place[]);

    const pick = (p: Place | undefined, answer: string): AssistantReply =>
      p
        ? {
            answer,
            suggestion: {
              placeId: p.placeId,
              name: p.name,
              reason: p.localTip,
              costTry: costOf(p),
              safety: safetyOf(p),
            },
            source: 'fallback',
          }
        : { answer, source: 'fallback' };

    // Keyword sets are bilingual (EN + TR) — the app ships in both languages,
    // and the fallback should still land a real place when the LLM is off.
    const has = (...kws: string[]) => kws.some((k) => q.includes(k));

    if (has('sunset', 'golden', 'gün batımı', 'günbatımı')) {
      const spot = all.find((p) => p.isSunsetSpot);
      return pick(spot, `For golden hour, head to ${spot?.name ?? 'a Bosphorus viewpoint'} about 45 minutes before sunset.`);
    }
    if (has('rain', 'indoor', 'yağmur', 'kapalı')) {
      const indoor = all.find((p) => p.isIndoor);
      return pick(indoor, `Raining? Duck into ${indoor?.name ?? 'a museum or cistern'} — it is fully indoors.`);
    }
    if (has('cheap', 'budget', 'eat', 'food', 'breakfast', 'ucuz', 'kahvaltı', 'yemek', 'yeme')) {
      const cheapEat = all
        .filter((p) => p.category === 'food' && p.avgFoodCostTry > 0)
        .sort((a, b) => a.avgFoodCostTry - b.avgFoodCostTry)[0];
      return pick(cheapEat, `On a budget? Graze your way through ${cheapEat?.name ?? 'a local market'} — big flavour, small spend.`);
    }

    return {
      answer:
        'I can help you plan around budget, weather and vibe. Try asking for a sunset spot, a cheap eat, or a rainy-day plan.',
      source: 'fallback',
    };
  }
}

// ── Prompt building ───────────────────────────────────────────────────

function buildSystemInstruction(places: Place[], activePlan: string[]): string {
  const placeLines = places.map(placeLine).join('\n');
  const planLine =
    activePlan.length > 0
      ? activePlan.join(', ')
      : 'none yet — the user has not built a route for today.';

  return [
    "You are the Pathwise Assistant, a warm, practical Istanbul travel companion inside the Pathwise trip-planning app.",
    '',
    'RULES:',
    '- ONLY answer questions about visiting Istanbul (places, food, routes, budget, weather, transport, safety, culture). If asked about anything else, politely steer back to Istanbul travel in one short sentence.',
    '- Keep answers concise (2–4 sentences), friendly and specific.',
    '- You may ONLY reference the places listed under PLACES below. NEVER invent places, prices, opening hours or ratings. If nothing fits perfectly, recommend the closest match from the list and say so.',
    '- All prices are in Turkish Lira (₺).',
    '- When you recommend ONE specific place for the user to add to their day, call the suggest_place tool with that place\'s exact placeId from the list, plus a one-line reason. Still write a short conversational reply as well.',
    '- If the user already has a plan today, tailor suggestions to fit around it (nearby, or a good next stop).',
    '',
    'PLACES (the only real data you may cite — "id" is the placeId to pass to suggest_place):',
    placeLines || '(no matching places found)',
    '',
    `USER'S CURRENT PLAN TODAY: ${planLine}`,
  ].join('\n');
}

function placeLine(p: Place): string {
  const bits = [
    `id=${p.placeId}`,
    `"${p.name}"`,
    `hub:${p.hub}`,
    `category:${p.category}`,
    `entry:₺${p.entryFeeTry}`,
    p.avgFoodCostTry > 0 ? `food:~₺${p.avgFoodCostTry}` : '',
    `~${p.avgVisitMinutes}min`,
    p.isIndoor ? 'indoor' : 'outdoor',
    p.isSunsetSpot ? 'sunset-spot' : '',
    p.museumPass ? 'museum-pass' : '',
    `hours:${p.openingHours}`,
    p.localTip ? `tip:${p.localTip}` : '',
  ].filter(Boolean);
  return `- ${bits.join(' | ')}`;
}

// ── Server-side place selection (keyword / hub / interest match) ───────

// 'beyoglu' and 'ortakoy' moved out of karakoy-galata / besiktas-bogaz when
// those neighborhoods got hubs of their own — a keyword must point at the hub
// that actually holds the places, or the grounding filter returns the wrong set.
const HUB_KEYWORDS: Record<string, string[]> = {
  sultanahmet: ['sultanahmet', 'old city', 'hagia', 'blue mosque', 'topkapi'],
  'eminonu-sirkeci': ['eminonu', 'eminönü', 'sirkeci', 'spice bazaar', 'grand bazaar', 'kapalıçarşı', 'süleymaniye'],
  'beyoglu-taksim': ['beyoglu', 'beyoğlu', 'taksim', 'istiklal', 'istiklâl', 'pera', 'nevizade'],
  'karakoy-galata': ['karakoy', 'karaköy', 'galata'],
  'besiktas-bogaz': ['besiktas', 'beşiktaş', 'dolmabahce', 'dolmabahçe', 'yıldız'],
  'ortakoy-bebek': ['ortakoy', 'ortaköy', 'bebek', 'bosphorus', 'boğaz', 'rumeli', 'arnavutköy', 'emirgan'],
  'balat-fener': ['balat', 'fener', 'golden horn'],
  'kadikoy-moda': ['kadikoy', 'kadıköy', 'moda', 'asian side'],
  uskudar: ['uskudar', 'üsküdar', 'kuzguncuk', 'çamlıca', 'camlica', 'maiden', 'kız kulesi'],
  adalar: ['adalar', 'island', 'islands', 'büyükada', 'buyukada', 'heybeliada', 'prince'],
};

const INTEREST_KEYWORDS: Record<string, string[]> = {
  food: ['eat', 'food', 'cheap', 'breakfast', 'lunch', 'dinner', 'restaurant', 'cafe', 'kahvaltı', 'street food', 'budget'],
  history: ['history', 'historic', 'palace', 'ancient', 'ottoman', 'byzantine'],
  photo: ['photo', 'golden hour', 'instagram', 'scenic', 'panorama'],
  market: ['market', 'bazaar', 'shopping', 'shop', 'çarşı', 'souvenir'],
  art: ['art', 'gallery', 'design', 'mural', 'street art'],
  nature: ['park', 'nature', 'garden', 'green', 'forest', 'grove'],
  view: ['view', 'sunset', 'viewpoint', 'skyline', 'overlook', 'manzara'],
  hiddengem: ['hidden', 'secret', 'off the beaten', 'quiet', 'lesser known', 'underrated'],
  relax: ['relax', 'calm', 'chill', 'slow', 'rest', 'peaceful', 'tea garden'],
  local: ['local', 'authentic', 'like a local', 'neighborhood', 'esnaf'],
  culture: ['culture', 'cultural', 'heritage', 'literary', 'music', 'opera'],
  nightlife: ['nightlife', 'bar', 'bars', 'drink', 'meyhane', 'rakı', 'night out'],
  experience: ['experience', 'tour', 'cruise', 'hamam', 'bike', 'boat', 'activity'],
  religion: ['mosque', 'church', 'religious', 'worship', 'cami', 'kilise', 'synagogue'],
};

/**
 * Cheap deterministic relevance filter — no LLM needed to ground the prompt.
 * Scores each place on hub, category/interest and name keyword hits against the
 * message, then returns the top N. Falls back to a city-wide spread (one per
 * hub) so the model always receives real data even for a vague question.
 */
function selectRelevantPlaces(message: string, all: Place[]): Place[] {
  const q = message.toLowerCase();

  const matchedHubs = Object.entries(HUB_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => q.includes(k)))
    .map(([hub]) => hub);

  const matchedInterests = Object.entries(INTEREST_KEYWORDS)
    .filter(([, kws]) => kws.some((k) => q.includes(k)))
    .map(([interest]) => interest);

  const wantsIndoor = q.includes('rain') || q.includes('indoor');
  const wantsSunset = q.includes('sunset') || q.includes('golden');

  const scored = all
    .map((p) => {
      let score = 0;
      if (matchedHubs.includes(p.hub)) score += 3;
      if (matchedInterests.includes(p.category)) score += 3;
      if (p.interests.some((i) => matchedInterests.includes(i))) score += 1;
      if (q.includes(p.name.toLowerCase())) score += 5;
      if (wantsIndoor && p.isIndoor) score += 2;
      if (wantsSunset && p.isSunsetSpot) score += 4;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  if (scored.length >= 3) return scored.slice(0, MAX_INJECTED_PLACES);

  // Vague question → give a representative spread (first place of each hub),
  // padded with the highest-rated remaining places.
  const spread: Place[] = [];
  const seenHubs = new Set<string>();
  for (const p of scored) {
    spread.push(p);
    seenHubs.add(p.hub);
  }
  for (const p of [...all].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
    if (spread.length >= MAX_INJECTED_PLACES) break;
    if (spread.includes(p)) continue;
    if (!seenHubs.has(p.hub)) {
      spread.push(p);
      seenHubs.add(p.hub);
    }
  }
  for (const p of [...all].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
    if (spread.length >= MAX_INJECTED_PLACES) break;
    if (!spread.includes(p)) spread.push(p);
  }
  return spread;
}

// ── Small derivations shared by the live + fallback paths ─────────────

/** The out-of-pocket figure the card shows: entry fee, else typical food spend. */
function costOf(p: Place): number {
  return p.entryFeeTry > 0 ? p.entryFeeTry : p.avgFoodCostTry;
}

/** Map the optional solo-safety score to the card's two-state badge. */
function safetyOf(p: Place): 'safe' | 'caution' {
  if (typeof p.safetyScore === 'number') return p.safetyScore >= 60 ? 'safe' : 'caution';
  return 'safe';
}

// ── Tool declaration, once per provider dialect ───────────────────────
// Same tool, two wire formats: Gemini wants an OpenAPI subset with UPPERCASE
// type names, OpenAI/Groq want plain JSON Schema. The prose is shared so the
// two declarations can't drift apart.

const SUGGEST_PLACE_NAME = 'suggest_place';
const SUGGEST_PLACE_DESCRIPTION =
  'Recommend ONE specific place from the provided PLACES list for the user to add to their Istanbul day. Only call this with a placeId that appears in that list.';
const PLACE_ID_DESCRIPTION =
  'The exact placeId (the id= value) of a place from the PLACES list.';
const REASON_DESCRIPTION = "One short sentence on why this place fits the user's request.";
const SAFETY_DESCRIPTION = 'Solo-traveller safety hint for this spot.';
const SUGGEST_PLACE_REQUIRED = ['placeId', 'reason'];

const SUGGEST_PLACE_TOOL: GeminiTool = {
  functionDeclarations: [
    {
      name: SUGGEST_PLACE_NAME,
      description: SUGGEST_PLACE_DESCRIPTION,
      parameters: {
        type: 'OBJECT',
        properties: {
          placeId: { type: 'STRING', description: PLACE_ID_DESCRIPTION },
          reason: { type: 'STRING', description: REASON_DESCRIPTION },
          safety: {
            type: 'STRING',
            enum: ['safe', 'caution'],
            description: SAFETY_DESCRIPTION,
          },
        },
        required: SUGGEST_PLACE_REQUIRED,
      },
    },
  ],
};

const SUGGEST_PLACE_TOOL_OPENAI: GroqTool = {
  type: 'function',
  function: {
    name: SUGGEST_PLACE_NAME,
    description: SUGGEST_PLACE_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: PLACE_ID_DESCRIPTION },
        reason: { type: 'string', description: REASON_DESCRIPTION },
        safety: {
          type: 'string',
          enum: ['safe', 'caution'],
          description: SAFETY_DESCRIPTION,
        },
      },
      required: SUGGEST_PLACE_REQUIRED,
    },
  },
};
