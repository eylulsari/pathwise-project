import { ForumQuestion } from '../../domain/forum';

/**
 * Curated Q&A seed — moved here from the frontend mock when the forum became
 * a real endpoint.
 *
 * Authored as "how long ago" and resolved against the clock on every read, for
 * the same reason as the check-in feed: fixed timestamps would age, and within
 * a week every thread would claim to be days old. Questions stay seed-only —
 * there is no "ask a question" UI, so persisting them would mean adding a
 * feature rather than making one durable. Answers ARE persisted, and merge
 * into their thread at read time.
 */
interface ForumSeedEntry {
  id: string;
  authorName: string;
  question: string;
  minutesAgo: number;
  answers: { authorName: string; text: string; minutesAgo: number }[];
}

const SEED: ForumSeedEntry[] = [
  {
    id: 'q1',
    authorName: 'Priya (India)',
    question: 'Is the Museum Pass worth it for just 2 days in Sultanahmet?',
    minutesAgo: 12,
    answers: [
      { authorName: 'Yuki T.', text: 'Yes if you hit Hagia Sophia + Topkapı + one more. Skips the queues too.', minutesAgo: 9 },
      { authorName: 'Amara O.', text: 'Worth checking what it actually covers first — the Basilica Cistern is run separately and is not included, so budget that ticket on top.', minutesAgo: 6 },
      { authorName: 'Mara L.', text: 'It is valid 5 days from first use, so a 2-day trip wastes most of it unless you go hard on the Sultanahmet museums both days.', minutesAgo: 4 },
    ],
  },
  {
    id: 'q2',
    authorName: 'Tom (UK)',
    question: 'Safest way back to Kadıköy after midnight from the bars?',
    minutesAgo: 40,
    answers: [
      { authorName: 'Diego F.', text: 'Night ferries stop ~midnight; after that use BiTaksi, not street taxis.', minutesAgo: 33 },
      { authorName: 'Mara L.', text: 'Marmaray runs late on weekends — check the last train time.', minutesAgo: 28 },
      { authorName: 'Selin K.', text: 'If you are already on the Asian side you rarely need any of that — Kadife Sk. to most of Moda is a 15-min walk on lit, busy streets.', minutesAgo: 21 },
    ],
  },
  {
    id: 'q3',
    authorName: 'Hannah (Germany)',
    question: 'How much cash should I carry? Is card accepted everywhere?',
    minutesAgo: 95,
    answers: [
      { authorName: 'Diego F.', text: 'Card works almost everywhere including tiny cafés. Keep ~500₺ cash for market stalls, the kumpir row and street simit.', minutesAgo: 80 },
      { authorName: 'Yuki T.', text: 'Skip the airport exchange booths — the rate is far better at the döviz offices in Eminönü or Kadıköy.', minutesAgo: 74 },
    ],
  },
  {
    id: 'q4',
    authorName: 'Marco (Italy)',
    question: 'Istanbulkart — one card for two people, or one each?',
    minutesAgo: 150,
    answers: [
      { authorName: 'Selin K.', text: 'One card can pay for several people — just tap once per person at the turnstile. Buy it from the machines at any metro or ferry entrance.', minutesAgo: 141 },
      { authorName: 'Amara O.', text: 'It covers ferries, tram, metro, funicular and buses, and transfers within two hours are discounted, so it pays for itself on day one.', minutesAgo: 132 },
    ],
  },
  {
    id: 'q5',
    authorName: 'Chen (Singapore)',
    question: 'Rainy day in Istanbul — what actually stays good in the wet?',
    minutesAgo: 210,
    answers: [
      { authorName: 'Mara L.', text: 'Basilica Cistern and the Museum of Turkish & Islamic Arts are both fully indoors and two minutes apart on the Hippodrome.', minutesAgo: 198 },
      { authorName: 'Tom (UK)', text: 'The Grand Bazaar and Spice Bazaar are covered too — a wet afternoon is honestly the best time to go, far fewer people.', minutesAgo: 190 },
    ],
  },
  {
    id: 'q6',
    authorName: 'Camila (Colombia)',
    question: 'Solo female traveller — is Kadıköy fine to walk alone in the evening?',
    minutesAgo: 265,
    answers: [
      { authorName: 'Elif Ş.', text: 'Local here. Çarşı, Kadife Sk. and the Moda seafront are busy and lit well past midnight — normal city awareness is enough. The quiet residential streets uphill are where I would take a taxi instead.', minutesAgo: 250 },
      { authorName: 'Priya R.', text: 'Same experience over two weeks. The one thing I would add: ferries stop around midnight, so decide your way back before you settle in somewhere.', minutesAgo: 244 },
    ],
  },
  {
    id: 'q7',
    authorName: 'Noah (Germany)',
    question: 'Best time of day to photograph Balat without the crowds?',
    minutesAgo: 320,
    answers: [
      { authorName: 'Mara L.', text: 'Before 09:00 on a weekday. By eleven the stepped street with the coloured houses has a queue for the same photo.', minutesAgo: 305 },
      { authorName: 'Hana K.', text: 'Late afternoon works too, and the light is better — just start from Ayvansaray and walk up, most groups come the other way.', minutesAgo: 298 },
    ],
  },
  {
    id: 'q8',
    authorName: 'Marcus (Denmark)',
    question: 'Is the Bosphorus ferry worth it over a paid cruise?',
    minutesAgo: 400,
    answers: [
      { authorName: 'Tom W.', text: 'The public ferry costs a fraction and follows most of the same shoreline. The paid cruise buys you commentary and a guaranteed seat, not a better view.', minutesAgo: 388 },
      { authorName: 'Elif Ş.', text: 'Take the Şehir Hatları line and sit on the right heading north. It is what locals do, and your Istanbulkart already covers it.', minutesAgo: 371 },
    ],
  },
];

/** Materialise the seed against a clock. `now` is injected so it is testable. */
export function seedForum(now: number = Date.now()): ForumQuestion[] {
  return SEED.map((q) => ({
    id: q.id,
    authorName: q.authorName,
    question: q.question,
    createdAt: new Date(now - q.minutesAgo * 60_000),
    answers: q.answers.map((a) => ({
      authorName: a.authorName,
      text: a.text,
      createdAt: new Date(now - a.minutesAgo * 60_000),
    })),
  }));
}
