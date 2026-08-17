import { useState } from 'react';
import type { DietaryRestriction, GroupType, WalkingTolerance } from '../../types';
import { useT } from '../../i18n';

export interface QuizResult {
  mood: 'history' | 'foodie' | 'art' | 'photo';
  pace: 'relaxed' | 'moderate' | 'packed';
  budgetTry: number;
  /** Who the traveller is coming with — becomes the day's group. */
  party: GroupType;
  walkingTolerance: WalkingTolerance;
  /** false = first time in Istanbul. */
  visitedBefore: boolean;
  /**
   * Absent when there is no restriction. Deliberately NOT part of the route
   * request — it is handed to the assistant instead, because no place in the
   * catalogue records what it can cook.
   */
  dietary?: DietaryRestriction;
}

type Option<T> = { id: T; labelKey: string; icon: string };

const MOODS: Option<QuizResult['mood']>[] = [
  { id: 'history', labelKey: 'quiz.historyBuff', icon: '🏛️' },
  { id: 'foodie', labelKey: 'quiz.localFoodie', icon: '☕' },
  { id: 'art', labelKey: 'quiz.undergroundArt', icon: '🎨' },
  { id: 'photo', labelKey: 'quiz.photoHour', icon: '📸' },
];
const PACES: Option<QuizResult['pace']>[] = [
  { id: 'relaxed', labelKey: 'quiz.relaxed', icon: '☕' },
  { id: 'moderate', labelKey: 'quiz.moderate', icon: '🚶' },
  { id: 'packed', labelKey: 'quiz.packed', icon: '⚡' },
];
const PARTIES: Option<GroupType>[] = [
  { id: 'solo', labelKey: 'quiz.partySolo', icon: '🧍' },
  { id: 'couple', labelKey: 'quiz.partyCouple', icon: '👫' },
  { id: 'family', labelKey: 'quiz.partyFamily', icon: '👨‍👩‍👧' },
  { id: 'friends', labelKey: 'quiz.partyFriends', icon: '👥' },
];
const WALKS: Option<WalkingTolerance>[] = [
  { id: 'short', labelKey: 'quiz.walkShort', icon: '🚏' },
  { id: 'moderate', labelKey: 'quiz.walkModerate', icon: '🚶' },
  { id: 'long', labelKey: 'quiz.walkLong', icon: '🥾' },
];
const VISITS: Option<'first' | 'again'>[] = [
  { id: 'first', labelKey: 'quiz.firstTime', icon: '✨' },
  { id: 'again', labelKey: 'quiz.beenBefore', icon: '🔁' },
];
const DIETS: Option<'none' | DietaryRestriction>[] = [
  { id: 'none', labelKey: 'quiz.dietNone', icon: '🍽️' },
  { id: 'vegetarian', labelKey: 'quiz.dietVegetarian', icon: '🥗' },
  { id: 'vegan', labelKey: 'quiz.dietVegan', icon: '🌱' },
  { id: 'no-seafood', labelKey: 'quiz.dietNoSeafood', icon: '🚫🐟' },
];

const STEPS = 7;

/**
 * The Travel Vibe Quiz.
 *
 * Seven questions, and every one of them changes something. Four steer the
 * route engine — mood picks the neighbourhood, pace and walking tolerance set
 * how full the day gets, who you are with demotes the bars, and whether you
 * have been before decides between the icons and the quieter streets.
 *
 * The dietary question is the exception and says so on screen. It reaches the
 * AI assistant and not the route engine, because the catalogue holds no dietary
 * information — a route "filtered" by it would be sorting on a field that does
 * not exist, and the traveller would never know.
 */
