import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlacesService } from '../../places/application/places.service';
import { Place } from '../../places/domain/place';
import { GeminiClient, GeminiTool } from '../infrastructure/gemini/gemini.client';
import {
  AssistantReply,
  ChatInput,
  PlaceSuggestion,
} from '../domain/assistant.types';

// Verified current + free-tier callable with the project key (2026-07). Cheap,
// fast, no "thinking" token overhead — matters because users share one key.
// Note: gemini-2.5-flash is now 404 for new keys; gemini-flash-latest works but
// burns extra thinking tokens. Override via GEMINI_MODEL if a better one ships.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
// How many real places we inject as grounding data per request.
const MAX_INJECTED_PLACES = 8;

/**
 * Orchestrates a grounded, Istanbul-only chat turn:
 *  1. server-side keyword/hub filter → 5–8 REAL places from the dataset
 *  2. inject them (+ the user's active plan) into the system instruction
 *  3. call Gemini with a `suggest_place` tool
 *  4. validate any suggested placeId against the dataset before returning a card
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
  ) {}

  async chat(input: ChatInput): Promise<AssistantReply> {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) {
      this.logger.warn('GEMINI_API_KEY not set — using fallback assistant');
      return this.fallback(input.message);
    }

    try {
      return await this.callGemini(key, input);
    } catch (err) {
      this.logger.warn(`Gemini call failed, using fallback: ${String(err)}`);
      return this.fallback(input.message);
    }
  }

  // ── Live path ──────────────────────────────────────────────────────
  private async callGemini(key: string, input: ChatInput): Promise<AssistantReply> {
    const model = this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
    const all = await this.places.findAll();
    const relevant = selectRelevantPlaces(input.message, all);

    const result = await this.gemini.generate({
      apiKey: key,
      model,
      systemInstruction: buildSystemInstruction(relevant, input.activePlan),
      contents: [
        ...input.conversationHistory,
        { role: 'user', parts: [{ text: input.message }] },
      ],
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

    return { answer, suggestion, source: 'gemini' };
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
    // and the fallback should still land a real place when Gemini is off.
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

const HUB_KEYWORDS: Record<string, string[]> = {
  sultanahmet: ['sultanahmet', 'old city', 'hagia', 'blue mosque', 'topkapi'],
  'karakoy-galata': ['karakoy', 'karaköy', 'galata', 'beyoglu', 'beyoğlu'],
  'kadikoy-moda': ['kadikoy', 'kadıköy', 'moda', 'asian side'],
  'balat-fener': ['balat', 'fener', 'golden horn'],
  'besiktas-bogaz': ['besiktas', 'beşiktaş', 'bosphorus', 'boğaz', 'ortakoy', 'ortaköy'],
};

const INTEREST_KEYWORDS: Record<string, string[]> = {
  food: ['eat', 'food', 'cheap', 'breakfast', 'lunch', 'dinner', 'restaurant', 'cafe', 'kahvaltı', 'street food', 'budget'],
  history: ['history', 'historic', 'mosque', 'palace', 'museum', 'ancient', 'ottoman', 'byzantine'],
  photo: ['photo', 'view', 'sunset', 'golden hour', 'instagram', 'scenic', 'panorama'],
  market: ['market', 'bazaar', 'shopping', 'shop', 'çarşı', 'souvenir'],
  art: ['art', 'gallery', 'design', 'mural', 'street art'],
  nature: ['park', 'nature', 'garden', 'walk', 'green', 'sea', 'waterfront'],
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
  for (const p of [...all].sort((a, b) => b.rating - a.rating)) {
    if (spread.length >= MAX_INJECTED_PLACES) break;
    if (spread.includes(p)) continue;
    if (!seenHubs.has(p.hub)) {
      spread.push(p);
      seenHubs.add(p.hub);
    }
  }
  for (const p of [...all].sort((a, b) => b.rating - a.rating)) {
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

// ── Gemini tool declaration ───────────────────────────────────────────

const SUGGEST_PLACE_TOOL: GeminiTool = {
  functionDeclarations: [
    {
      name: 'suggest_place',
      description:
        "Recommend ONE specific place from the provided PLACES list for the user to add to their Istanbul day. Only call this with a placeId that appears in that list.",
      parameters: {
        type: 'OBJECT',
        properties: {
          placeId: {
            type: 'STRING',
            description: 'The exact placeId (the id= value) of a place from the PLACES list.',
          },
          reason: {
            type: 'STRING',
            description: "One short sentence on why this place fits the user's request.",
          },
          safety: {
            type: 'STRING',
            enum: ['safe', 'caution'],
            description: 'Solo-traveller safety hint for this spot.',
          },
        },
        required: ['placeId', 'reason'],
      },
    },
  ],
};