export function TravelVibeQuiz({
  onComplete,
  onClose,
}: {
  onComplete: (r: QuizResult) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<QuizResult['mood'] | null>(null);
  const [pace, setPace] = useState<QuizResult['pace'] | null>(null);
  const [party, setParty] = useState<GroupType | null>(null);
  const [walk, setWalk] = useState<WalkingTolerance | null>(null);
  const [visit, setVisit] = useState<'first' | 'again' | null>(null);
  const [diet, setDiet] = useState<'none' | DietaryRestriction | null>(null);
  const [budget, setBudget] = useState(2000);

  // Which answer the current step is waiting for; `null` means unanswered, and
  // the Next button stays disabled until it is not.
  const pending = [mood, pace, party, walk, visit, diet, 'budget'][step];

  const finish = () =>
    mood &&
    pace &&
    party &&
    walk &&
    visit &&
    diet &&
    onComplete({
      mood,
      pace,
      budgetTry: budget,
      party,
      walkingTolerance: walk,
      visitedBefore: visit === 'again',
      dietary: diet === 'none' ? undefined : diet,
    });

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card-cream max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">{t('quiz.title')}</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink" aria-label={t('quiz.cancel')}>
            ✕
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {Array.from({ length: STEPS }, (_, s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-accent-gradient' : 'bg-ink/10'
                }`}
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink/40">
            {step + 1}/{STEPS}
          </span>
        </div>

        {step === 0 && (
          <Step title={t('quiz.moodQ')}>
            <Grid cols={2}>
              {MOODS.map((m) => (
                <Choice key={m.id} active={mood === m.id} onClick={() => setMood(m.id)} icon={m.icon} label={t(m.labelKey)} />
              ))}
            </Grid>
          </Step>
        )}

        {step === 1 && (
          <Step title={t('quiz.paceQ')}>
            <Grid cols={3}>
              {PACES.map((p) => (
                <Choice key={p.id} active={pace === p.id} onClick={() => setPace(p.id)} icon={p.icon} label={t(p.labelKey)} />
              ))}
            </Grid>
          </Step>
        )}

        {step === 2 && (
          <Step title={t('quiz.partyQ')}>
            <Grid cols={2}>
              {PARTIES.map((p) => (
                <Choice key={p.id} active={party === p.id} onClick={() => setParty(p.id)} icon={p.icon} label={t(p.labelKey)} />
              ))}
            </Grid>
          </Step>
        )}

        {step === 3 && (
          <Step title={t('quiz.walkQ')}>
            <Grid cols={3}>
              {WALKS.map((w) => (
                <Choice key={w.id} active={walk === w.id} onClick={() => setWalk(w.id)} icon={w.icon} label={t(w.labelKey)} />
              ))}
            </Grid>
          </Step>
        )}

        {step === 4 && (
          <Step title={t('quiz.firstTimeQ')}>
            <Grid cols={2}>
              {VISITS.map((v) => (
                <Choice key={v.id} active={visit === v.id} onClick={() => setVisit(v.id)} icon={v.icon} label={t(v.labelKey)} />
              ))}
            </Grid>
          </Step>
        )}

        {step === 5 && (
          <Step title={t('quiz.dietQ')}>
            <Grid cols={2}>
              {DIETS.map((d) => (
                <Choice key={d.id} active={diet === d.id} onClick={() => setDiet(d.id)} icon={d.icon} label={t(d.labelKey)} />
              ))}
            </Grid>
            {/* Said plainly, because the alternative is letting someone believe
                their route was built around this. It was not, and the data to
                do it does not exist yet. */}
            <p className="mt-3 rounded-xl bg-ink/5 p-2.5 text-xs leading-relaxed text-ink/55">
              ℹ️ {t('quiz.dietNote')}
            </p>
          </Step>
        )}

        {step === 6 && (
          <Step title={t('quiz.budgetQ')}>
            <p className="text-center font-display text-3xl font-bold text-ink">
              ₺{budget.toLocaleString('tr-TR')}
              {budget >= 5000 ? '+' : ''}
            </p>
            <input
              type="range"
              min={0}
              max={5000}
              step={250}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-3 w-full accent-sunset"
              aria-label={t('quiz.budgetQ')}
            />
            <div className="flex justify-between text-xs text-ink/40">
              <span>₺0</span>
              <span>₺5,000+</span>
            </div>
          </Step>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-ink/60 hover:text-ink"
          >
            {step === 0 ? t('quiz.cancel') : t('quiz.back')}
          </button>
          <button
            disabled={!pending}
            onClick={() => (step < STEPS - 1 ? setStep((s) => s + 1) : finish())}
            className="btn-accent px-6 py-2 text-sm disabled:opacity-40"
          >
            {step < STEPS - 1 ? t('quiz.next') : t('quiz.build')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-3 text-center font-display text-lg font-semibold text-ink">{title}</h4>
      {children}
    </div>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>{children}</div>
  );
}

function Choice({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center text-sm font-semibold transition-colors ${
        active ? 'border-iznik bg-iznik/10 text-ink' : 'border-ink/10 text-ink/70 hover:border-ink/25'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      {label}
    </button>
  );
}
